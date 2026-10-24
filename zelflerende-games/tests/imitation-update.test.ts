import assert from "node:assert/strict";
import test from "node:test";
import {
  applyBoundedGradientDescent, computeSupervisedBatchGradient, updateSupervisedPolicy,
} from "../src/learning/imitation-update.ts";
import { backpropagateLogit, BernoulliPolicy, flattenPolicyParameters, unflattenPolicyParameters } from "../src/learning/policy.ts";
import type { DemonstrationFrame } from "../src/data/demonstrations.ts";

function frame(step: number, firstFeature: number, action: 0 | 1): DemonstrationFrame {
  return { step, observation: [firstFeature, 0, 0, 0, 0], action };
}

function loss(policy: BernoulliPolicy, frames: readonly DemonstrationFrame[]): number {
  return computeSupervisedBatchGradient(policy, frames).loss;
}

test("mean BCE matches hand oracle counts and the raw gradient", () => {
  const policy = new BernoulliPolicy(1);
  const fixture = Array<number>(57).fill(0);
  fixture[48] = 1;
  policy.setParameters(unflattenPolicyParameters(fixture));
  const batch = [frame(0, 1, 1), frame(1, 1, 1), frame(2, 1, 0)];
  const result = computeSupervisedBatchGradient(policy, batch);
  assert.ok(Math.abs(result.loss - Math.log(2)) < 1e-15);
  assert.equal(result.flapCount, 2);
  assert.equal(result.waitCount, 1);
  assert.equal(result.sampleCount, 3);
  assert.ok(Math.abs(result.gradient.values[0]! + 1 / 6) < 1e-15);
  assert.ok(Math.abs(result.gradient.values[40]! + 1 / 6) < 1e-15);
  assert.equal(result.gradient.values[48], 0);
  assert.ok(Math.abs(result.gradient.values[56]! + 1 / 6) < 1e-15);

  const singleFlapGradient = backpropagateLogit(policy.parameters, [1, 0, 0, 0, 0], -0.5).values;
  assert.equal(singleFlapGradient[0], -0.5);
  assert.equal(singleFlapGradient[40], -0.5);
  assert.equal(singleFlapGradient[56], -0.5);
});

test("central finite differences match raw gradients for all 57 parameters", () => {
  const policy = new BernoulliPolicy(9);
  const seeded = Array.from({ length: 57 }, (_, index) => Math.sin(index * 0.73 + 0.2) * 0.18);
  policy.setParameters(unflattenPolicyParameters(seeded));
  const batch = [
    { step: 0, observation: [0.7, -0.2, 0.4, 0.1, -0.6], action: 1 as const },
    { step: 1, observation: [-0.3, 0.8, -0.5, 0.2, 0.9], action: 0 as const },
    { step: 2, observation: [0.1, 0.4, 0.6, -0.7, 0.3], action: 1 as const },
  ];
  const analytic = computeSupervisedBatchGradient(policy, batch).gradient.values;
  const base = [...flattenPolicyParameters(policy.parameters)];
  const epsilon = 1e-5;
  for (let index = 0; index < 57; index += 1) {
    const plus = [...base];
    const minus = [...base];
    plus[index] += epsilon;
    minus[index] -= epsilon;
    const plusPolicy = new BernoulliPolicy(9, unflattenPolicyParameters(plus));
    const minusPolicy = new BernoulliPolicy(9, unflattenPolicyParameters(minus));
    const numerical = (loss(plusPolicy, batch) - loss(minusPolicy, batch)) / (2 * epsilon);
    assert.ok(Math.abs(analytic[index]! - numerical) < 2e-8, `parameter ${index}: analytic=${analytic[index]}, numeric=${numerical}`);
  }
});

test("global norm is clipped after aggregation and update uses default learning rate", () => {
  const policy = new BernoulliPolicy(2);
  policy.setParameters(unflattenPolicyParameters(Array<number>(57).fill(0)));
  const gradient = Array<number>(57).fill(0);
  gradient[56] = 3;
  const result = applyBoundedGradientDescent(policy, gradient);
  assert.equal(result.rawGradientNorm, 3);
  assert.equal(result.appliedGradientNorm, 1);
  assert.ok(Math.abs(result.clippingScale - 1 / 3) < 1e-15);
  assert.equal(result.clipped, true);
  assert.ok(Math.abs(policy.parameters.outputBias + 0.01) < 1e-15);
});

test("one mixed demonstration update lowers loss and reports actual class counts", () => {
  const policy = new BernoulliPolicy(3);
  const initial = Array<number>(57).fill(0);
  initial[0] = 0.4;
  initial[48] = 0.5;
  policy.setParameters(unflattenPolicyParameters(initial));
  const batch = [frame(0, 1, 1), frame(1, 1, 1), frame(2, -1, 0), frame(3, -1, 0)];
  const before = loss(policy, batch);
  const result = updateSupervisedPolicy(policy, batch);
  assert.equal(result.flapCount, 2);
  assert.equal(result.waitCount, 2);
  assert.equal(result.sampleCount, 4);
  assert.equal(result.clipped, false);
  assert.ok(loss(policy, batch) < before);
});

test("empty, single-class, malformed, and non-finite inputs fail explicitly", () => {
  const policy = new BernoulliPolicy(4);
  assert.throws(() => updateSupervisedPolicy(policy, []), /empty/);
  assert.throws(() => updateSupervisedPolicy(policy, [frame(0, 0, 0)]), /all_wait/);
  assert.throws(() => updateSupervisedPolicy(policy, [frame(0, 0, 1)]), /all_flap/);
  assert.throws(() => updateSupervisedPolicy(policy, [frame(0, 2, 1), frame(1, 0, 0)]), /invalid/);
  assert.throws(() => applyBoundedGradientDescent(policy, Array<number>(57).fill(Number.NaN)), /finite/);
});

test('a bounded run fits a tiny learnable mixed fixture without reweighting',()=>{
  const policy=new BernoulliPolicy(7);
  const frames=[frame(0,1,1),frame(1,-1,0)];
  for(let update=0;update<3000;update++) updateSupervisedPolicy(policy,frames);
  assert.ok(loss(policy,frames)<.02);
  assert.ok(policy.probability([1,0,0,0,0])>.98);
  assert.ok(policy.probability([-1,0,0,0,0])<.02);
});
