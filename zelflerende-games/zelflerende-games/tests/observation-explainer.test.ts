import test from 'node:test';
import assert from 'node:assert/strict';
import { createObservationExamples, renderObservationGeometry } from '../src/flappy/observation-examples.ts';
import { BernoulliPolicy, createInitialPolicyParameters } from '../src/learning/policy.ts';
import { createPolicySnapshot, restorePolicySnapshot } from '../src/learning/policy-snapshot.ts';
import { PHYSICS } from '../src/flappy/physics.ts';
import { PIPE_GAP } from '../src/flappy/world.ts';

test('observation examples are real frozen pre-action frames with five ordered inputs', () => {
  const examples = createObservationExamples();
  assert.ok(examples.length >= 3);
  assert.deepEqual(examples.map((e) => e.step), [60, 80, 100, 120, 140]);
  for (const example of examples) {
    assert.equal(example.observation.length, 5);
    assert.ok(example.observation.every((v) => Number.isFinite(v) && v >= -1 && v <= 1));
    assert.ok(example.height > 0 && example.height < 500);
    assert.ok(example.distance > 0);
    assert.ok(example.gapBottom > example.gapTop);
    assert.equal(example.gapBottom - example.gapTop, PIPE_GAP);
    assert.ok(Number.isFinite(example.verticalSpeed));
    assert.ok(example.action === 0 || example.action === 1);
  }
  assert.notDeepEqual(examples[0]?.observation, examples[2]?.observation);
});

test('start model keeps an observation-independent eight percent flap probability', () => {
  const policy = new BernoulliPolicy(1222, createInitialPolicyParameters(1222));
  const examples = createObservationExamples();
  for (const example of examples) assert.ok(Math.abs(policy.probability(example.observation) - 0.08) < 1e-12);
});

test('snapshot policy probability is computed from its restored frozen parameters', () => {
  const policy = new BernoulliPolicy(77, { ...createInitialPolicyParameters(77), outputBias: 0 });
  const snapshot = createPolicySnapshot(policy, { stage: 'imitation' });
  const p = restorePolicySnapshot(snapshot);
  const example = createObservationExamples()[1]!;
  assert.equal(p.probability(example.observation), 0.5);
  assert.equal(snapshot.stage, 'imitation');
});

test('selected measurement overlay follows current bird and opening geometry', () => {
  const examples = createObservationExamples();
  const first = examples[0]!;
  const later = examples[2]!;
  const svg = renderObservationGeometry(first, 3, 'bird.png');
  assert.ok(svg.includes(`x="${PHYSICS.birdX-18}" y="${first.height-13}"`));
  assert.match(svg, /viewBox="0 0 360 480"/);
  assert.match(svg, /class="sch-label">AI-model/);
  assert.equal((svg.match(/class="oe__overlay" hidden/g)??[]).length,4);
  assert.ok(!svg.includes('>M<'));
  assert.notEqual(renderObservationGeometry(first, 0, 'bird.png'), renderObservationGeometry(later, 0, 'bird.png'));
});
