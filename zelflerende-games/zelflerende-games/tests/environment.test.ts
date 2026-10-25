import assert from "node:assert/strict";
import test from "node:test";
import { PHYSICS } from "../src/flappy/physics.ts";
import { generatePipeSequence, type PipeSpec } from "../src/flappy/sequence.ts";
import { FlappyEnvironment } from "../src/flappy/environment.ts";

const centeredSequence = (): readonly PipeSpec[] => Object.freeze(
  Array.from({ length: 20 }, (_, index) => Object.freeze({ index, gapCenter: 220 })),
);

test("reset returns the five normalized pre-action features in contract order", () => {
  const environment = new FlappyEnvironment({ sequence: centeredSequence() });
  const observation = environment.reset({ seed: 1 });
  assert.equal(observation.length, 5);
  assert.deepEqual(observation, [0, 0, (420 - 72) / 360, 2 * 150 / 440 - 1, 2 * 290 / 440 - 1]);
  assert.ok(observation.every((value) => Number.isFinite(value) && value >= -1 && value <= 1));
  assert.deepEqual(environment.getObservation(), observation);
});

test("crossings earn one point once and the finite horizon is explicit", () => {
  const environment = new FlappyEnvironment({ sequence: centeredSequence() });
  environment.reset({ seed: 10 });
  let result;
  let pointRewards = 0;
  for (let step = 0; step < 1800; step += 1) {
    const action = environment.world.bird.y > 235 ? 1 : 0;
    const transition = environment.step(action);
    if (transition.reward > 0.01) pointRewards += 1;
    if (transition.done) {
      result = transition.result;
      assert.equal(transition.reason, "time_limit");
      assert.equal(transition.reward, 0.01);
      break;
    }
  }
  assert.equal(result?.survivalSteps, 1800);
  assert.equal(result?.terminationReason, "time_limit");
  assert.equal(result?.pipesPassed, 15);
  assert.equal(environment.pipesPassed, 15);
  assert.equal(pointRewards, 15);
  assert.ok(Math.abs((result?.totalReward ?? 0) - 33) < 1e-9);
});

test("collision reward overrides alive reward and terminal result stays frozen", () => {
  const environment = new FlappyEnvironment({ sequence: centeredSequence() });
  environment.reset({ seed: 12 });
  let finalStep;
  while (finalStep === undefined) {
    const transition = environment.step(0);
    if (transition.done) finalStep = transition;
  }
  assert.equal(finalStep.reward, -1);
  assert.ok(finalStep.result);
  const saved = finalStep.result;
  assert.equal(environment.completedResult, saved);
  assert.ok(Object.isFrozen(saved));
  assert.throws(() => environment.step(0), /terminal/);

  environment.reset({ seed: 13 });
  assert.equal(environment.completedResult, undefined);
  assert.equal(saved.survivalSteps, finalStep.result?.survivalSteps);
  assert.equal(saved.totalReward, finalStep.result?.totalReward);
  assert.equal(environment.world.steps, 0);
});

test("seeded resets select their own sequences and validation is explicit", () => {
  const environment = new FlappyEnvironment();
  const first = environment.reset({ seed: 1 });
  const second = environment.reset({ seed: 2 });
  assert.notEqual(first[3], second[3]);
  assert.throws(() => environment.reset({ seed: NaN }), RangeError);
  assert.throws(() => environment.step(2 as 0 | 1), RangeError);
  const invalidFixture = generatePipeSequence(0, 19);
  assert.throws(() => new FlappyEnvironment({ sequence: invalidFixture }).reset({ seed: 1 }), RangeError);
});

test("world accessor exposes frozen snapshots without DOM or wall-clock inputs", () => {
  const environment = new FlappyEnvironment({ sequence: centeredSequence() });
  environment.reset({ seed: 9 });
  const previous = environment.getWorld();
  environment.step(1);
  assert.equal(previous.steps, 0);
  assert.equal(environment.world.steps, 1);
  assert.ok(Object.isFrozen(environment.world));
  assert.ok(environment.getObservation().every(Number.isFinite));
  assert.equal(PHYSICS.worldWidth, 360);
});
