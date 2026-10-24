import { DemonstrationRecorder } from "./flappy/recorder.ts";
import { BernoulliPolicy } from "./learning/policy.ts";
import { createPolicySnapshot } from "./learning/policy-snapshot.ts";
import type { ImitationJobInput, ImitationProgress, ImitationJobResult } from "./learning/imitation-job.ts";
import type { WorkerEvent } from "./core/worker-protocol.ts";

const status = document.querySelector<HTMLPreElement>("#status")!;
const startButton = document.querySelector<HTMLButtonElement>("#start")!;
const cancelButton = document.querySelector<HTMLButtonElement>("#cancel")!;
let worker: Worker | undefined;
let heartbeat = 0;
let beats = 0;
let startedAt = 0;
const timer = window.setInterval(() => { beats += 1; const now = performance.now(); const elapsed = Math.round(now - heartbeat); heartbeat = now; status.textContent = `${status.textContent?.split("\n")[0] ?? "Running"}\nMain-thread heartbeat: ${beats} (${elapsed} ms since last beat)`; }, 250);
heartbeat = performance.now();

function syntheticEpisode(id: string, seed: number) {
  const recorder = new DemonstrationRecorder();
  recorder.start(id, seed, "synthetic_reference");
  for (let step = 0; step < 1800 && !recorder.completedEpisode; step += 1) {
    // Deterministic alternating actions intentionally make a tiny mixed-label fixture.
    recorder.step(step % 2 as 0 | 1);
  }
  if (!recorder.completedEpisode) throw new Error("Synthetic episode did not terminate within the horizon");
  return recorder.completedEpisode;
}

startButton.addEventListener("click", () => {
  if (worker) return;
  try {
    const payload: ImitationJobInput = {
      initialSnapshot: createPolicySnapshot(new BernoulliPolicy(18), { stage: "initial" }),
      episodes: [syntheticEpisode("synthetic-training", 1000), syntheticEpisode("synthetic-validation", 2000)],
      validationEpisodeIds: ["synthetic-validation"], updateBudget: 1000, trainingSeed: 1001,
    };
    worker = new Worker(new URL("./workers/imitation.worker.ts", import.meta.url), { type: "module" });
    startedAt = performance.now(); beats = 0; heartbeat = performance.now();
    startButton.disabled = true; cancelButton.disabled = false;
    status.textContent = "Worker started; synthetic recorder episodes generated on the main thread…";
    worker.addEventListener("message", (event: MessageEvent<WorkerEvent<ImitationProgress, ImitationJobResult>>) => {
      const message = event.data;
      if (message.type === "progress") status.textContent = `Progress ${message.progress.completedUpdates}/${message.progress.updateBudget}; training BCE ${message.progress.training.loss.toFixed(4)}; validation BCE ${message.progress.validation.loss.toFixed(4)}\nMain-thread heartbeat: ${beats} (${Math.round(performance.now() - heartbeat)} ms since last beat)`;
      else if (message.type === "complete") status.textContent = `Complete: ${message.result.actualUpdates} updates in ${Math.round(performance.now() - startedAt)} ms; training episodes ${message.result.trainingEpisodeIds.join(", ")}; validation episodes ${message.result.validationEpisodeIds.join(", ")}.\nMain-thread heartbeat continued: ${beats} beats.`;
      else status.textContent = `Worker error (${message.code ?? "error"}): ${message.message}`;
      if (message.type !== "progress") cleanup();
    });
    worker.addEventListener("error", (event) => { status.textContent = `Worker error: ${event.message}`; cleanup(); });
    worker.postMessage({ type: "start", jobId: "diagnostic-job", payload });
  } catch (error) { status.textContent = `Setup error: ${error instanceof Error ? error.message : String(error)}`; cleanup(); }
});
cancelButton.addEventListener("click", () => {
  if (!worker) return;
  worker.postMessage({ type: "cancel", jobId: "diagnostic-job" });
  status.textContent = `Cancelled by user; worker terminated. Main-thread heartbeat continued: ${beats} beats.`;
  cleanup();
});
function cleanup() { worker?.terminate(); worker = undefined; startButton.disabled = false; cancelButton.disabled = true; }
window.addEventListener("pagehide", () => { cleanup(); window.clearInterval(timer); });

