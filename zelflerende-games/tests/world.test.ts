import assert from "node:assert/strict";
import test from "node:test";
import { initialBirdState, PHYSICS } from "../src/flappy/physics.ts";
import { generatePipeSequence } from "../src/flappy/sequence.ts";
import {
  createWorld,
  detectPipeCollision,
  EPISODE_HORIZON_STEPS,
  FIRST_PIPE_X,
  getWorldTerminalReason,
  PIPE_GAP,
  PIPE_SPACING,
  PIPE_SPEED,
  PIPE_WIDTH,
  stepWorld,
  type WorldState,
} from "../src/flappy/world.ts";

const seq = (seed = 4) => generatePipeSequence(seed, 20);

test("createWorld precomputes the full horizon and stepWorld scrolls immutably", () => {
  const world = createWorld(4);
  assert.equal(world.steps, 0);
  assert.equal(world.pipes.length, 20);
  assert.equal(world.pipes[0].x, FIRST_PIPE_X);
  assert.equal(world.pipes[1].x, FIRST_PIPE_X + PIPE_SPACING);
  const next = stepWorld(world, 0);
  assert.equal(next.steps, 1);
  assert.equal(next.pipes[0].x, FIRST_PIPE_X - PIPE_SPEED * PHYSICS.dt);
  assert.equal(world.pipes[0].x, FIRST_PIPE_X);
  assert.ok(Object.isFrozen(world) && Object.isFrozen(world.pipes) && Object.isFrozen(next.pipes));
});

test("circle-to-pipe collision preserves the full safe gap", () => {
  const pipe = { index: 0, x: PHYSICS.birdX, gapCenter: 220 };
  assert.equal(detectPipeCollision({ y: 220, velocityY: 0 }, [pipe]), false);
  assert.equal(detectPipeCollision({ y: 220 - PIPE_GAP / 2 - PHYSICS.radius, velocityY: 0 }, [pipe]), true);
});

test("pipe rectangle contact includes edge and rounded corner tangency", () => {
  const sideTouch = { index: 0, x: PHYSICS.birdX + PHYSICS.radius, gapCenter: 300 };
  assert.equal(detectPipeCollision({ y: 230, velocityY: 0 }, [sideTouch]), true);
  const diagonal = Math.sqrt((PHYSICS.radius * PHYSICS.radius) / 2);
  const corner = { index: 0, x: PHYSICS.birdX + diagonal, gapCenter: 300 };
  assert.equal(detectPipeCollision({ y: 230 + diagonal, velocityY: 0 }, [corner]), true);
});

test("floor and ceiling edge contact are terminal; no clamping or reset occurs", () => {
  const base = createWorld(1);
  const atFloor: WorldState = Object.freeze({ ...base, bird: { y: PHYSICS.groundY - PHYSICS.radius, velocityY: 0 } });
  const atCeiling: WorldState = Object.freeze({ ...base, bird: { y: PHYSICS.radius, velocityY: 0 } });
  assert.equal(getWorldTerminalReason(atFloor), "floor");
  assert.equal(getWorldTerminalReason(atCeiling), "ceiling");
  assert.equal(stepWorld(atCeiling, 0).bird.y, PHYSICS.radius + 1000 / 3600);
});

test("same-seed worlds keep matching pipes despite independent panel stepping", () => {
  let a = createWorld(222);
  let b = createWorld(222);
  for (let i = 0; i < 73; i += 1) a = stepWorld(a, 0);
  for (let i = 0; i < 19; i += 1) b = stepWorld(b, 0);
  for (let i = 19; i < 73; i += 1) b = stepWorld(b, 0);
  assert.deepEqual(a.pipes, b.pipes);
  assert.equal(a.bird.y, b.bird.y);
});

test("seed, fixture, action and world state validation fail clearly", () => {
  assert.throws(() => createWorld(NaN), RangeError);
  assert.throws(() => createWorld(0, generatePipeSequence(1, 19)), RangeError);
  const wrongIndex = [...seq()];
  wrongIndex[2] = { index: 9, gapCenter: 220 };
  assert.throws(() => createWorld(0, wrongIndex), RangeError);
  assert.throws(() => stepWorld(createWorld(0), 2 as 0 | 1), RangeError);
  assert.throws(() => stepWorld({ ...createWorld(0), steps: -1 }, 0), RangeError);
});

test("time limit is explicit and further steps do not auto-reset", () => {
  const state: WorldState = Object.freeze({
    bird: initialBirdState(),
    steps: EPISODE_HORIZON_STEPS,
    pipes: Object.freeze(createWorld(0).pipes.map((pipe) => Object.freeze({ ...pipe, x: 10000 + pipe.x }))),
  });
  assert.equal(getWorldTerminalReason(state), "time_limit");
  assert.throws(() => stepWorld(state, 0), RangeError);
  assert.equal(state.steps, EPISODE_HORIZON_STEPS);
  assert.equal(PIPE_WIDTH, 52);
});
