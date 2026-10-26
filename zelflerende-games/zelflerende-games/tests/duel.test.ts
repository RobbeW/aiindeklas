import assert from "node:assert/strict";
import test from "node:test";
import type { Controller } from "../src/core/contracts.ts";
import type { FlappyEpisodeResult } from "../src/flappy/environment.ts";
import {
  compareDuelResults,
  DUEL_OPPONENT_SEED,
  DUEL_SEQUENCE_SEED,
  FlappyDuelSession,
} from "../src/flappy/duel.ts";

function fixedController(action: 0 | 1): Controller<0 | 1> {
  return { selectAction: () => action };
}

function result(pipesPassed: number, survivalSteps: number): Readonly<FlappyEpisodeResult> {
  return Object.freeze({
    pipesPassed,
    survivalSteps,
    totalReward: survivalSteps * 0.01 + pipesPassed,
    terminationReason: "floor",
  });
}

test("both sides start from the same sequence and fixed physics", () => {
  const session = new FlappyDuelSession({ computerControllerFactory: () => fixedController(0) });
  const initial = session.snapshot;
  assert.equal(initial.playerWorld.steps, 0);
  assert.equal(initial.computerWorld.steps, 0);
  assert.deepEqual(initial.playerWorld.pipes, initial.computerWorld.pipes);
  assert.deepEqual(initial.playerWorld.bird, initial.computerWorld.bird);

  session.start();
  const stepped = session.step(0);
  assert.deepEqual(stepped.playerWorld, stepped.computerWorld);
  assert.equal(stepped.playerWorld.steps, 1);
});

test("a dead side freezes while the other continues and wins on survival time", () => {
  const session = new FlappyDuelSession({ computerControllerFactory: () => fixedController(1) });
  session.start();
  let snapshot = session.snapshot;
  while (!snapshot.playerResult && snapshot.playerWorld.steps < 100) snapshot = session.step(0);
  assert.ok(snapshot.playerResult);
  assert.equal(snapshot.computerResult, undefined);
  assert.equal(Object.isFrozen(snapshot.playerResult), true);

  const deadWorld = snapshot.playerWorld;
  const computerSteps = snapshot.computerWorld.steps;
  snapshot = session.step(0);
  assert.equal(snapshot.playerWorld, deadWorld);
  assert.equal(snapshot.computerWorld.steps, computerSteps + 1);

  while (snapshot.phase !== "finished" && snapshot.computerWorld.steps < 100) snapshot = session.step(0);
  assert.equal(snapshot.phase, "finished");
  assert.equal(snapshot.completion?.winner, "computer");
  assert.equal(snapshot.completion?.player.pipesPassed, snapshot.completion?.computer.pipesPassed);
  assert.ok((snapshot.completion?.computer.survivalSteps ?? 0) > (snapshot.completion?.player.survivalSteps ?? 0));
});

test("identical no-flap play ends in an exact tie with frozen side results", () => {
  const session = new FlappyDuelSession({ computerControllerFactory: () => fixedController(0) });
  session.start();
  let snapshot = session.snapshot;
  while (snapshot.phase !== "finished" && snapshot.playerWorld.steps < 100) snapshot = session.step(0);
  assert.equal(snapshot.phase, "finished");
  assert.equal(snapshot.completion?.winner, "tie");
  assert.deepEqual(snapshot.playerResult, snapshot.computerResult);
  assert.equal(Object.isFrozen(snapshot.playerResult), true);
  assert.equal(Object.isFrozen(snapshot.computerResult), true);
  assert.equal(Object.isFrozen(snapshot.completion), true);
});

test("pause does not advance either side or consume computer actions", () => {
  let computerActions = 0;
  const session = new FlappyDuelSession({
    computerControllerFactory: () => ({ selectAction: () => { computerActions += 1; return 0; } }),
  });
  session.start();
  const running = session.step(1);
  assert.equal(computerActions, 1);
  const paused = session.pause();
  assert.equal(paused.phase, "paused");
  assert.equal(session.step(1).playerWorld, running.playerWorld);
  assert.equal(computerActions, 1);
  assert.equal(session.resume().phase, "running");
  assert.equal(session.step(0).playerWorld.steps, running.playerWorld.steps + 1);
  assert.equal(computerActions, 2);
});

test("restart clears both sides and recreates the same seeded opponent", () => {
  const receivedSeeds: number[] = [];
  const session = new FlappyDuelSession({
    computerControllerFactory: (seed) => {
      receivedSeeds.push(seed);
      return fixedController(0);
    },
  });
  assert.deepEqual(receivedSeeds, [DUEL_OPPONENT_SEED]);
  assert.equal(DUEL_SEQUENCE_SEED, 2000);
  session.start();
  session.step(1);
  const restarted = session.restart();
  assert.equal(restarted.phase, "running");
  assert.equal(restarted.playerWorld.steps, 0);
  assert.equal(restarted.computerWorld.steps, 0);
  assert.equal(restarted.playerResult, undefined);
  assert.equal(restarted.computerResult, undefined);
  assert.equal(restarted.completion, undefined);
  assert.deepEqual(restarted.playerWorld.pipes, restarted.computerWorld.pipes);
  assert.deepEqual(receivedSeeds, [DUEL_OPPONENT_SEED, DUEL_OPPONENT_SEED]);
});

test("winner compares pipe score before survival time, and exact ties stay ties", () => {
  assert.equal(compareDuelResults(result(3, 40), result(2, 500)), "player");
  assert.equal(compareDuelResults(result(2, 41), result(2, 40)), "player");
  assert.equal(compareDuelResults(result(2, 40), result(2, 40)), "tie");
});
