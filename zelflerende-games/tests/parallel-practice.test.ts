import assert from 'node:assert/strict';
import test from 'node:test';
import { createSeededRandom } from '../src/core/random.ts';
import { FlappyEnvironment } from '../src/flappy/environment.ts';
import type { WorldState } from '../src/flappy/world.ts';
import { BernoulliPolicy } from '../src/learning/policy.ts';
import { createPolicySnapshot, restorePolicySnapshot } from '../src/learning/policy-snapshot.ts';
import { runParallelPractice, ParallelPracticeCancelledError } from '../src/learning/parallel-practice.ts';
import { RewardTrainer } from '../src/learning/reward-trainer.ts';
import { DemonstrationRecorder } from '../src/flappy/recorder.ts';
import { runImitationJob } from '../src/learning/imitation-job.ts';
import { comparePracticeModels } from '../src/learning/practice-check.ts';
import type { RolloutEpisode, RolloutStep } from '../src/learning/rollout.ts';

function snapshot(){return createPolicySnapshot(new BernoulliPolicy(4),{stage:'imitation'});}
async function weakImitation(){
 const recorder=new DemonstrationRecorder();recorder.start('all-wait-11',1011,'human');
 while(!recorder.completedEpisode)recorder.step(0);
 return (await runImitationJob({initialSnapshot:createPolicySnapshot(new BernoulliPolicy(11),{stage:'initial'}),episodes:[recorder.completedEpisode!],validationEpisodeIds:[],allowTrainingOnly:true,updateBudget:250,optimizer:'adam',trainingSeed:1011})).snapshot;
}
const input=(extra:Partial<Parameters<typeof runParallelPractice>[0]>={})=>({snapshot:snapshot(),roundBudget:1,agentCount:6 as const,environmentSeed:1100,actionSeed:82,speed:1 as const,stepBudget:20_000,...extra});

test('multiple epochs retain every used training seed and honour the supplied start seed',async()=>{
 const result=await runParallelPractice(input({roundBudget:2,environmentSeed:1500}),{pace:false});
 assert.equal(result.completedRounds,2);assert.equal(result.trainedEpisodes,12);
 assert.deepEqual(result.snapshot.trainingSeeds,[...Array(6).fill(1500),...Array(6).fill(1501)]);
 assert.equal(result.roundHistory.length,2);
});

test('a complete shared-policy round updates once from every actual completed trajectory',async()=>{
  const source=snapshot(), original=JSON.stringify(source), progress: import('../src/learning/parallel-practice.ts').ParallelPracticeProgress[]=[];
  const result=await runParallelPractice({...input(),snapshot:source},{pace:false,onProgress:p=>progress.push(p)});
  assert.equal(result.reason,'round_budget');assert.equal(result.completedRounds,1);assert.equal(result.updates,1);
  assert.equal(result.trainedEpisodes,6);assert.equal(result.snapshot.trainingCounts.reinforcementEpisodes,6);
  assert.equal(result.roundHistory[0]?.attempts,6);assert.equal(JSON.stringify(source),original);
  assert.ok(progress.some(p=>p.phase==='updating'));
  // Match the existing updater against the exact six reproducible environment/action streams.
  const policy=restorePolicySnapshot(source), episodes:RolloutEpisode[]=[];
  for(let i=0;i<6;i++){
    const seed=1100, actionSeed=82+6+i, env=new FlappyEnvironment();let observation=env.reset({seed});const random=createSeededRandom(actionSeed);const trajectory:RolloutStep[]=[];
    for(;;){const action=policy.sampleAction(observation,random);const t=env.step(action);trajectory.push(Object.freeze({observation,action,reward:t.reward}));observation=t.observation;if(t.done&&t.result){episodes.push(Object.freeze({environmentSeed:seed,actionSeed,steps:Object.freeze(trajectory),result:t.result}));break;}}
  }
  new RewardTrainer().update(policy,episodes);
  const actual=Object.values(result.snapshot.parameters).flatMap(v=>Array.isArray(v)?v:[v as number]);
  const expected=Object.values(policy.parameters).flatMap(v=>Array.isArray(v)?v:[v as number]);
  assert.ok(actual.every((v,i)=>Math.abs(v-expected[i]!)<1e-15),'shared update must match the existing single-policy gradient update');
});

test('round agents share pipe geometry but have independent action streams',async()=>{
  const seen: {world:WorldState;done:boolean}[]=[];
  await runParallelPractice(input(),{pace:false,onProgress:p=>{if(p.phase==='collecting'&&p.birds.length)seen.push(...p.birds.map(b=>({world:b.world,done:b.done})));}});
  const first=seen.slice(0,6);assert.equal(first.length,6);
  assert.deepEqual(first[0]?.world.pipes.map(p=>p.gapCenter),first[5]?.world.pipes.map(p=>p.gapCenter));
  assert.ok(new Set(first.map(x=>x.world.bird.y)).size>1,'independent RNGs should produce different actions and trajectories');
});

test('a step-limited partial round trains complete birds only and respects hard bounds',async()=>{
  const result=await runParallelPractice(input({stepBudget:1}),{pace:false});
  assert.equal(result.reason,'step_budget');assert.equal(result.completedRounds,0);assert.equal(result.episodes,0);
  assert.equal(result.trainedEpisodes,0);assert.equal(result.snapshot.trainingCounts.reinforcementEpisodes,0);
  for(const overrides of [{roundBudget:1025},{agentCount:5},{speed:2},{stepBudget:44_236_801}])
    await assert.rejects(runParallelPractice(input(overrides as Partial<Parameters<typeof runParallelPractice>[0]>),{pace:false}),/Invalid finite/);
});

test('fast mode matches live outcomes and weights for identical seeded trajectories',async()=>{
 const fast=await runParallelPractice(input({mode:'fast',timeBudgetMs:600_000}),{pace:false});
 const live=await runParallelPractice(input({mode:'live'}),{pace:false});
 assert.deepEqual(fast.snapshot,live.snapshot);assert.deepEqual(fast.scoreHistory,live.scoreHistory);
 assert.equal(fast.meanScore,live.meanScore);assert.ok(fast.birds.length===0);
});

test('fast budgets support 256/1024 rounds and recover a zero-scoring imitation on separate frozen checks',async()=>{
 const source=await weakImitation(),original=JSON.stringify(source);
 for(const rounds of [256,1024]){
  let emissions=0,previous=0;
  const result=await runParallelPractice(input({snapshot:source,environmentSeed:1111,actionSeed:82011,roundBudget:rounds,mode:'fast',timeBudgetMs:600_000,stepBudget:44_236_800}),{pace:false,onProgress:p=>{
   emissions++;assert.equal(p.birds.length,0);assert.ok(p.completedRounds>=previous);previous=p.completedRounds;
  }});
  assert.equal(result.reason,'round_budget');assert.equal(result.completedRounds,rounds);assert.equal(result.trainedEpisodes,rounds*6);
  assert.ok(emissions<=Math.ceil(result.elapsedMs/100)+3,'fast updates must remain throttled to at most10per second plus initial/final');assert.ok(Object.values(result.snapshot.parameters).flatMap(v=>Array.isArray(v)?v:[v as number]).every(Number.isFinite));
  assert.equal(result.snapshot.trainingSeeds.length,source.trainingSeeds.length+rounds*6);assert.ok(result.scoreHistory.length<=64);assert.ok(result.roundHistory.length<=64);
  assert.equal(JSON.stringify(source),original);
  if(rounds===1024){const check=comparePracticeModels(source,result.snapshot);assert.equal(check.before.meanScore,0);assert.ok(check.after.meanScore>=1,'reward learning must improve this fixed weak-recording regression case');assert.ok(check.after.meanSurvivalSteps>check.before.meanSurvivalSteps);}
 }
});

test('active time and bounded step budget stop early without counting partial trajectories',async()=>{
 let clock=0;
 const timed=await runParallelPractice(input({mode:'fast',timeBudgetMs:20,stepBudget:100_000}),{pace:false,now:()=>{clock+=10;return clock;},yieldControl:async()=>{}});
 assert.equal(timed.reason,'time_budget');assert.equal(timed.completedRounds,0);assert.equal(timed.trainedEpisodes,0);
 assert.ok(timed.steps<=100_000);
 await assert.rejects(runParallelPractice(input({mode:'fast',timeBudgetMs:600_001})),/Invalid finite/);
});

test('pause time is excluded and cancellation rejects without committing a partial attempt',async()=>{
  let paused=true,tick=0,cancel=false;
  await assert.rejects(runParallelPractice(input({stepBudget:100}),{pace:false,isPaused:()=>paused,isCancelled:()=>cancel,
    yieldControl:async()=>{tick++;if(tick===2)paused=false;if(tick===5)cancel=true;},now:()=>tick*10}),ParallelPracticeCancelledError);
});

test('visual speed preserves learned parameters; paused wall time is excluded from training time',async()=>{
 const slow=await runParallelPractice(input({speed:1}),{pace:false});
 const fast=await runParallelPractice(input({speed:64}),{pace:false});
 assert.deepEqual(slow.snapshot,fast.snapshot);
 let clock=0,paused=true,pauseYields=0;
 const result=await runParallelPractice(input(),{pace:false,now:()=>clock,isPaused:()=>paused,yieldControl:async()=>{clock+=10;if(paused&&++pauseYields===2)paused=false;}});
 assert.equal(result.elapsedMs,clock-20);
 assert.equal(result.trainedEpisodes,6);
});
