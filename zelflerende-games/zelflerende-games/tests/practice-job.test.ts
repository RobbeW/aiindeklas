import assert from 'node:assert/strict';
import test from 'node:test';
import { runPracticeJob,PracticeCancelledError } from '../src/learning/practice-job.ts';
import { BernoulliPolicy } from '../src/learning/policy.ts';
import { createPolicySnapshot } from '../src/learning/policy-snapshot.ts';
import { FlappyEnvironment } from '../src/flappy/environment.ts';
const snapshot=()=>createPolicySnapshot(new BernoulliPolicy(8),{stage:'imitation',trainingSeeds:[1000],datasetProvenance:['synthetic_reference:test'],trainingCounts:{supervisedUpdates:1,reinforcementEpisodes:0}});
const input=()=>({snapshot:snapshot(),episodeBudget:5,stepBudget:10000,environmentSeed:1020,actionSeed:9000,batchSize:2});
test('headless attempts replay identically and preserve imitation while updating real episode counts',async()=>{
  const i=input(),before=JSON.stringify(i.snapshot);
  const a=await runPracticeJob(i,{yieldControl:async()=>{}}),b=await runPracticeJob(input(),{yieldControl:async()=>{}});
  assert.deepEqual(a.snapshot.parameters,b.snapshot.parameters);assert.equal(a.episodes,5);assert.equal(a.trainedEpisodes,5);
  assert.equal(JSON.stringify(i.snapshot),before);assert.equal(a.simulatedSeconds,a.steps/60);
  for(const replay of a.history){const env=new FlappyEnvironment();env.reset({seed:replay.seed});for(const action of replay.actions)env.step(action);assert.deepEqual(env.completedResult,replay.result);}
});
test('strict step limit never turns a partial attempt into reward-training data',async()=>{
  const r=await runPracticeJob({...input(),stepBudget:2},{yieldControl:async()=>{}});
  assert.equal(r.reason,'step_budget');assert.equal(r.steps,2);assert.equal(r.episodes,0);
  assert.deepEqual(r.snapshot.parameters,input().snapshot.parameters);
});
test('pause and cancellation are observed at bounded checkpoints',async()=>{
  let pause=true,yields=0;
  const r=await runPracticeJob({...input(),episodeBudget:1},{isPaused:()=>pause,yieldControl:async()=>{yields++;pause=false;}});
  assert.equal(r.episodes,1);assert.ok(yields>0);
  await assert.rejects(runPracticeJob(input(),{isCancelled:()=>true}),PracticeCancelledError);
  await assert.rejects(runPracticeJob({...input(),environmentSeed:3000}),/training seed/);
});
