import assert from "node:assert/strict";
import test from "node:test";
import { BernoulliPolicy } from "../src/learning/policy.ts";
import { createPolicySnapshot } from "../src/learning/policy-snapshot.ts";
import { FlappyArenaSession, rankArenaResults } from "../src/flappy/arena-session.ts";
import { createWorld } from "../src/flappy/world.ts";
import { FlappyEnvironment } from "../src/flappy/environment.ts";

const makeSnapshot = (stage: "initial" | "imitation" | "post_rl" = "post_rl") => {
  return createPolicySnapshot(new BernoulliPolicy(71), { stage });
};

test("starts four independently stepped worlds with matching seeded geometry", () => {
  const session = new FlappyArenaSession(makeSnapshot(), 24);
  const initial = session.snapshot;
  assert.equal(initial.phase, "ready");
  assert.deepEqual(initial.participants.map((p) => p.id), ["p1", "p2", "p3", "ai"]);
  for (const participant of initial.participants) assert.deepEqual(participant.world, createWorld(24));
  const previous = initial.participants[0]!.world;
  const next = session.start();
  assert.equal(next.phase, "running");
  const stepped = session.step([1, 0, 1]);
  assert.deepEqual(stepped.participants.map((p) => p.world.steps), [1, 1, 1, 1]);
  assert.equal(previous.steps, 0);
  assert.notEqual(stepped.participants[0]!.world.bird.velocityY, stepped.participants[1]!.world.bird.velocityY);
  assert.notDeepEqual(stepped.participants[0]!.world.bird, stepped.participants[1]!.world.bird);
  assert.ok(Object.isFrozen(stepped) && Object.isFrozen(stepped.participants) && Object.isFrozen(stepped.participants[0]));
});

test("pause freezes every world and resume advances the shared clock", () => {
  const session = new FlappyArenaSession(makeSnapshot(), 25);
  session.start();
  session.step([0, 1, 0]);
  const paused = session.pause();
  const unchanged = session.step([1, 1, 1]);
  assert.equal(unchanged.phase, "paused");
  assert.deepEqual(unchanged.participants.map((p) => p.world.steps), [1, 1, 1, 1]);
  session.resume();
  assert.deepEqual(session.step([0, 0, 0]).participants.map((p) => p.world.steps), [2, 2, 2, 2]);
  assert.equal(paused.phase, "paused");
});

test("finished worlds retain results, stop stepping, and finish only after all four terminate", () => {
  const session = new FlappyArenaSession(makeSnapshot(), 26);
  session.start();
  let frame = session.snapshot;
  for (let step = 0; step < 1800 && frame.phase !== "finished"; step += 1) frame = session.step([0, 0, 0]);
  assert.equal(frame.phase, "finished");
  assert.ok(frame.participants.every((participant) => participant.result !== undefined));
  const terminalSteps = frame.participants.map((participant) => participant.world.steps);
  const terminalResults = frame.participants.map((participant) => participant.result);
  assert.deepEqual(session.step([1, 1, 1]).participants.map((p) => p.world.steps), terminalSteps);
  assert.deepEqual(session.snapshot.participants.map((p) => p.result), terminalResults);
});

test("repeated sessions are deterministic and leave the immutable policy snapshot untouched", () => {
  const snapshot = makeSnapshot();
  const before = JSON.stringify(snapshot);
  const run = () => {
    const session = new FlappyArenaSession(snapshot, 27);
    session.start();
    let frame = session.snapshot;
    for (let step = 0; step < 50; step += 1) frame = session.step([step % 2 as 0 | 1, 0, 1]);
    return frame.participants.map(({ world, score }) => ({ world, score }));
  };
  assert.deepEqual(run(), run());
  assert.equal(JSON.stringify(snapshot), before);
});

test("rank ties share competition rank and lower scores follow", () => {
  assert.deepEqual(rankArenaResults([
    { id: "p1", score: 3, survivalSteps: 20 },
    { id: "p2", score: 4, survivalSteps: 10 },
    { id: "p3", score: 3, survivalSteps: 20 },
    { id: "ai", score: 1, survivalSteps: 80 },
  ]).map(({ id, rank }) => [id, rank]), [["p2", 1], ["p1", 2], ["p3", 2], ["ai", 4]]);
  assert.deepEqual(rankArenaResults([
    { id: "p1", score: 2, survivalSteps: 20 }, { id: "p2", score: 2, survivalSteps: 20 },
    { id: "p3", score: 1, survivalSteps: 1 }, { id: "ai", score: 0, survivalSteps: 0 },
  ]).map(({ rank }) => rank), [1, 1, 3, 4]);
});

test("validates stage, seed and action tuple", () => {
  assert.throws(() => new FlappyArenaSession(makeSnapshot("imitation"), 1), /post_rl/);
  assert.throws(() => new FlappyArenaSession(makeSnapshot(), NaN), /seed/);
  const session = new FlappyArenaSession(makeSnapshot(), 1);
  session.start();
  assert.throws(() => session.step([0, 1] as never), /tuple/);
  assert.throws(() => session.step([0, 2, 0] as never), /tuple/);
});
test('arena preserves ordinary physics and authoritative scores while a surviving player continues',()=>{
 const session=new FlappyArenaSession(makeSnapshot(),4000),reference=new FlappyEnvironment();reference.reset({seed:4000});session.start();
 let endedSteps:number|undefined;
 for(let step=0;step<1800;step++){
  const o=reference.getObservation(),gap=(o[3]!+o[4]!)/2;
  const action=(o[0]!>gap+.02&&o[1]!>=0?1:0) as 0|1;
  const expected=reference.step(action),actual=session.step([action,0,0]);
  assert.deepEqual(actual.participants[0]!.world,reference.world);
  assert.equal(actual.participants[0]!.score,reference.pipesPassed);
  const second=actual.participants[1]!;
  if(second.result){endedSteps??=second.world.steps;assert.equal(second.world.steps,endedSteps);}
  if(expected.done){assert.deepEqual(actual.participants[0]!.result,expected.result);break;}
 }
 assert.ok(reference.pipesPassed>0);assert.ok(session.snapshot.participants[0]!.world.steps>endedSteps!);
});
