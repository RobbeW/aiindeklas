import assert from "node:assert/strict";
import test from "node:test";
import {
  backpropagateLogit, BernoulliPolicy, createInitialPolicyParameters, deterministicPolicyAction,
  flattenPolicyParameters, INITIAL_OUTPUT_BIAS, policyLogProbability, policyProbability,
  samplePolicyAction, unflattenPolicyParameters,
} from "../src/learning/policy.ts";
import { createPolicySnapshot, restorePolicySnapshot } from "../src/learning/policy-snapshot.ts";

test("5-8-1 initialization, parameter ordering, and deterministic/sample actions", () => {
  const parameters = createInitialPolicyParameters(42);
  assert.equal(flattenPolicyParameters(parameters).length, 57);
  assert.equal(parameters.outputBias, INITIAL_OUTPUT_BIAS);
  assert.ok(Math.abs(policyProbability(parameters, [0, 0, 0, 0, 0]) - 0.08) < 1e-15);
  assert.deepEqual(createInitialPolicyParameters(42), parameters);
  assert.equal(deterministicPolicyAction(parameters, [1, 1, 1, 1, 1]), 0);
  assert.equal(samplePolicyAction(parameters, [0, 0, 0, 0, 0], () => 0.079), 1);
  assert.equal(samplePolicyAction(parameters, [0, 0, 0, 0, 0], () => 0.081), 0);
  assert.deepEqual(unflattenPolicyParameters(flattenPolicyParameters(parameters)), parameters);
});

test("known hand-computed network reference and stable extreme log probabilities", () => {
  const flat = Array<number>(57).fill(0);
  flat[0] = 0.5; // first hidden unit sees first feature
  flat[48] = 2; // first output weight
  flat[56] = -0.25;
  const parameters = unflattenPolicyParameters(flat);
  const input = [1, 0, 0, 0, 0];
  const expectedLogit = 2 * Math.tanh(0.5) - 0.25;
  const expectedProbability = 1 / (1 + Math.exp(-expectedLogit));
  assert.ok(Math.abs(policyProbability(parameters, input) - expectedProbability) < 1e-15);
  assert.ok(Math.abs(policyLogProbability(parameters, input, 1) - Math.log(expectedProbability)) < 1e-15);

  for (const bias of [-1000, 1000]) {
    const extreme = unflattenPolicyParameters([...Array<number>(56).fill(0), bias]);
    const p = policyProbability(extreme, [0, 0, 0, 0, 0]);
    assert.ok(Number.isFinite(p));
    assert.ok(Number.isFinite(policyLogProbability(extreme, [0, 0, 0, 0, 0], 0)));
    assert.ok(Number.isFinite(policyLogProbability(extreme, [0, 0, 0, 0, 0], 1)));
  }
});

test("raw logit gradient has W,b,v,c ordering and expected c derivative", () => {
  const parameters = unflattenPolicyParameters([...Array<number>(56).fill(0), 0]);
  const gradient = backpropagateLogit(parameters, [0.2, -0.4, 0.1, 0.5, -0.2], 0.75).values;
  assert.equal(gradient.length, 57);
  assert.ok(gradient.every((value) => Number.isFinite(value)));
  assert.ok(gradient.slice(0, 56).every((value) => value === 0));
  assert.equal(gradient[56], 0.75);

  const learned = unflattenPolicyParameters([
    ...Array.from({ length: 40 }, (_, index) => index < 5 ? 0.2 : 0),
    ...Array<number>(8).fill(0.1), ...Array<number>(8).fill(0.3), 0.2,
  ]);
  const nonzero = backpropagateLogit(learned, [0.2, -0.4, 0.1, 0.5, -0.2], -0.5).values;
  assert.equal(nonzero.length, 57);
  assert.ok(nonzero.slice(0, 56).some((value) => value !== 0));
  assert.equal(nonzero[56], -0.5);
});

test("snapshot JSON roundtrip restores an independent policy with provenance", () => {
  const live = new BernoulliPolicy(123);
  live.setParameters(unflattenPolicyParameters([...Array<number>(56).fill(0.01), -0.7]));
  const snapshot = createPolicySnapshot(live, {
    stage: "imitation", trainingSeeds: [1001, 1002], datasetProvenance: ["demo-set-v1"],
    trainingCounts: { supervisedUpdates: 17, reinforcementEpisodes: 0 },
  });
  const restored = restorePolicySnapshot(JSON.parse(JSON.stringify(snapshot)));
  const prediction = restored.probability([0.1, 0.2, 0.3, 0.4, 0.5]);
  live.setParameters(unflattenPolicyParameters([...Array<number>(56).fill(0.01), 1.2]));
  assert.equal(restored.probability([0.1, 0.2, 0.3, 0.4, 0.5]), prediction);
  assert.equal(snapshot.stage, "imitation");
  assert.deepEqual(snapshot.trainingSeeds, [1001, 1002]);
  assert.deepEqual(snapshot.datasetProvenance, ["demo-set-v1"]);
  assert.equal(snapshot.trainingCounts.supervisedUpdates, 17);
  assert.equal(restorePolicySnapshot(snapshot).parameters.outputBias, -0.7);
});

test("bad dimensions, non-finite values, and invalid random samples are rejected", () => {
  assert.throws(() => unflattenPolicyParameters([1, 2]), /57 finite values/);
  assert.throws(() => unflattenPolicyParameters([...Array<number>(56).fill(0), Number.NaN]), /finite values/);
  assert.throws(() => policyProbability(createInitialPolicyParameters(1), [0, 0]), /5 finite values/);
  assert.throws(() => samplePolicyAction(createInitialPolicyParameters(1), [0, 0, 0, 0, 0], () => 1), /\[0, 1\)/);
});
