import assert from 'node:assert/strict';
import test from 'node:test';
import { createSeededRandom } from '../src/core/random.ts';
import { FlappyEnvironment } from '../src/flappy/environment.ts';
import type { WorldState } from '../src/flappy/world.ts';
import { BernoulliPolicy } from '../src/learning/policy.ts';
import { createPolicySnapshot, restorePolicySnapshot } from '../src/learning/policy-snapshot.ts';
import { runParallelPractice, ParallelPracticeCancelledError } from '../src/learning/parallel-practice.ts';
import { updateReinforcementPolicy } from '../src/learning/rl-update.ts';
import type { RolloutEpisode, RolloutStep } from '../src/learning/rollout.ts';

function snapshot(){return createPolicySnapshot(new BernoulliPolicy(4),{stage:'imitation'});}
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
  updateReinforcementPolicy(policy,episodes);
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
  for(const overrides of [{roundBudget:65},{agentCount:5},{speed:2},{stepBudget:2_800_001}])
    await assert.rejects(runParallelPractice(input(overrides as Partial<Parameters<typeof runParallelPractice>[0]>),{pace:false}),/Invalid finite/);
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
