import { createFlappyInput } from "../input/flappy-input.ts";
import { FlappyEnvironment } from "./environment.ts";
import { createFlappyRenderer } from "./renderer.ts";
import { PHYSICS } from "./physics.ts";
import type { WorldState } from "./world.ts";
import { advanceFixedFrame } from '../core/fixed-step.ts';

export const FLAPPY_PLAY_SEED = 20261022;
export const FLAPPY_FRAME_STEP_MS = PHYSICS.dt * 1000;
export const FLAPPY_MAX_FRAME_DELTA_MS = 100;

export function resetFlappyPlayEpisode(environment: FlappyEnvironment): WorldState {
  environment.reset({ seed: FLAPPY_PLAY_SEED });
  return environment.world;
}

export interface FixedFrameResult {
  readonly accumulatorMs: number;
  readonly steps: number;
}

/** Advance no more than six fixed simulation steps for one browser frame. */
export function advanceFlappyFrame(
  deltaMs: number,
  accumulatorMs: number,
  consumeAction: () => 0 | 1,
  step: (action: 0 | 1) => void,
): FixedFrameResult {
  return advanceFixedFrame(deltaMs,accumulatorMs,consumeAction,step);
}

type ViewPhase = "ready" | "running" | "paused" | "finished" | "disposed";

function terminalText(reason: string | undefined): string {
  switch (reason) {
    case "ceiling": return "De vogel raakte het plafond.";
    case "floor": return "De vogel raakte de grond.";
    case "pipe_collision": return "De vogel botste tegen een hindernis.";
    case "time_limit": return "De aflevering bereikte de tijdslimiet.";
    default: return "De aflevering is afgelopen.";
  }
}

/** Mount one explicitly controlled human Flappy episode into a supplied root element. */
export async function mountFlappyPlayView(
  root: HTMLElement,
): Promise<{ dispose(): void }> {
  root.innerHTML = `
    <main>
      <section class="card" aria-labelledby="flappy-title">
        <p class="eyebrow">AI in de klas · simulatie</p>
        <h1 id="flappy-title">Help de vogel door de openingen</h1>
        <p>Druk op <strong>Spatie</strong> of <strong>↑</strong>, klik op Flap, of tik op de knop. Elke druk geeft één flap. Je kunt ook eerst het speelveld kiezen om de toetsen te gebruiken.</p>
        <div class="toolbar" aria-label="Spelbediening">
          <button id="start" type="button" disabled>Start aflevering</button>
          <button id="pause" class="secondary" type="button" aria-label="Pauzeer aflevering" disabled>Pauzeer</button>
          <button id="restart" class="secondary" type="button" disabled>Opnieuw starten</button>
        </div>
        <p id="episode-status" role="status" aria-live="polite" aria-atomic="true">Klaar om te starten. Seed: ${FLAPPY_PLAY_SEED}.</p>
        <p id="episode-score" aria-live="off">Score: 0 · 0 overleefde stappen</p>
        <canvas id="flappy-canvas" tabindex="0" aria-label="Speelveld; selecteer dit veld voor toetsenbordinvoer"></canvas>
        <p id="input-help" class="muted">Toetsenbord: Spatie of ↑. Raak Flap aan om te springen.</p>
        <button id="flap" type="button" class="secondary" aria-label="Flap: laat de vogel omhoog gaan" disabled>Flap</button>
      </section>
    </main>
  `;

  const canvas = root.querySelector<HTMLCanvasElement>("#flappy-canvas");
  const startButton = root.querySelector<HTMLButtonElement>("#start");
  const pauseButton = root.querySelector<HTMLButtonElement>("#pause");
  const restartButton = root.querySelector<HTMLButtonElement>("#restart");
  const flapButton = root.querySelector<HTMLButtonElement>("#flap");
  const status = root.querySelector<HTMLElement>("#episode-status");
  const score = root.querySelector<HTMLElement>("#episode-score");
  const help = root.querySelector<HTMLElement>("#input-help");
  if (!canvas || !startButton || !pauseButton || !restartButton || !flapButton || !status || !score || !help) {
    throw new Error("Flappy play view could not create its required controls.");
  }

  const environment = new FlappyEnvironment();
  let world: WorldState = resetFlappyPlayEpisode(environment);
  let phase: ViewPhase = "ready";
  let frameHandle: number | undefined;
  let lastTimestamp: number | undefined;
  let accumulatorMs = 0;
  let disposed = false;
  let renderer: Awaited<ReturnType<typeof createFlappyRenderer>> | undefined;
  const input = createFlappyInput({ button: flapButton, canvas });

  const updateScore = (): void => {
    score.textContent = `Score: ${environment.pipesPassed} · ${world.steps} overleefde stappen`;
  };
  const paint = (): void => {
    renderer?.render(world);
    updateScore();
  };
  const setError = (error: unknown): void => {
    if (disposed) return;
    phase = "paused";
    stopFrame();
    input.reset();
    status.setAttribute("role", "alert");
    status.textContent = error instanceof Error ? error.message : String(error);
    pauseButton.disabled = true;
    startButton.disabled = true;
    restartButton.disabled = true;
    flapButton.disabled = true;
  };
  const stopFrame = (): void => {
    if (frameHandle !== undefined) cancelAnimationFrame(frameHandle);
    frameHandle = undefined;
    lastTimestamp = undefined;
    accumulatorMs = 0;
  };
  const pauseForFocusLoss = (): void => {
    if (phase !== "running") return;
    phase = "paused";
    stopFrame();
    input.reset();
    flapButton.disabled = true;
    pauseButton.textContent = "Hervat";
    pauseButton.setAttribute("aria-label", "Hervat aflevering");
    status.textContent = "Gepauzeerd omdat het venster niet actief is. Kies Hervat om door te gaan.";
  };
  const step = (action: 0 | 1): void => {
    if (phase !== "running") return;
    const result = environment.step(action);
    world = environment.world;
    if (result.done) {
      phase = "finished";
      stopFrame();
      input.reset();
      flapButton.disabled = true;
      pauseButton.disabled = true;
      startButton.disabled = true;
      status.textContent = `${terminalText(result.reason)} Aflevering klaar. Score: ${result.result?.pipesPassed ?? 0} · ${result.result?.survivalSteps ?? world.steps} overleefde stappen.`;
      paint();
      return;
    }
    paint();
    if (result.reward > 0.5) {
      status.textContent = `Je passeerde een hindernis. Score: ${environment.pipesPassed}.`;
    }
  };
  const frame = (timestamp: number): void => {
    frameHandle = undefined;
    if (phase !== "running" || disposed) return;
    const deltaMs = lastTimestamp === undefined ? 0 : Math.max(0, timestamp - lastTimestamp);
    lastTimestamp = timestamp;
    try {
      const advance = advanceFlappyFrame(deltaMs, accumulatorMs, () => input.consumeAction(), step);
      accumulatorMs = advance.accumulatorMs;
    } catch (error) {
      setError(error);
      return;
    }
    if (phase === "running") frameHandle = requestAnimationFrame(frame);
  };
  const startLoop = (): void => {
    input.reset();
    phase = "running";
    lastTimestamp = undefined;
    accumulatorMs = 0;
    pauseButton.disabled = false;
    flapButton.disabled = false;
    canvas.focus({ preventScroll: true });
    pauseButton.textContent = "Pauzeer";
    pauseButton.setAttribute("aria-label", "Pauzeer aflevering");
    status.setAttribute("role", "status");
    status.textContent = `Aflevering gestart met seed ${FLAPPY_PLAY_SEED}.`;
    frameHandle = requestAnimationFrame(frame);
  };
  const onStart = (): void => {
    if (phase !== "ready") return;
    startButton.disabled = true;
    startLoop();
  };
  const onPause = (): void => {
    if (phase === "running") {
      phase = "paused";
      stopFrame();
      input.reset();
      flapButton.disabled = true;
      pauseButton.textContent = "Hervat";
      pauseButton.setAttribute("aria-label", "Hervat aflevering");
      status.textContent = "Gepauzeerd. Kies Hervat om door te gaan.";
    } else if (phase === "paused") {
      startLoop();
    }
  };
  const onRestart = (): void => {
    if (phase === "disposed") return;
    stopFrame();
    input.reset();
    world = resetFlappyPlayEpisode(environment);
    startButton.disabled = true;
    phase = "ready";
    paint();
    startLoop();
  };
  const onFocusOut = (): void => pauseForFocusLoss();
  const onVisibilityChange = (): void => {
    if (document.visibilityState === "hidden") pauseForFocusLoss();
  };

  startButton.addEventListener("click", onStart);
  pauseButton.addEventListener("click", onPause);
  restartButton.addEventListener("click", onRestart);
  window.addEventListener("blur", onFocusOut);
  document.addEventListener("visibilitychange", onVisibilityChange);

  try {
    renderer = await createFlappyRenderer(canvas);
    if (disposed) {
      renderer.dispose();
    } else {
      paint();
      startButton.disabled = false;
      restartButton.disabled = false;
    }
  } catch (error) {
    setError(error);
  }

  return {
    dispose(): void {
      if (disposed) return;
      disposed = true;
      phase = "disposed";
      stopFrame();
      input.dispose();
      startButton.removeEventListener("click", onStart);
      pauseButton.removeEventListener("click", onPause);
      restartButton.removeEventListener("click", onRestart);
      window.removeEventListener("blur", onFocusOut);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      renderer?.dispose();
    },
  };
}
