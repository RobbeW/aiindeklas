import { CAR_MAX_PLAYBACK_SPEED } from '../config/workload-presets.ts';
import type {
  CancelMessage,
  PauseMessage,
  ResumeMessage,
  StartMessage,
  WorkerErrorEvent,
  WorkerErrorListener,
  WorkerEvent,
  WorkerMessageEvent,
  WorkerMessageListener,
  WorkerPort,
} from "./worker-protocol.ts";

export interface WorkerJob<Progress, Result> {
  readonly jobId: string;
  readonly promise: Promise<Result>;
  readonly onProgress?: (progress: Progress) => void;
}

export class WorkerJobCancelledError extends Error {
  constructor(message = "Worker job cancelled") {
    super(message);
    this.name = "WorkerJobCancelledError";
  }
}

export class WorkerJobSupersededError extends Error {
  constructor() {
    super("Worker job superseded by a newer job");
    this.name = "WorkerJobSupersededError";
  }
}

export class WorkerClientDisposedError extends Error {
  constructor() {
    super("Worker client has been disposed");
    this.name = "WorkerClientDisposedError";
  }
}

interface ActiveJob<Payload, Progress, Result> {
  readonly id: string;
  readonly port: WorkerPort;
  readonly job: WorkerJob<Progress, Result>;
  readonly messageListener: WorkerMessageListener;
  readonly errorListener: WorkerErrorListener;
  readonly resolve: (result: Result) => void;
  readonly reject: (error: Error) => void;
}

/** Runs one job at a time, creating a fresh worker port for each job. */
export class WorkerJobClient<Payload, Progress, Result> {
  private nextJobNumber = 1;
  private active?: ActiveJob<Payload, Progress, Result>;
  private disposed = false;
  private readonly createPort: () => WorkerPort;

  constructor(createPort: () => WorkerPort) {
    this.createPort = createPort;
  }

  start(payload: Payload, onProgress?: (progress: Progress) => void): WorkerJob<Progress, Result> {
    if (this.disposed) throw new WorkerClientDisposedError();

    // Acquire first so a port-construction failure does not silently stop the current job.
    const port = this.createPort();
    this.stopActive(new WorkerJobSupersededError(), true);

    const jobId = `job-${this.nextJobNumber++}`;
    let resolve!: (result: Result) => void;
    let reject!: (error: Error) => void;
    const promise = new Promise<Result>((res, rej) => {
      resolve = res;
      reject = rej;
    });
    const job: WorkerJob<Progress, Result> = { jobId, promise, onProgress };

    const messageListener: WorkerMessageListener = (event: WorkerMessageEvent) => {
      const active = this.active;
      if (!active || active.id !== jobId) return;
      const message = event.data as WorkerEvent<Progress, Result>;
      if (!message || typeof message !== "object" || message.jobId !== jobId) return;

      if (message.type === "progress") {
        try {
          onProgress?.(message.progress);
        } catch (error) {
          this.fail(active, asError(error));
        }
      } else if (message.type === "complete") {
        this.finish(active, () => resolve(message.result));
      } else if (message.type === "error") {
        this.fail(active, new Error(message.message));
      }
    };
    const errorListener: WorkerErrorListener = (event: WorkerErrorEvent) => {
      const active = this.active;
      if (active?.id === jobId) this.fail(active, new Error(event.message || "Worker failed"));
    };
    const active: ActiveJob<Payload, Progress, Result> = {
      id: jobId,
      port,
      job,
      messageListener,
      errorListener,
      resolve,
      reject,
    };

    this.active = active;
    port.addEventListener("message", messageListener);
    port.addEventListener("error", errorListener);
    const startMessage: StartMessage<Payload> = { type: "start", jobId, payload };
    try {
      port.postMessage(startMessage);
    } catch (error) {
      this.fail(active, asError(error));
    }
    return job;
  }

  pause(): void {
    this.sendControl("pause");
  }

  resume(): void {
    this.sendControl("resume");
  }

  setSpeed(speed:number):void {
    if(!Number.isFinite(speed)||speed<.5||speed>CAR_MAX_PLAYBACK_SPEED)throw new RangeError("Visual speed must be .5..32");
    const active=this.active;if(!active)return;
    try{active.port.postMessage({type:"speed",jobId:active.id,speed});}catch(e){this.fail(active,asError(e));}
  }

  cancel(): void {
    const active = this.active;
    if (!active) return;
    const message: CancelMessage = { type: "cancel", jobId: active.id };
    try {
      active.port.postMessage(message);
    } catch {
      // Termination below still guarantees cancellation if the port has already failed.
    } finally {
      this.fail(active, new WorkerJobCancelledError());
    }
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.stopActive(new WorkerClientDisposedError(), true);
  }

  private sendControl(type: "pause" | "resume"): void {
    const active = this.active;
    if (!active) return;
    const message: PauseMessage | ResumeMessage = type === "pause"
      ? { type: "pause", jobId: active.id }
      : { type: "resume", jobId: active.id };
    try {
      active.port.postMessage(message);
    } catch (error) {
      this.fail(active, asError(error));
    }
  }

  private finish(active: ActiveJob<Payload, Progress, Result>, settle: () => void): void {
    if (this.active !== active) return;
    this.cleanup(active);
    settle();
  }

  private fail(active: ActiveJob<Payload, Progress, Result>, error: Error): void {
    if (this.active !== active) return;
    this.cleanup(active);
    active.reject(error);
  }

  private stopActive(error: Error, terminate: boolean): void {
    const active = this.active;
    if (!active) return;
    this.cleanup(active, terminate);
    active.reject(error);
  }

  private cleanup(active: ActiveJob<Payload, Progress, Result>, terminate = true): void {
    if (this.active === active) this.active = undefined;
    active.port.removeEventListener("message", active.messageListener);
    active.port.removeEventListener("error", active.errorListener);
    if (terminate) active.port.terminate();
  }
}

function asError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error));
}

