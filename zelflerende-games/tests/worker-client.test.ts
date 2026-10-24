import assert from "node:assert/strict";
import test from "node:test";
import { WorkerClientDisposedError, WorkerJobCancelledError, WorkerJobClient, WorkerJobSupersededError } from "../src/core/worker-client.ts";
import type {
  WorkerCommand,
  WorkerErrorEvent,
  WorkerErrorListener,
  WorkerMessageEvent,
  WorkerMessageListener,
  WorkerPort,
} from "../src/core/worker-protocol.ts";

interface Payload { readonly seed: number }
interface Progress { readonly completed: number }
interface Result { readonly score: number }

// Compile-time check that a browser Worker can be passed to the same client factory.
function workerPortFromBrowserWorker(worker: Worker): WorkerPort { return worker; }
void workerPortFromBrowserWorker;

class FakeWorker implements WorkerPort {
  readonly sent: WorkerCommand[] = [];
  readonly messageListeners = new Set<WorkerMessageListener>();
  readonly errorListeners = new Set<WorkerErrorListener>();
  terminated = false;

  postMessage(message: WorkerCommand): void { this.sent.push(message); }
  addEventListener(type: "message", listener: WorkerMessageListener): void;
  addEventListener(type: "error", listener: WorkerErrorListener): void;
  addEventListener(type: "message" | "error", listener: WorkerMessageListener | WorkerErrorListener): void {
    if (type === "message") this.messageListeners.add(listener as WorkerMessageListener);
    else this.errorListeners.add(listener as WorkerErrorListener);
  }
  removeEventListener(type: "message", listener: WorkerMessageListener): void;
  removeEventListener(type: "error", listener: WorkerErrorListener): void;
  removeEventListener(type: "message" | "error", listener: WorkerMessageListener | WorkerErrorListener): void {
    if (type === "message") this.messageListeners.delete(listener as WorkerMessageListener);
    else this.errorListeners.delete(listener as WorkerErrorListener);
  }
  terminate(): void { this.terminated = true; }

  emit(data: unknown): void {
    const event: WorkerMessageEvent = { data };
    for (const listener of [...this.messageListeners]) listener(event);
  }

  emitError(message: string): void {
    const event: WorkerErrorEvent = { message };
    for (const listener of [...this.errorListeners]) listener(event);
  }
}

function setup() {
  const ports: FakeWorker[] = [];
  const client = new WorkerJobClient<Payload, Progress, Result>(() => {
    const port = new FakeWorker();
    ports.push(port);
    return port;
  });
  return { client, ports };
}

test("completes a job, reports progress and removes listeners", async () => {
  const { client, ports } = setup();
  const progress: Progress[] = [];
  const job = client.start({ seed: 4 }, (value) => progress.push(value));
  assert.deepEqual(ports[0]?.sent[0], { type: "start", jobId: job.jobId, payload: { seed: 4 } });
  ports[0]?.emit({ type: "progress", jobId: job.jobId, progress: { completed: 2 } });
  ports[0]?.emit({ type: "complete", jobId: job.jobId, result: { score: 9 } });
  assert.deepEqual(progress, [{ completed: 2 }]);
  assert.deepEqual(await job.promise, { score: 9 });
  assert.equal(ports[0]?.terminated, true);
  assert.equal(ports[0]?.messageListeners.size, 0);
});

test("cancel sends a cancel command, terminates the worker and rejects", async () => {
  const { client, ports } = setup();
  const job = client.start({ seed: 5 });
  client.cancel();
  assert.deepEqual(ports[0]?.sent[1], { type: "cancel", jobId: job.jobId });
  assert.equal(ports[0]?.terminated, true);
  await assert.rejects(job.promise, WorkerJobCancelledError);
});

test("supersedes the old job and ignores stale progress and completion", async () => {
  const { client, ports } = setup();
  const oldJob = client.start({ seed: 1 });
  const progress: Progress[] = [];
  const newJob = client.start({ seed: 2 }, (value) => progress.push(value));
  await assert.rejects(oldJob.promise, WorkerJobSupersededError);
  assert.equal(ports[0]?.terminated, true);
  ports[1]?.emit({ type: "progress", jobId: oldJob.jobId, progress: { completed: 10 } });
  ports[1]?.emit({ type: "complete", jobId: oldJob.jobId, result: { score: -1 } });
  assert.deepEqual(progress, []);
  ports[1]?.emit({ type: "complete", jobId: newJob.jobId, result: { score: 3 } });
  assert.deepEqual(await newJob.promise, { score: 3 });
});

test("rejects protocol errors and worker runtime errors", async (t) => {
  await t.test("protocol error", async () => {
    const { client, ports } = setup();
    const job = client.start({ seed: 6 });
    ports[0]?.emit({ type: "error", jobId: job.jobId, message: "invalid input" });
    await assert.rejects(job.promise, /invalid input/);
    assert.equal(ports[0]?.terminated, true);
  });

  await t.test("runtime error", async () => {
    const { client, ports } = setup();
    const job = client.start({ seed: 7 });
    ports[0]?.emitError("worker crashed");
    await assert.rejects(job.promise, /worker crashed/);
    assert.equal(ports[0]?.terminated, true);
  });
});

test("dispose rejects the active job, cleans up, and prevents later starts", async () => {
  const { client, ports } = setup();
  const job = client.start({ seed: 8 });
  client.dispose();
  await assert.rejects(job.promise, WorkerClientDisposedError);
  assert.equal(ports[0]?.terminated, true);
  assert.equal(ports[0]?.errorListeners.size, 0);
  assert.throws(() => client.start({ seed: 9 }), WorkerClientDisposedError);
});

test('visual speed targets only the active worker and rejects invalid speeds',async()=>{
 const {client,ports}=setup();
 client.setSpeed(2);assert.equal(ports.length,0);
 const job=client.start({seed:10});client.pause();client.setSpeed(.5);client.resume();client.setSpeed(8);
 assert.deepEqual(ports[0]!.sent.slice(1),[{type:'pause',jobId:job.jobId},{type:'speed',jobId:job.jobId,speed:.5},{type:'resume',jobId:job.jobId},{type:'speed',jobId:job.jobId,speed:8}]);
 for(const speed of [NaN,Infinity,0,9])assert.throws(()=>client.setSpeed(speed),RangeError);
 ports[0]!.emit({type:'complete',jobId:job.jobId,result:{score:1}});await job.promise;
 client.setSpeed(4);assert.equal(ports[0]!.sent.length,5);client.dispose();
});
