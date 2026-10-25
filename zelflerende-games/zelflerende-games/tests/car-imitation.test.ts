import test from 'node:test';
import assert from 'node:assert/strict';
import { CarPolicy, createCarSnapshot } from '../src/car/policy-adapter.ts';
import { CarEpisodeRecorder, generateCarReferenceEpisode, splitCarEpisodes } from '../src/car/recorder.ts';
import { runCarImitationJob, CarImitationJobCancelledError } from '../src/car/imitation-job.ts';
import { fixtureCircuit, teachingLoop } from './fixtures/circuits.ts';
import { pointAtDistance } from '../src/tracks/route.ts';
import type { CarAction } from '../src/car/config.ts';

function drive(circuit: ReturnType<typeof teachingLoop>, seed: number, id: string, source: 'human' | 'synthetic_reference' = 'synthetic_reference') {
  const recorder = new CarEpisodeRecorder(circuit); recorder.start(id, seed, source);
  for (let i = 0; i < 1800; i++) {
    const env = recorder.environment, target = pointAtDistance(env.route, env.world.progress.bestDistance + 25), car = env.world.car;
    const error = Math.atan2(Math.sin(Math.atan2(target.y-car.y,target.x-car.x)-car.heading), Math.cos(Math.atan2(target.y-car.y,target.x-car.x)-car.heading));
    const action: CarAction = error > .04 ? 2 : error < -.04 ? 1 : 0;
    if (recorder.step(action).done) break;
  }
  return recorder.completedEpisode!;
}
const baseline = () => createCarSnapshot(new CarPolicy(77), 'initial');

test('trains bounded Adam imitation from a complete teaching and long-loop probe pair', async () => {
  const training = generateCarReferenceEpisode(teachingLoop(), 1001);
  const control = drive(fixtureCircuit('long-loop'), 2005, 'long-loop-2005');
  assert.equal(training.frames.length, 838);
  assert.equal(training.result.terminationReason, 'lap_complete');
  assert.equal(control.seed, 2005);
  const parts = splitCarEpisodes([training, control]);
  assert.deepEqual(parts.training.map(e => e.id), [training.id]);
  const initial = baseline(), result = await runCarImitationJob({ initialSnapshot: structuredClone(initial), episodes: structuredClone([training, control]), updateBudget: 150 });
  assert.equal(result.completedUpdates, 150);
  assert.ok(Number.isFinite(result.trainingLoss) && Number.isFinite(result.controlLoss));
  assert.ok(result.elapsedMs >= 0);
  assert.notDeepEqual(result.snapshot.parameters, initial.parameters);
  assert.ok(result.snapshot.parameters.every(Number.isFinite));
  assert.equal(result.snapshot.training.interactions, initial.training.interactions);
  assert.equal(result.snapshot.training.reinforcementEpisodes, initial.training.reinforcementEpisodes);
  assert.equal(result.snapshot.training.supervisedUpdates, 150);
  assert.deepEqual(result.snapshot.training.trainingSeeds, [1001]);
  assert.ok(result.snapshot.training.demonstrationSeconds > 0);
  assert.ok(result.snapshot.training.sources.every(s => s.includes(training.id)));
  assert.ok(result.snapshot.training.sources.every(s => !s.includes(control.id)));
  assert.ok(control.result.progressFraction >= 0 && control.result.progressFraction <= 1);
  assert.ok([0,1].includes(control.result.laps));
});

test('reports progress, excludes paused time, and cancellation rejects without a snapshot', async () => {
  const pair = [generateCarReferenceEpisode(teachingLoop(), 1002), drive(fixtureCircuit('long-loop'), 2006, 'control-2006')];
  const reports: number[] = []; let clock = 0, paused = false, pauseYields = 0;
  const result = await runCarImitationJob({ initialSnapshot: baseline(), episodes: pair, updateBudget: 2 }, {
    now: () => clock, isPaused: () => paused, onProgress: p => reports.push(p.completedUpdates),
    yieldControl: async () => { clock += 10; if (++pauseYields === 1) paused = true; else if (pauseYields === 3) paused = false; },
  });
  assert.deepEqual(reports, [1,2]); assert.equal(result.elapsedMs, 20);
  await assert.rejects(runCarImitationJob({ initialSnapshot: baseline(), episodes: pair, updateBudget: 10 }, { isCancelled: () => true }), CarImitationJobCancelledError);
});

test('rejects empty splits, reserved training tracks, final data, and invalid budgets', async () => {
  const training = generateCarReferenceEpisode(teachingLoop(), 1003);
  const control = drive(fixtureCircuit('long-loop'), 2007, 'control-2007');
  assert.throws(() => drive(fixtureCircuit('long-loop'), 1008, 'reserved-training-1008'), /reserved|validation/i);
  await assert.rejects(runCarImitationJob({ initialSnapshot: baseline(), episodes: [training], updateBudget: 1 }), /nonempty/i);
  await assert.rejects(runCarImitationJob({ initialSnapshot: baseline(), episodes: [training, control], updateBudget: 0 }), /updateBudget/i);
  await assert.rejects(runCarImitationJob({ initialSnapshot: baseline(), episodes: [training, control, { ...control, id: 'final', seed: 3005 }] as never, updateBudget: 1 }), /namespace|seed/i);
});
