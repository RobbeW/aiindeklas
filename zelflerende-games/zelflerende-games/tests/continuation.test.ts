import assert from "node:assert/strict";
import test from "node:test";
import { createPolicySnapshot } from "../src/learning/policy-snapshot.ts";
import { BernoulliPolicy, flattenPolicyParameters } from "../src/learning/policy.ts";
import { continueImitationWithRL } from "../src/learning/continuation.ts";

test("RL continuation starts from exact imitation parameters and freezes the saved baseline", () => {
  const source = createPolicySnapshot(new BernoulliPolicy(31), {
    stage: "imitation", supervisedOptimizer: "adam", trainingSeeds: [1000, 1001],
    datasetProvenance: ["synthetic_reference:test-fixture"],
    trainingCounts: { supervisedUpdates: 3, reinforcementEpisodes: 0 },
  });
  const before = JSON.stringify(source);
  const observations = [[0, 0, 0.5, -0.2, 0.4], [0.1, 0.2, 0.3, -0.1, 0.5]] as const;
  const result = continueImitationWithRL(source, {
    rolloutSeeds: [1020, 1021, 1022], actionSeeds: [71, 72, 73],
    validationObservations: observations,
  });
  assert.deepEqual(result.preRlParameters, flattenPolicyParameters(source.parameters));
  assert.deepEqual(result.preRlPredictions, observations.map(o => new BernoulliPolicy(31, source.parameters).probability(o)));
  assert.equal(result.episodes.length, 3);
  assert.equal(result.update.episodes, 3);
  assert.equal(result.postRlSnapshot.trainingCounts.reinforcementEpisodes, 3);
  assert.equal(result.postRlSnapshot.supervisedOptimizer, "adam");
  assert.deepEqual(result.postRlSnapshot.trainingSeeds, [1000, 1001, 1020, 1021, 1022]);
  assert.equal(result.imitationSnapshotUnchanged, true);
  assert.equal(JSON.stringify(source), before);
  assert.ok(result.maxParameterDelta > 0);
  assert.notDeepEqual(result.postRlParameters, result.preRlParameters);
});

test("continuation enforces paired bounded training rollout seeds", () => {
  const source = createPolicySnapshot(new BernoulliPolicy(2), { stage: "imitation" });
  assert.throws(() => continueImitationWithRL(source, {
    rolloutSeeds: [2000], actionSeeds: [1], validationObservations: [[0, 0, 0, 0, 0]],
  }), /training rollout seeds/);
  assert.throws(() => continueImitationWithRL(source, {
    rolloutSeeds: [1000], actionSeeds: [], validationObservations: [[0, 0, 0, 0, 0]],
  }), /paired action/);
  assert.throws(() => continueImitationWithRL(source, {
    rolloutSeeds: Array.from({ length: 65 }, (_, i) => 1000 + i),
    actionSeeds: Array.from({ length: 65 }, (_, i) => i), validationObservations: [[0, 0, 0, 0, 0]],
  }), /paired action/);
});
