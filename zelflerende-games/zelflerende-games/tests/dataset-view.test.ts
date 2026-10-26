import assert from 'node:assert/strict';
import test from 'node:test';
import { summarizeDataset } from '../src/data/dataset-view.ts';
import { DemonstrationRecorder } from '../src/flappy/recorder.ts';

function completed(seed: number, action: 0 | 1) {
  const recorder = new DemonstrationRecorder();
  recorder.start(`fixture-${seed}`, seed);
  while (!recorder.step(action).done) { /* complete the simulated episode */ }
  return recorder.completedEpisode!;
}

test('summarizes completed episodes and action balance without changing them', () => {
  const first = completed(1000, 0);
  const second = completed(1001, 1);
  const summary = summarizeDataset([first, second]);
  assert.equal(summary.episodeCount, 2);
  assert.equal(summary.simulatedSeconds, first.durationSeconds + second.durationSeconds);
  assert.equal(summary.waits, first.frames.length);
  assert.equal(summary.flaps, second.frames.length);
  assert.equal(summary.balance, 'mixed');
  assert.ok(Object.isFrozen(summary));
  assert.equal(first.frames.length > 0, true);
});

test('reports an empty collection explicitly', () => {
  assert.deepEqual(summarizeDataset([]), {
    episodeCount: 0,
    simulatedSeconds: 0,
    flaps: 0,
    waits: 0,
    balance: 'empty',
  });
});
