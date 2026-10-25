/// <reference lib="webworker" />
import { runImitationJob, type ImitationJobInput } from "../learning/imitation-job.ts";
import type { WorkerCommand, WorkerEvent } from "../core/worker-protocol.ts";

const scope = self as DedicatedWorkerGlobalScope;
let current: { id: string; cancelled: boolean; paused: boolean } | undefined;

scope.addEventListener("message", (event: MessageEvent<unknown>) => {
  const message = event.data as WorkerCommand<ImitationJobInput>;
  if (!message || typeof message !== "object" || typeof message.jobId !== "string") return;
  if (message.type === "start") {
    if (current) {
      scope.postMessage({ type: "error", jobId: message.jobId, code: "busy", message: "Worker already has an active job" } satisfies WorkerEvent);
      return;
    }
    const state = { id: message.jobId, cancelled: false, paused: false };
    current = state;
    void runImitationJob(message.payload, {
      isCancelled: () => state.cancelled,
      isPaused: () => state.paused,
      onProgress: (progress) => scope.postMessage({ type: "progress", jobId: state.id, progress } satisfies WorkerEvent),
    }).then((result) => {
      if (state.cancelled) return;
      scope.postMessage({ type: "complete", jobId: state.id, result } satisfies WorkerEvent);
    }).catch((error: unknown) => {
      if (state.cancelled) return;
      scope.postMessage({ type: "error", jobId: state.id, code: error instanceof Error ? error.name : "Error", message: error instanceof Error ? error.message : String(error) } satisfies WorkerEvent);
    }).finally(() => { if (current === state) current = undefined; });
    return;
  }
  if (!current || message.jobId !== current.id) return;
  if (message.type === "pause") current.paused = true;
  else if (message.type === "resume") current.paused = false;
  else if (message.type === "cancel") current.cancelled = true;
});

export {};
