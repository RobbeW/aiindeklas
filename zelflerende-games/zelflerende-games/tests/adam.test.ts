import assert from "node:assert/strict";
import test from "node:test";
import { AdamOptimizer } from "../src/learning/adam.ts";
import { POLICY_PARAMETER_COUNT } from "../src/learning/policy.ts";

test("Adam first and second updates match the bias-corrected scalar reference", () => {
  const optimizer = new AdamOptimizer();
  const parameters = Array<number>(POLICY_PARAMETER_COUNT).fill(1);
  const gradient = Array<number>(POLICY_PARAMETER_COUNT).fill(0);
  gradient[0] = 0.5;
  const first = optimizer.update(parameters, gradient, 0.01);
  const expected1 = 1 - 0.01 * 0.5 / (Math.sqrt(0.25) + 1e-8);
  assert.ok(Math.abs(first.parameters[0]! - expected1) < 1e-15);
  assert.equal(first.metrics.step, 1);
  const second = optimizer.update(first.parameters, gradient, 0.01);
  const m2 = 0.9 * 0.05 + 0.1 * 0.5;
  const v2 = 0.999 * 0.00025 + 0.001 * 0.25;
  const expected2 = expected1 - 0.01 * (m2 / (1 - 0.9 ** 2)) / (Math.sqrt(v2 / (1 - 0.999 ** 2)) + 1e-8);
  assert.ok(Math.abs(second.parameters[0]! - expected2) < 1e-15);
  assert.equal(second.metrics.step, 2);
});

test("Adam clips the raw global gradient before moments and rejects non-finite input without advancing", () => {
  const optimizer = new AdamOptimizer();
  const parameters = Array<number>(POLICY_PARAMETER_COUNT).fill(0);
  const gradient = Array<number>(POLICY_PARAMETER_COUNT).fill(0);
  gradient[0] = 3; gradient[1] = 4;
  const result = optimizer.update(parameters, gradient, 0.01);
  assert.equal(result.metrics.rawGradientNorm, 5);
  assert.equal(result.metrics.clippingScale, 0.2);
  assert.equal(result.metrics.clipped, true);
  assert.throws(() => optimizer.update(result.parameters, [Number.NaN, ...Array<number>(POLICY_PARAMETER_COUNT - 1).fill(0)], 0.01), /finite/);
  assert.equal(optimizer.steps, 1);
});

test('Adam supports an explicit83parameter vector without changing the default shape',()=>{
  const optimizer=new AdamOptimizer({parameterCount:83});
  const p=Array(83).fill(1),g=Array(83).fill(.1);
  const update=optimizer.update(p,g,.01);
  assert.equal(update.parameters.length,83);
  assert.ok(update.parameters.every(v=>Math.abs(v-.99)<1e-7));
  assert.throws(()=>optimizer.update(Array(57).fill(1),g,.01));
  assert.equal(optimizer.steps,1);
});
