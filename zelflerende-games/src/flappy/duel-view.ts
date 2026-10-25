import { createFlappyInput } from "../input/flappy-input.ts";
import { advanceFlappyFrame } from "./play-view.ts";
import { createFlappyRenderer } from "./renderer.ts";
import { FlappyDuelSession, type DuelSnapshot } from "./duel.ts";
import { PHYSICS } from "./physics.ts";

type CanvasRenderer = Awaited<ReturnType<typeof createFlappyRenderer>>;

function winnerMessage(winner: "player" | "computer" | "tie"): string {
  if (winner === "player") return "Jij wint!";
  if (winner === "computer") return "De computer wint deze ronde.";
  return "Gelijkspel. Jullie score en overlevingstijd zijn gelijk.";
}

/** Mount a responsive, explicitly controlled human-versus-untrained duel. */
export async function mountFlappyDuelView(
  root: HTMLElement,
): Promise<{ dispose(): void }> {
  const documentRef = root.ownerDocument;
  const windowRef = documentRef.defaultView;
  if (!windowRef) throw new Error("Flappy duel view requires a browser window.");

  const style = documentRef.createElement("style");
  style.textContent = `
    .duel-page { max-width: 1120px; margin: 0 auto; padding: 0; }
    .duel-header { margin: 0 auto 8px; max-width: 760px; text-align: center; }
    .duel-header h1 { margin: .15em 0; font-size: clamp(26px, 2.5vw, 34px); line-height: 1.1; }
    .duel-header p { margin: 4px auto; line-height: 1.4; }
    .duel-stage { padding: clamp(12px, 2vw, 18px); }
    .duel-stage > .toolbar { margin: 8px 0; }
    .duel-status { text-align: center; min-height: 1.4em; margin: 6px 0 10px; line-height: 1.4; }
    .duel-fields { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px; }
    .duel-panel { min-width: 0; padding: 12px; text-align: center; }
    .duel-panel h2 { min-height: 1.4em; margin: 0 0 6px; font-size: 18px; }
    .duel-panel canvas { width: min(100%, 265px); margin: 0 auto; border: 1px solid var(--border); }
    .duel-side-summary { margin: 6px 0 0; font-size: 14px; }
    @media (max-width: 700px) {
      .duel-page { padding: 0; }
      .duel-header { text-align: left; }
      .duel-header p { margin-left: 0; }
      .duel-fields { grid-template-columns: minmax(0, 1fr); }
      .duel-panel canvas { width: min(100%, 265px); }
    }
  `;
  documentRef.head.append(style);

  root.innerHTML = `
    <main class="duel-page">
      <header class="duel-header">
        <p class="eyebrow">Flappy-uitdaging</p>
        <h1>Kan jij een ongetraind AI-model verslaan?</h1>
      </header>
      <section class="card duel-stage" aria-label="Flappy-wedstrijd">
        <div class="toolbar" role="group" aria-label="Wedstrijdbediening">
          <button id="duel-start" type="button" disabled>Start</button>
          <button id="duel-pause" type="button" class="secondary" aria-label="Pauzeer wedstrijd" disabled>Pauzeer</button>
          <button id="duel-restart" type="button" class="secondary" disabled>Opnieuw</button>
          <button id="duel-flap" type="button" class="secondary" aria-label="Flap: laat jouw vogel omhoog gaan" disabled>Flap</button>
        </div>
        <p id="duel-status" class="duel-status" role="status" aria-live="polite" aria-atomic="true">De speelvelden laden…</p>
        <div class="duel-fields">
          <article class="card duel-panel" aria-labelledby="duel-player-heading" data-duel-side="player">
            <h2 id="duel-player-heading">Jij <span class="badge">Mens</span></h2>
            <canvas id="duel-player-canvas" tabindex="0" aria-label="Jouw speelveld. Selecteer dit veld voor toetsenbordinvoer."></canvas>
            <p id="duel-player-summary" class="duel-side-summary" aria-live="off">Score: 0 · 0.0 s</p>
          </article>
          <article class="card duel-panel" aria-labelledby="duel-computer-heading" data-duel-side="computer">
            <h2 id="duel-computer-heading">Computer · niet getraind</h2>
            <canvas id="duel-computer-canvas" tabindex="-1" aria-label="Speelveld van de ongetrainde computer."></canvas>
            <p id="duel-computer-summary" class="duel-side-summary" aria-live="off">Score: 0 · 0.0 s</p>
          </article>
        </div>
        <p class="muted">Gebruik Spatie of ↑, of kies Flap. Een wedstrijd pauzeert zodra je dit venster verlaat.</p>
      </section>
    </main>
  `;

  const playerCanvas = root.querySelector<HTMLCanvasElement>("#duel-player-canvas");
  const computerCanvas = root.querySelector<HTMLCanvasElement>("#duel-computer-canvas");
  const startButton = root.querySelector<HTMLButtonElement>("#duel-start");
  const pauseButton = root.querySelector<HTMLButtonElement>("#duel-pause");
  const restartButton = root.querySelector<HTMLButtonElement>("#duel-restart");
  const flapButton = root.querySelector<HTMLButtonElement>("#duel-flap");
  const status = root.querySelector<HTMLElement>("#duel-status");
  const playerSummary = root.querySelector<HTMLElement>("#duel-player-summary");
  const computerSummary = root.querySelector<HTMLElement>("#duel-computer-summary");
  if (!playerCanvas || !computerCanvas || !startButton || !pauseButton || !restartButton ||
      !flapButton || !status || !playerSummary || !computerSummary) {
    style.remove();
    throw new Error("Flappy duel view could not create its required controls.");
  }

  const session = new FlappyDuelSession();
  let snapshot: DuelSnapshot = session.snapshot;
  let playerRenderer: CanvasRenderer | undefined;
  let computerRenderer: CanvasRenderer | undefined;
  let frameHandle: number | undefined;
  let lastTimestamp: number | undefined;
  let accumulatorMs = 0;
  let disposed = false;
  let loaded = false;
  const input = createFlappyInput({ button: flapButton, canvas: playerCanvas, window: windowRef, document: documentRef });

  const stopFrame = (): void => {
    if (frameHandle !== undefined) windowRef.cancelAnimationFrame(frameHandle);
    frameHandle = undefined;
    lastTimestamp = undefined;
    accumulatorMs = 0;
  };
  const setError = (error: unknown): void => {
    if (disposed) return;
    session.pause();
    stopFrame();
    input.reset();
    status.setAttribute("role", "alert");
    status.textContent = error instanceof Error ? error.message : String(error);
    startButton.disabled = true;
    pauseButton.disabled = true;
    restartButton.disabled = true;
    flapButton.disabled = true;
  };
  const updateSide = (
    worldSteps: number,
    pipesPassed: number,
    result: DuelSnapshot["playerResult"],
    summary: HTMLElement,
  ): void => {
    summary.textContent = result === undefined
      ? `Score: ${pipesPassed} · ${(worldSteps * PHYSICS.dt).toFixed(1)} s`
      : `Klaar · ${result.pipesPassed} · ${(result.survivalSteps * PHYSICS.dt).toFixed(1)} s`;
  };
  const showSnapshot = (next: DuelSnapshot): void => {
    if (next.playerWorld !== snapshot.playerWorld) playerRenderer?.render(next.playerWorld);
    if (next.computerWorld !== snapshot.computerWorld) computerRenderer?.render(next.computerWorld);
    snapshot = next;
    updateSide(next.playerWorld.steps, next.playerPipesPassed, next.playerResult, playerSummary);
    updateSide(next.computerWorld.steps, next.computerPipesPassed, next.computerResult, computerSummary);
    root.dataset.playerSteps = String(next.playerWorld.steps);
    root.dataset.computerSteps = String(next.computerWorld.steps);

    if (next.completion) {
      status.textContent = `${winnerMessage(next.completion.winner)} Jij: ${next.completion.player.pipesPassed} punten en ${(next.completion.player.survivalSteps * PHYSICS.dt).toFixed(1)} s. Computer: ${next.completion.computer.pipesPassed} punten en ${(next.completion.computer.survivalSteps * PHYSICS.dt).toFixed(1)} s.`;
      pauseButton.disabled = true;
      pauseButton.textContent = "Pauzeer";
      flapButton.disabled = true;
      return;
    }
    flapButton.disabled = next.phase !== "running" || next.playerResult !== undefined;
  };
  const setReadyStatus = (): void => {
    status.setAttribute("role", "status");
    status.textContent = "Klaar. Start de wedstrijd wanneer je wilt.";
  };
  const startLoop = (resume: boolean): void => {
    input.reset();
    snapshot = resume ? session.resume() : session.start();
    lastTimestamp = undefined;
    accumulatorMs = 0;
    startButton.disabled = true;
    pauseButton.disabled = false;
    restartButton.disabled = false;
    flapButton.disabled = snapshot.playerResult !== undefined;
    pauseButton.textContent = "Pauzeer";
    pauseButton.setAttribute("aria-label", "Pauzeer wedstrijd");
    status.setAttribute("role", "status");
    status.textContent = "De wedstrijd is gestart.";
    playerCanvas.focus({ preventScroll: true });
    playerCanvas.scrollIntoView({ block: "center", behavior: "instant" });
    frameHandle = windowRef.requestAnimationFrame(frame);
  };
  const step = (action: 0 | 1, timestamp: number): void => {
    const previous = snapshot;
    const next = session.step(action);
    if (action === 1) root.dataset.lastHumanInputAtMs = timestamp.toFixed(2);
    const playerJustFinished = previous.playerResult === undefined && next.playerResult !== undefined;
    const computerJustFinished = previous.computerResult === undefined && next.computerResult !== undefined;
    showSnapshot(next);
    if (playerJustFinished) input.reset();
    if (playerJustFinished && !next.completion) status.textContent = "Jouw vogel is uitgevallen. De computer speelt nog door.";
    else if (computerJustFinished && !next.completion) status.textContent = "De computer is uitgevallen. Jij kunt verder spelen.";
    if (next.completion) {
      stopFrame();
      startButton.disabled = true;
    }
  };
  const frame = (timestamp: number): void => {
    frameHandle = undefined;
    if (disposed || snapshot.phase !== "running") return;
    const deltaMs = lastTimestamp === undefined ? 0 : Math.max(0, timestamp - lastTimestamp);
    lastTimestamp = timestamp;
    root.dataset.lastFrameIntervalMs = deltaMs.toFixed(2);
    try {
      const advance = advanceFlappyFrame(
        deltaMs,
        accumulatorMs,
        () => snapshot.playerResult ? 0 : input.consumeAction(),
        (action) => step(action, timestamp),
      );
      accumulatorMs = advance.accumulatorMs;
    } catch (error) {
      setError(error);
      return;
    }
    if (snapshot.phase === "running") frameHandle = windowRef.requestAnimationFrame(frame);
  };
  const pauseForFocusLoss = (): void => {
    if (snapshot.phase !== "running") return;
    snapshot = session.pause();
    stopFrame();
    input.reset();
    flapButton.disabled = true;
    pauseButton.disabled = false;
    pauseButton.textContent = "Hervat";
    pauseButton.setAttribute("aria-label", "Hervat wedstrijd");
    status.textContent = "Gepauzeerd. Kies Hervat om door te gaan.";
  };
  const onStart = (): void => {
    if (!loaded || snapshot.phase !== "ready") return;
    startLoop(false);
  };
  const onPause = (): void => {
    if (snapshot.phase === "running") {
      snapshot = session.pause();
      stopFrame();
      input.reset();
      flapButton.disabled = true;
      pauseButton.textContent = "Hervat";
      pauseButton.setAttribute("aria-label", "Hervat wedstrijd");
      status.textContent = "Gepauzeerd. Kies Hervat om door te gaan.";
    } else if (snapshot.phase === "paused") {
      startLoop(true);
    }
  };
  const onRestart = (): void => {
    if (!loaded) return;
    stopFrame();
    input.reset();
    showSnapshot(session.restart());
    startLoop(true);
    status.textContent = "Een nieuwe wedstrijd is gestart.";
  };
  const onBlur = (): void => pauseForFocusLoss();
  const onVisibility = (): void => {
    if (documentRef.visibilityState === "hidden") pauseForFocusLoss();
  };

  startButton.addEventListener("click", onStart);
  pauseButton.addEventListener("click", onPause);
  restartButton.addEventListener("click", onRestart);
  windowRef.addEventListener("blur", onBlur);
  documentRef.addEventListener("visibilitychange", onVisibility);

  const [playerLoad, computerLoad] = await Promise.allSettled([
    createFlappyRenderer(playerCanvas),
    createFlappyRenderer(computerCanvas),
  ]);
  if (playerLoad.status === "fulfilled") playerRenderer = playerLoad.value;
  if (computerLoad.status === "fulfilled") computerRenderer = computerLoad.value;
  if (playerLoad.status === "rejected" || computerLoad.status === "rejected") {
    playerRenderer?.dispose();
    computerRenderer?.dispose();
    const failure = playerLoad.status === "rejected" ? playerLoad.reason :
      computerLoad.status === "rejected" ? computerLoad.reason : new Error("Unable to load duel renderer.");
    setError(failure);
  } else if (disposed) {
    playerRenderer?.dispose();
    computerRenderer?.dispose();
  } else {
    loaded = true;
    playerCanvas.style.width = "min(100%, 265px)";
    computerCanvas.style.width = "min(100%, 265px)";
    try {
      playerRenderer?.render(snapshot.playerWorld);
      computerRenderer?.render(snapshot.computerWorld);
      updateSide(snapshot.playerWorld.steps, snapshot.playerPipesPassed, undefined, playerSummary);
      updateSide(snapshot.computerWorld.steps, snapshot.computerPipesPassed, undefined, computerSummary);
      startButton.disabled = false;
      restartButton.disabled = false;
      setReadyStatus();
    } catch (error) {
      setError(error);
    }
  }

  return {
    dispose(): void {
      if (disposed) return;
      disposed = true;
      stopFrame();
      input.dispose();
      startButton.removeEventListener("click", onStart);
      pauseButton.removeEventListener("click", onPause);
      restartButton.removeEventListener("click", onRestart);
      windowRef.removeEventListener("blur", onBlur);
      documentRef.removeEventListener("visibilitychange", onVisibility);
      playerRenderer?.dispose();
      computerRenderer?.dispose();
      style.remove();
    },
  };
}
