import test from 'node:test';import assert from 'node:assert/strict';
import { CarPolicy,createCarSnapshot } from '../src/car/policy-adapter.ts';
import { carRewardGradient,runCarPracticeJob,type CarRollout } from '../src/car/practice-adapter.ts';
import { teachingLoop,fixtureCircuit } from './fixtures/circuits.ts';
import { CarEnvironment } from '../src/car/environment.ts';

test('categorical reward-to-go derivatives match all83finite differences including negative returns',()=>{
 const params=Array.from({length:83},(_,i)=>Math.sin(i+.2)*.1),p=new CarPolicy(1,params),env=new CarEnvironment(teachingLoop());env.reset({seed:1000});while(!env.completedResult)env.step(0);
 const rollout:CarRollout={seed:1000,steps:[{observation:[.1,.2,.3,.4,.5,.6],action:2,reward:.4},{observation:[.3,.6,.2,.7,.4,.8],action:1,reward:-1}],result:{...env.completedResult!,survivalSteps:2}};
 const raw=carRewardGradient(p,[rollout]);const epsilon=1e-5;
 for(let i=0;i<83;i++){const plus=[...params],minus=[...params];plus[i]!+=epsilon;minus[i]!-=epsilon;p.setParameters(plus);const a=carRewardGradient(p,[rollout]).loss;p.setParameters(minus);const b=carRewardGradient(p,[rollout]).loss;assert.ok(Math.abs((a-b)/(2*epsilon)-raw.gradient[i]!)<1e-7,`gradient${i}`);}
});

test('car reward continuation preserves exact entry/baseline, complete batches and replay',async()=>{
 const base=createCarSnapshot(new CarPolicy(1222),'imitation',{supervisedUpdates:150,supervisedOptimizer:'adam'}),before=structuredClone(base),seen:number[][]=[];
 const result=await runCarPracticeJob({snapshot:base,document:teachingLoop(),episodeBudget:4,stepBudget:7200,environmentSeed:1000,actionSeed:4000},{yieldControl:async()=>{},onProgress:p=>{if(!p.steps)seen.push([...p.snapshot.parameters]);}});
 assert.deepEqual(seen,[base.parameters]);assert.deepEqual(base,before);assert.equal(result.trainedEpisodes,4);assert.equal(result.snapshot.stage,'post_rl');assert.notDeepEqual(result.snapshot.parameters,base.parameters);assert.equal(result.snapshot.training.supervisedUpdates,150);assert.equal(result.snapshot.training.reinforcementEpisodes,4);assert.equal(result.snapshot.training.interactions,result.steps);
 for(const r of result.history){const env=new CarEnvironment(teachingLoop());env.reset({seed:r.seed});for(const s of r.steps){assert.deepEqual(env.getObservation(),s.observation);env.step(s.action);}assert.deepEqual(env.completedResult,r.result);}
});

test('partial budget never updates, cancellation rejects, reserved routes reject',async()=>{
 const base=createCarSnapshot(new CarPolicy(1),'imitation');const input={snapshot:base,document:teachingLoop(),episodeBudget:4,stepBudget:1,environmentSeed:1000,actionSeed:4000};const result=await runCarPracticeJob(input,{yieldControl:async()=>{}});assert.equal(result.trainedEpisodes,0);assert.equal(result.episodes,0);assert.deepEqual(result.snapshot.parameters,base.parameters);assert.equal(result.steps,1);
 const partial=await runCarPracticeJob({...input,stepBudget:7200,episodeBudget:3},{yieldControl:async()=>{}});assert.equal(partial.episodes,3);assert.equal(partial.trainedEpisodes,0);assert.deepEqual(partial.snapshot.parameters,base.parameters);
 await assert.rejects(runCarPracticeJob({...input,batchSize:3}),/exactly4/);
 await assert.rejects(runCarPracticeJob(input,{isCancelled:()=>true}),/cancelled/);
 await assert.rejects(runCarPracticeJob({...input,document:fixtureCircuit('long-loop')}),/Reserved/);
});

test('pause time is excluded and cancellation in an incomplete batch cannot commit',async()=>{
 const base=createCarSnapshot(new CarPolicy(77),'imitation',{supervisedUpdates:150,supervisedOptimizer:'adam'}),before=structuredClone(base);
 let clock=0,paused=true,completed=0;
 const result=await runCarPracticeJob({snapshot:base,document:teachingLoop(),episodeBudget:4,stepBudget:7200,environmentSeed:1000,actionSeed:4000},{now:()=>clock,isPaused:()=>paused,yieldControl:async()=>{clock+=100;if(paused)paused=false;}});
 assert.equal(result.trainedEpisodes,4);assert.ok(result.elapsedMs>0);assert.equal(result.elapsedMs,clock-100);assert.deepEqual(base,before);
 let cancelled=false;
 await assert.rejects(runCarPracticeJob({snapshot:base,document:teachingLoop(),episodeBudget:4,stepBudget:7200,environmentSeed:1000,actionSeed:4000},{isCancelled:()=>cancelled,yieldControl:async()=>{completed++;if(completed===1)cancelled=true;}}),/cancelled/);
 assert.deepEqual(base,before);
});
