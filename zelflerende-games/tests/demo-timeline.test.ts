import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { DEMO_SCENES, DemoTimeline } from '../src/demo/timeline.ts';

test('timeline carries time, loops and handles large deltas', () => {
  const timeline = new DemoTimeline();
  assert.equal(timeline.advance(8001).scene.id, 'f-untrained');
  assert.equal(timeline.snapshot.elapsedMs, 1);
  const total = DEMO_SCENES.reduce((n, scene) => n + scene.durationMs, 0);
  timeline.reset();
  assert.equal(timeline.advance(total * 10000 + 8001).loop, 10000);
  assert.equal(timeline.snapshot.elapsedMs, 1);
  assert.equal(DEMO_SCENES.find((scene) => scene.id === 'f-match')?.durationMs, 180000);
  assert.equal(DEMO_SCENES.find((scene) => scene.id === 'c-match')?.durationMs, 180000);
});
test('independent pauses discard elapsed time and next/reset work', () => {
  const timeline = new DemoTimeline();
  timeline.advance(25); timeline.pause('hidden'); timeline.pause('operator'); timeline.advance(5000);
  timeline.resume('hidden'); timeline.advance(1000);
  assert.equal(timeline.snapshot.elapsedMs, 25);
  timeline.resume('operator'); timeline.advance(10);
  assert.equal(timeline.snapshot.elapsedMs, 35);
  assert.equal(timeline.next().scene.id, 'f-untrained');
  assert.equal(timeline.reset().scene.id, 'f-intro');
  for (const value of [-1, Infinity, NaN]) assert.throws(() => timeline.advance(value));
});
