import test from 'node:test';
import assert from 'node:assert/strict';
import { CarPolicy, createCarSnapshot, restoreCarSnapshot, validateCarSnapshot } from '../src/car/policy-adapter.ts';

test('seeded initialization and categorical outputs are stable and deterministic', () => {
  const p = new CarPolicy(42), q = new CarPolicy(42), obs = [0.2, 0.4, 0.8, 0.1, 0.7, 0.5];
  assert.deepEqual(p.parameters, q.parameters);
  assert.equal(p.parameters.length, 83);
  assert.equal(p.parameters[80], 1);
  const probs = p.probabilities(obs);
  assert.equal(probs.length, 3);
  assert.ok(probs.every((x) => x >= 0 && x <= 1));
  assert.ok(Math.abs(probs.reduce((a, b) => a + b, 0) - 1) < 1e-14);
  assert.equal(p.action(obs), 0);
  assert.equal(p.sampleAction(obs, () => 0.5), 0);
  assert.throws(() => p.sampleAction(obs, () => 1), /\[0, 1\)/);
  const extreme = Array(83).fill(0); extreme[80] = 1000; extreme[81] = -1000;
  p.setParameters(extreme);
  assert.deepEqual(p.probabilities(obs), [1, 0, 0]);
  assert.equal(p.lossAndGradient(obs, 1).loss, 2000);
});

test('weighted loss gradient matches central differences for all 83 parameters', () => {
  const params = Array.from({ length: 83 }, (_, i) => Math.sin(i + 0.7) * 0.22 + 0.003);
  const obs = [0.17, 0.33, 0.51, 0.72, 0.84, 0.93], p = new CarPolicy(3, params);
  const analytic = p.lossAndGradient(obs, 2, 1.7);
  assert.equal(analytic.gradient.length, 83);
  const eps = 1e-5;
  for (let i = 0; i < 83; i++) {
    const plus = [...params], minus = [...params]; plus[i]! += eps; minus[i]! -= eps;
    p.setParameters(plus); const lp = p.lossAndGradient(obs, 2, 1.7).loss;
    p.setParameters(minus); const lm = p.lossAndGradient(obs, 2, 1.7).loss;
    const numeric = (lp - lm) / (2 * eps);
    assert.ok(Math.abs(numeric - analytic.gradient[i]!) < 2e-7, `parameter ${i}: ${numeric} vs ${analytic.gradient[i]}`);
  }
  assert.ok(analytic.gradient.some((x) => x < 0), 'negative weighted gradients are supported');
});

test('parameter copies and car snapshot roundtrip are immutable and versioned', () => {
  const p = new CarPolicy(8), first = p.parameters as number[];
  assert.throws(() => { first[0] = 900; }, TypeError);
  assert.notEqual(p.parameters[0], 900);
  const snapshot = createCarSnapshot(p, 'evolution', { sources: ['fixture'], trackIds: ['loop-1'], trainingSeeds: [4], generations: 2 });
  const canonical=validateCarSnapshot(structuredClone(snapshot));
  assert.deepEqual(canonical,snapshot);assert.ok(Object.isFrozen(canonical.parameters));
  assert.throws(()=>validateCarSnapshot({...snapshot,training:undefined}));
  const restored = restoreCarSnapshot(snapshot);
  assert.deepEqual(restored.parameters, p.parameters);
  assert.deepEqual(restored.probabilities([0, 0, 0, 0, 0, 0]), p.probabilities([0, 0, 0, 0, 0, 0]));
  assert.throws(() => { (snapshot.parameters as number[])[0] = 4; }, TypeError);
  for (const bad of [
    { ...snapshot, kind: 'bird-policy' }, { ...snapshot, schemaVersion: 2 },
    { ...snapshot, policyVersion: 'flappy-bernoulli-5-8-1-v1' }, { ...snapshot, inputCount: 5 },
    { ...snapshot, actionCount: 1 }, { ...snapshot, worldVersion: 'other' },
    { ...snapshot, parameters: Array(57).fill(0) },
  ]) assert.throws(() => validateCarSnapshot(bad));
  assert.throws(() => restoreCarSnapshot({ ...snapshot, kind: 'bird-policy' }));
});

test('rejects invalid observations, actions, and parameter values', () => {
  const p = new CarPolicy(0);
  for (const obs of [[0, 0, 0, 0, 0], [0, 0, 0, 0, 0, 1.1], [0, 0, 0, 0, 0, NaN]]) assert.throws(() => p.probabilities(obs));
  assert.equal(p.action([0, 0, 0, 0, 0, 0]), 0);
  assert.throws(() => p.lossAndGradient([0, 0, 0, 0, 0, 0], 3));
  assert.throws(() => p.setParameters(Array(83).fill(Infinity)));
});

test('legacy snapshots retain their world and reject mismatched normalization',()=>{
 const legacy=createCarSnapshot(new CarPolicy(8,undefined,'car-world-v1'),'imitation',{sources:['old'],supervisedUpdates:3});
 const roundtrip=createCarSnapshot(restoreCarSnapshot(structuredClone(legacy)),legacy.stage,legacy.training);
 assert.deepEqual(roundtrip,legacy);assert.equal(roundtrip.normalization.maxSpeed,55);
 const current=createCarSnapshot(new CarPolicy(8),'initial');assert.equal(current.normalization.maxSpeed,90);
 assert.throws(()=>validateCarSnapshot({...legacy,normalization:{rayRange:150,maxSpeed:90}}));
 assert.throws(()=>validateCarSnapshot({...current,normalization:{rayRange:150,maxSpeed:55}}));
});
