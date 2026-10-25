import test from 'node:test';import assert from 'node:assert/strict';
import { generateReferencePair } from '../src/flappy/reference-demonstrations.ts';
import { BernoulliPolicy,flattenPolicyParameters } from '../src/learning/policy.ts';
import { createPolicySnapshot } from '../src/learning/policy-snapshot.ts';
import { runImitationJob } from '../src/learning/imitation-job.ts';
import { runPracticeJob } from '../src/learning/practice-job.ts';
import { evaluateFlappy } from '../src/evaluation/runner.ts';
test('actual record→imitation→reward practice→frozen comparison retains three distinct stages without test leakage',async()=>{
  const episodes=generateReferencePair(1000,2000);
  const initial=createPolicySnapshot(new BernoulliPolicy(1222),{stage:'initial'});
  const initialBefore=JSON.stringify(initial);
  const trained=await runImitationJob({initialSnapshot:initial,episodes,validationEpisodeIds:[episodes[1]!.id],updateBudget:250,optimizer:'adam',learningRate:.01,trainingSeed:1000},{yieldControl:async()=>{}});
  const saved=JSON.stringify(trained.snapshot);
  const practice=await runPracticeJob({snapshot:trained.snapshot,episodeBudget:4,stepBudget:7200,environmentSeed:1100,actionSeed:17000},{yieldControl:async()=>{}});
  assert.equal(JSON.stringify(initial),initialBefore);assert.equal(JSON.stringify(trained.snapshot),saved);
  assert.equal(trained.actualUpdates,250);assert.equal(practice.trainedEpisodes,4);
  assert.equal(practice.snapshot.supervisedOptimizer,'adam');
  assert.notDeepEqual(flattenPolicyParameters(practice.snapshot.parameters),flattenPolicyParameters(trained.snapshot.parameters));
  const seeds=[2030,2031,2032];
  for(const snapshot of [initial,trained.snapshot,practice.snapshot]){
    const records=evaluateFlappy(snapshot,seeds);
    assert.deepEqual(records.map(r=>r.seed),seeds);assert.equal(records.length,3);
    assert.ok(snapshot.trainingSeeds.every(s=>!seeds.includes(s)&&s<3000));
  }
  assert.deepEqual(trained.trainingSeeds,[1000]);assert.deepEqual(trained.validationSeeds,[2000]);
});
