import test from "node:test";
import assert from "node:assert/strict";
import { createUntrainedController } from "../src/flappy/baseline.ts";
import { generatePipeSequence } from "../src/flappy/sequence.ts";

const observation = [0, 0, 0.5, -0.3, 0.3] as const;

test("untrained controller repeats its own seeded action stream", () => {
  const a = createUntrainedController(50);
  const b = createUntrainedController(50);
  const traceA = Array.from({ length: 500 }, () => a.selectAction(observation));
  const traceB = Array.from({ length: 500 }, () => b.selectAction(observation));
  assert.deepEqual(traceA, traceB);
  assert.ok(traceA.includes(0) && traceA.includes(1));
  assert.match(a.label, /Ongetraind/);
});

test("policy choices never change obstacle sequences", () => {
  const before = generatePipeSequence(1003, 20);
  const controller = createUntrainedController(1003);
  for (let i = 0; i < 500; i++) controller.selectAction(observation);
  assert.deepEqual(generatePipeSequence(1003, 20), before);
});

test("probability limits and malformed observations are explicit", () => {
  assert.equal(createUntrainedController(1, 0).selectAction(observation), 0);
  assert.equal(createUntrainedController(1, 1).selectAction(observation), 1);
  for (const p of [-0.1, 1.1, NaN, Infinity]) assert.throws(() => createUntrainedController(1, p));
  assert.throws(() => createUntrainedController(1).selectAction([0]));
  assert.throws(() => createUntrainedController(1).selectAction([NaN, 0, 0, 0, 0]));
});
