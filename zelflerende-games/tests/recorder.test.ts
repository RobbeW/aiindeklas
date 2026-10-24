import assert from 'node:assert/strict';
import test from 'node:test';
import { DemonstrationRecorder } from '../src/flappy/recorder.ts';
import { FlappyEnvironment } from '../src/flappy/environment.ts';

test('records every pre-action wait/flap aligned with an independent replay', () => {
  const recorder = new DemonstrationRecorder();
  const replay = new FlappyEnvironment();
  recorder.start('trace', 1000); replay.reset({ seed: 1000 });
  const expected = [];
  for (let step = 0; ; step++) {
    const action = step === 8 ? 1 : 0;
    expected.push({ step, observation: replay.getObservation(), action });
    replay.step(action);
    if (recorder.step(action).done) break;
  }
  assert.deepEqual(recorder.completedEpisode?.frames, expected);
  assert.deepEqual(recorder.completedEpisode?.result, replay.completedResult);
  assert.equal(recorder.completedEpisode?.source, 'human');
  assert.ok(Object.isFrozen(recorder.completedEpisode?.frames));
  assert.throws(() => recorder.step(0), /new recording/);
});

test('a pause makes no sample and restart discards partial frames without mutating a saved episode', () => {
  const recorder = new DemonstrationRecorder();
  recorder.start('discard',1000); recorder.step(1);
  recorder.start('new',1001,'synthetic_reference');
  while (!recorder.step(0).done) { /* normal simulation steps */ }
  const saved = recorder.completedEpisode!;
  assert.equal(saved.frames[0]?.step,0);
  assert.equal(saved.frames[0]?.observation[0],0);
  assert.equal(saved.id,'new');
  recorder.start('later',1002);
  assert.equal(saved.id,'new');
  assert.equal(recorder.completedEpisode,undefined);
});
