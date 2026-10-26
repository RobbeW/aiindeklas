import assert from "node:assert/strict";
import test from "node:test";
import { checkBoundary, initialBirdState, PHYSICS, stepBird, type BirdState } from "../src/flappy/physics.ts";

const near = (actual: number, expected: number): void => assert.ok(Math.abs(actual - expected) < 1e-9, `${actual} != ${expected}`);

test("wait and flap traces follow flap, gravity, then integration", () => {
  const waited = stepBird(initialBirdState(), 0);
  near(waited.velocityY, 16.666666666666668);
  near(waited.y, 220.27777777777777);
  const flapped = stepBird(initialBirdState(), 1);
  near(flapped.velocityY, -313.3333333333333);
  near(flapped.y, 214.77777777777777);
});

test("fall velocity is capped and states are not mutated", () => {
  const input = Object.freeze({ y: 200, velocityY: 490 });
  const next = stepBird(input, 0);
  assert.equal(next.velocityY, PHYSICS.maxFallVelocity);
  near(next.y, 200 + 500 / 60);
  assert.deepEqual(input, { y: 200, velocityY: 490 });
  assert.ok(Object.isFrozen(next));
});

test("boundary contact includes exact bird edge contact", () => {
  assert.equal(checkBoundary({ y: PHYSICS.radius, velocityY: 0 }), "ceiling");
  assert.equal(checkBoundary({ y: PHYSICS.groundY - PHYSICS.radius, velocityY: 0 }), "floor");
  assert.equal(checkBoundary({ y: 220, velocityY: 0 }), null);
});

test("non-finite state values and invalid actions are rejected", () => {
  for (const badState of [
    { y: NaN, velocityY: 0 }, { y: 0, velocityY: Infinity }, { y: -Infinity, velocityY: 1 },
  ]) {
    assert.throws(() => stepBird(badState, 0), RangeError);
    assert.throws(() => checkBoundary(badState), RangeError);
  }
  for (const action of [-1, 2, NaN, 0.5] as number[]) {
    assert.throws(() => stepBird(initialBirdState(), action as 0 | 1), RangeError);
  }
});

test("fixed action trace is unchanged by simulated render schedules", () => {
  const actions = Array.from({ length: 60 }, (_, index) => index % 11 === 0 ? 1 : 0) as (0 | 1)[];
  const simulate = (renderHz: number): BirdState => {
    let state = initialBirdState();
    let simulationAccumulator = 0;
    let actionIndex = 0;
    for (let frame = 1; frame <= renderHz; frame += 1) {
      const previous = ((frame - 1) / renderHz) * 60;
      const current = (frame / renderHz) * 60;
      simulationAccumulator += current - previous;
      while (simulationAccumulator >= 1 && actionIndex < actions.length) {
        state = stepBird(state, actions[actionIndex]);
        actionIndex += 1;
        simulationAccumulator -= 1;
      }
    }
    while (actionIndex < actions.length) {
      state = stepBird(state, actions[actionIndex]);
      actionIndex += 1;
    }
    return state;
  };
  assert.deepEqual(simulate(30), simulate(60));
  assert.deepEqual(simulate(60), simulate(120));
});
