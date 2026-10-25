import assert from 'node:assert/strict';
import test from 'node:test';
import { LearningCheckpoints } from '../src/learning/checkpoints.ts';
import { BernoulliPolicy } from '../src/learning/policy.ts';
import { createPolicySnapshot,restorePolicySnapshot } from '../src/learning/policy-snapshot.ts';
test('save-once named snapshots retain predictions and full provenance after live updates',()=>{
  const p=new BernoulliPolicy(7);const store=new LearningCheckpoints();
  const config={supervisedLearningRate:.01,reinforcementLearningRate:.001,gradientNormCap:1,batchSeed:42,actionSeeds:[8]};
  store.save(createPolicySnapshot(p,{stage:'initial'}),config);
  const saved=store.save(createPolicySnapshot(p,{stage:'imitation',trainingSeeds:[1000],datasetProvenance:['human:episode-1'],trainingCounts:{supervisedUpdates:3,reinforcementEpisodes:0}}),config);
  const before=JSON.stringify(saved);const probability=restorePolicySnapshot(saved.snapshot).probability([0,0,0,0,0]);
  p.setParameters({...p.parameters,outputBias:3});config.actionSeeds.push(9);
  assert.equal(JSON.stringify(saved),before);
  assert.equal(restorePolicySnapshot(saved.snapshot).probability([0,0,0,0,0]),probability);
  assert.equal(store.get('imitation'),saved);
  assert.throws(()=>store.save(saved.snapshot,config),/already saved/);
  assert.throws(()=>store.get('post_rl'),/missing/);
});
