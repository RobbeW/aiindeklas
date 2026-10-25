import assert from "node:assert/strict";
import test from "node:test";
import { createSeededRandom } from "../src/core/random.ts";
import { generatePipeSequence } from "../src/flappy/sequence.ts";

test("seeded random streams and pipe sequences repeat", () => {
  assert.deepEqual(generatePipeSequence(41, 12), generatePipeSequence(41, 12));
  const first = createSeededRandom(41);
  const second = createSeededRandom(41);
  assert.deepEqual(Array.from({ length: 8 }, first), Array.from({ length: 8 }, second));
});

test("different seeds produce different pipe fixtures", () => {
  assert.notDeepEqual(generatePipeSequence(41, 20), generatePipeSequence(42, 20));
});

test("world sequences are independent of other instances and interleaving", () => {
  const a = generatePipeSequence(123, 15);
  const b = generatePipeSequence(987, 15);
  const randomA = createSeededRandom(123);
  const randomB = createSeededRandom(987);
  for (let i = 0; i < 15; i += 1) {
    randomB();
    randomA();
  }
  assert.deepEqual(generatePipeSequence(123, 15), a);
  assert.deepEqual(generatePipeSequence(987, 15), b);
});

test("seeds and counts must be finite safe integers in their valid ranges", () => {
  for (const seed of [NaN, Infinity, 1.5, Number.MAX_SAFE_INTEGER + 1]) {
    assert.throws(() => createSeededRandom(seed), RangeError);
    assert.throws(() => generatePipeSequence(seed, 1), RangeError);
  }
  for (const count of [-1, 1.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1]) {
    assert.throws(() => generatePipeSequence(0, count), RangeError);
  }
  assert.deepEqual(generatePipeSequence(0, 0), []);
});

test("pipe centers are bounded and sequence values are immutable", () => {
  const sequence = generatePipeSequence(2026, 100);
  assert.ok(Object.isFrozen(sequence));
  for (const [index, pipe] of sequence.entries()) {
    assert.equal(pipe.index, index);
    assert.ok(pipe.gapCenter >= 120 && pipe.gapCenter <= 320);
    assert.ok(Object.isFrozen(pipe));
    assert.throws(() => { (pipe as { gapCenter: number }).gapCenter = -1; }, TypeError);
  }
});
