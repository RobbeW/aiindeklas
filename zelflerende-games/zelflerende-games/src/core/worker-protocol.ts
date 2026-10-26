export interface StartMessage<Payload> {
  readonly type: "start";
  readonly jobId: string;
  readonly payload: Payload;
}

export interface PauseMessage {
  readonly type: "pause";
  readonly jobId: string;
}

export interface ResumeMessage {
  readonly type: "resume";
  readonly jobId: string;
}

export interface CancelMessage {
  readonly type: "cancel";
  readonly jobId: string;
}

export interface SpeedMessage {readonly type:"speed";readonly jobId:string;readonly speed:number;}

export type WorkerCommand<Payload = unknown> =
  | StartMessage<Payload>
  | PauseMessage
  | ResumeMessage
  | CancelMessage
  | SpeedMessage;

export interface ProgressMessage<Progress> {
  readonly type: "progress";
  readonly jobId: string;
  readonly progress: Progress;
}

export interface CompleteMessage<Result> {
  readonly type: "complete";
  readonly jobId: string;
  readonly result: Result;
}

export interface ErrorMessage {
  readonly type: "error";
  readonly jobId: string;
  readonly message: string;
  readonly code?: string;
}

export type WorkerEvent<Progress = unknown, Result = unknown> =
  | ProgressMessage<Progress>
  | CompleteMessage<Result>
  | ErrorMessage;

export interface WorkerMessageEvent {
  readonly data: unknown;
}

export interface WorkerErrorEvent {
  readonly message: string;
}

export type WorkerMessageListener = (event: WorkerMessageEvent) => void;
export type WorkerErrorListener = (event: WorkerErrorEvent) => void;

/** The small worker surface used by the client and deterministic fake workers. */
export interface WorkerPort {
  postMessage(message: WorkerCommand): void;
  addEventListener(type: "message", listener: WorkerMessageListener): void;
  addEventListener(type: "error", listener: WorkerErrorListener): void;
  removeEventListener(type: "message", listener: WorkerMessageListener): void;
  removeEventListener(type: "error", listener: WorkerErrorListener): void;
  terminate(): void;
}
