import test from "node:test";
import assert from "node:assert/strict";
import { DEMONSTRATION_VERSION, type DemonstrationEpisode } from "../src/data/demonstrations.ts";
import { FLAPPY_OBSERVATION_VERSION, FLAPPY_SEQUENCE_VERSION, FLAPPY_WORLD_CONFIG_VERSION } from "../src/flappy/environment.ts";
import { createPolicySnapshot } from "../src/learning/policy-snapshot.ts";
import { BernoulliPolicy, flattenPolicyParameters } from "../src/learning/policy.ts";
import { ImitationJobCancelledError, runImitationJob, type ImitationJobInput } from "../src/learning/imitation-job.ts";

function episode(id: string, seed: number, actions: readonly (0 | 1)[]): DemonstrationEpisode {
  return Object.freeze({ version: DEMONSTRATION_VERSION, id, source: "synthetic_reference", seed,
    worldVersion: FLAPPY_WORLD_CONFIG_VERSION, observationVersion: FLAPPY_OBSERVATION_VERSION, sequenceVersion: FLAPPY_SEQUENCE_VERSION,
    durationSeconds: actions.length / 60,
    frames: Object.freeze(actions.map((action, step) => Object.freeze({ step, action, observation: Object.freeze([0, 0, 0, 0, 0]) }))),
    result: Object.freeze({ survivalSteps: actions.length, totalReward: actions.length * 0.01, pipesPassed: 0, terminationReason: "floor" }),
  });
}
function input(overrides: Partial<ImitationJobInput> = {}): ImitationJobInput {
  const initialSnapshot = createPolicySnapshot(new BernoulliPolicy(17), { stage: "initial" });
  return { initialSnapshot, episodes: [episode("train", 1000, [0, 1]), episode("validation", 2000, [1, 0])],
    validationEpisodeIds: ["validation"], updateBudget: 4, trainingSeed: 1001, ...overrides };
}

test("imitation job is deterministic, reports disjoint full episode metrics, and preserves its input snapshot", async () => {
  const a = input(); const b = input();
  const before = flattenPolicyParameters(a.initialSnapshot.parameters);
  const [first, second] = await Promise.all([runImitationJob(a), runImitationJob(b)]);
  assert.deepEqual(first.parameters, second.parameters);
  assert.equal(first.optimizer, "sgd");
  assert.equal(first.snapshot.supervisedOptimizer, "sgd");
  assert.equal(first.actualUpdates, 4);
  assert.equal(first.training.sampleCount, 2); assert.equal(first.validation.sampleCount, 2);
  assert.deepEqual(first.trainingEpisodeIds, ["train"]); assert.deepEqual(first.validationEpisodeIds, ["validation"]);
  assert.ok(first.snapshot.datasetProvenance.includes("training:synthetic_reference:train"));
  assert.ok(first.snapshot.datasetProvenance.includes("validation:synthetic_reference:validation"));
  assert.notDeepEqual(flattenPolicyParameters(first.parameters), before);
  assert.deepEqual(flattenPolicyParameters(a.initialSnapshot.parameters), before);
});

test("explicit Adam is deterministic and recorded in optimizer provenance", async () => {
  const first = await runImitationJob(input({ optimizer: "adam" }));
  const second = await runImitationJob(input({ optimizer: "adam" }));
  assert.equal(first.optimizer, "adam");
  assert.equal(first.snapshot.supervisedOptimizer, "adam");
  assert.deepEqual(first.parameters, second.parameters);
});

test("rejects empty, corrupt, single-class, overlapping, and final-test data", async () => {
  await assert.rejects(runImitationJob(input({ episodes: [] })), /episodes/);
  await assert.rejects(runImitationJob(input({ episodes: [episode("train", 1000, [0, 1]), { ...episode("validation", 2000, [1, 0]), frames: [] }] })), /Invalid demonstration/);
  await assert.rejects(runImitationJob(input({ episodes: [episode("train", 1000, [0, 0]), episode("validation", 2000, [0, 0])] })), /single action class/);
  await assert.rejects(runImitationJob(input({ validationEpisodeIds: ["train"] })), /training episodes must use seeds/);
  await assert.rejects(runImitationJob(input({ episodes: [episode("train", 3000, [0, 1]), episode("validation", 2000, [1, 0])] })), /final-test/);
});

test("cancellation is observed between bounded updates and propagates as a cancellation error", async () => {
  let cancelled = false;
  await assert.rejects(runImitationJob(input(), { onProgress: (progress) => { if (progress.completedUpdates === 1) cancelled = true; }, isCancelled: () => cancelled }), ImitationJobCancelledError);
});

test("pause blocks updates until resumed", async () => {
  let paused = true;
  let yields = 0;
  const updates: number[] = [];
  const result = await runImitationJob(input({ updateBudget: 2 }), {
    isPaused: () => paused,
    yieldControl: async () => { yields += 1; if (yields === 2) paused = false; },
    onProgress: (progress) => updates.push(progress.completedUpdates),
  });
  assert.deepEqual(updates, [1, 2]);
  assert.equal(result.actualUpdates, 2);
  assert.equal(yields, 4);
});

test("job validation errors propagate to callers", async () => {
  await assert.rejects(runImitationJob(input({ updateBudget: 0 })), { name: "RangeError", message: /updateBudget/ });
});

