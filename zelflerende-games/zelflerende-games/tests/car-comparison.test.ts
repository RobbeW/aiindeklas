import test from 'node:test';
import assert from 'node:assert/strict';
import { teachingLoop, fixtureCircuit } from './fixtures/circuits.ts';
import { compareCarLearning } from '../src/car/evolution-comparison.ts';
import { CarPolicy, createCarSnapshot } from '../src/car/policy-adapter.ts';
import { validateEvaluationRecord } from '../src/evaluation/records.ts';

const model = (stage: 'imitation' | 'post_rl' | 'evolution', budget = {}) =>
  createCarSnapshot(new CarPolicy(77), stage, budget);

test('compares immutable snapshots on the same fixed circuit identities and counts', () => {
  const imitation = model('imitation', { supervisedUpdates: 150, demonstrationSeconds: 13.5 });
  const postRl = model('post_rl', { supervisedUpdates: 150, reinforcementEpisodes: 16, interactions: 9000, wallTimeMs: 1000 });
  const evolution = model('evolution', { generations: 5, interactions: 10000 });
  const before = [JSON.stringify(imitation), JSON.stringify(postRl), JSON.stringify(evolution)];
  const circuits = [{ document: teachingLoop() }, { document: fixtureCircuit('long-loop') }];
  const records = compareCarLearning([imitation, postRl, evolution], circuits);

  assert.equal(records.length, 6);
  assert.deepEqual(records.slice(0, 2).map((r) => r.sequenceId), records.slice(2, 4).map((r) => r.sequenceId));
  assert.deepEqual(records.slice(0, 2).map((r) => r.seed), records.slice(2, 4).map((r) => r.seed));
  assert.deepEqual(records.slice(0, 2).map((r) => r.sequenceId), records.slice(4, 6).map((r) => r.sequenceId));
  assert.deepEqual(records.slice(0, 2).map((r) => r.seed), records.slice(4, 6).map((r) => r.seed));
  assert.equal(new Set(records.slice(0, 2).map((r) => r.sequenceId)).size, 2);
  assert.deepEqual(records.map((r) => r.modelId).filter((id, i) => i % 2 === 0).length, 3);
  assert.equal(records[0]!.budget.supervisedUpdates, 150);
  assert.equal(records[2]!.budget.trainingEpisodes, 16);
  assert.equal(records[2]!.budget.interactions, 9000);
  assert.equal(records[4]!.budget.generations, 5);
  assert.deepEqual([JSON.stringify(imitation), JSON.stringify(postRl), JSON.stringify(evolution)], before);
  assert.ok(Object.isFrozen(records) && Object.isFrozen(records[0]) && Object.isFrozen(records[0]!.result));
});

test('rejects another game, incompatible runtime versions, and mismatched final markers', () => {
  const imitation = model('imitation');
  assert.throws(() => compareCarLearning([({ kind: 'flappy-policy' } as unknown) as typeof imitation], [{ document: teachingLoop() }]), /snapshot kind/);
  assert.throws(() => compareCarLearning([({ ...imitation, worldVersion: 'other-world' } as unknown) as typeof imitation], [{ document: teachingLoop() }]), /versions/);
  assert.throws(() => compareCarLearning([imitation], [{ document: fixtureCircuit('unseen-bends') }]), /explicit/);
  assert.throws(() => compareCarLearning([imitation], [{ document: teachingLoop(), final: true }]), /final marker/);
  const invalidTrack = { ...teachingLoop(), version: 'other-circuit' } as unknown as ReturnType<typeof teachingLoop>;
  assert.throws(() => compareCarLearning([imitation], [{ document: invalidTrack }]), /Unsupported circuit version/);
});

test('allows a reserved final circuit only when both call and route explicitly opt in', () => {
  const records = compareCarLearning([model('imitation')], [{ document: fixtureCircuit('unseen-bends'), final: true }], true);
  assert.equal(records[0]!.mode, 'final');
  assert.equal(records[0]!.seed, 3000);
  assert.equal(validateEvaluationRecord(records[0]).sequenceId, records[0]!.sequenceId);
});
