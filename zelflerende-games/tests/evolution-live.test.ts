import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateGenome } from '../src/evolution/population-evaluation.ts';
import { runEvolutionJob } from '../src/evolution/generation-job.ts';
import { createGenome } from '../src/evolution/genome.ts';
import { teachingLoop } from './fixtures/circuits.ts';

const document=teachingLoop();
const input={document,populationSize:4,generationBudget:2,stepBudget:20_000,seed:17} as const;
function fakeTime(){let time=0;return {now:()=>time,delay:async(ms:number)=>{time+=ms;},get time(){return time;}};}

test('live and fast generations preserve all records, traces, champion parameters and reproduction',async()=>{
  const fast=await runEvolutionJob(input);
  const clock=fakeTime(),liveFrames:any[]=[];
  const live=await runEvolutionJob({...input,visualMode:true},{now:clock.now,delay:clock.delay,onProgress:p=>{if(p.liveFrame)liveFrames.push(p.liveFrame);}});
  assert.deepEqual(live.records,fast.records);
  assert.deepEqual(live.champion?.parameters,fast.champion?.parameters);
  assert.equal(live.steps,fast.steps);assert.equal(live.evaluatedEpisodes,fast.evaluatedEpisodes);
  assert.ok(liveFrames.length>2);
  assert.equal(liveFrames[0].generation,0);assert.equal(liveFrames[0].round,0);
  assert.equal(liveFrames.at(-1).agents.every((a:any)=>a.done),true);
  for(let i=0;i<4;i++){
    const genome=createGenome(`g0-a${i}`,0,17+i),solo=await evaluateGenome(genome,document,1000);
    assert.deepEqual(live.records[0]!.agents[i]!.result,solo.result);
    assert.deepEqual(live.records[0]!.failureReplay?.actions,fast.records[0]!.failureReplay?.actions);
  }
});

test('visual speed changes wall pacing only and bounds retained frame state',async()=>{
  const outputs=[] as unknown[];
  for(const visualSpeed of [.5,8]){
    const clock=fakeTime();
    const result=await runEvolutionJob({...input,visualMode:true,visualSpeed},{now:clock.now,delay:clock.delay});
    outputs.push({records:result.records,parameters:result.champion?.parameters,elapsed:clock.time});
  }
  const slow=outputs[0] as any,fast=outputs[1] as any;
  assert.deepEqual(slow.records,fast.records);assert.deepEqual(slow.parameters,fast.parameters);
  assert.ok(slow.elapsed>fast.elapsed);
});

test('live step budget leaves a visible partial generation without committing it',async()=>{
  const frames:any[]=[];
  const result=await runEvolutionJob({...input,visualMode:true,stepBudget:1},{onProgress:p=>{if(p.liveFrame)frames.push(p.liveFrame);}});
  assert.equal(result.completedGenerations,0);assert.equal(result.evaluatedEpisodes,0);assert.equal(result.champion,undefined);
  assert.equal(result.steps,1);assert.ok(frames.length>=2);
  assert.equal(frames.at(-1).agents.filter((a:any)=>a.world.steps===1).length,1);
});

test('live pause time is excluded and cancellation rejects promptly',async()=>{
  let now=0,paused=false,entered=false;
  const pauseJob=runEvolutionJob({...input,visualMode:true,stepBudget:100},{now:()=>now,delay:async ms=>{if(!entered){entered=true;paused=true;now+=ms;}else now+=ms;},isPaused:()=>paused,yieldControl:async()=>{now+=1000;paused=false;}});
  const pausedResult=await pauseJob;
  assert.ok(now-pausedResult.elapsedMs>=1000);
  let cancelled=false;
  await assert.rejects(runEvolutionJob({...input,visualMode:true},{delay:async()=>{cancelled=true;},isCancelled:()=>cancelled}),/cancelled/);
});

test('generation-step pause retains the completed frame until resume',async()=>{
 const clock=fakeTime();let paused=false,didPause=false,pauseYields=0,lastFrame:any;
 const result=await runEvolutionJob({...input,visualMode:true},{now:clock.now,delay:clock.delay,isPaused:()=>paused,
  onProgress:p=>{lastFrame=p.liveFrame;if(p.completedGenerations===1&&!didPause){paused=true;didPause=true;}},
  yieldControl:async()=>{if(paused&&++pauseYields===2){assert.equal(lastFrame.generation,0);assert.ok(lastFrame.agents.every((a:any)=>a.done));paused=false;}}
 });
 assert.equal(didPause,true);assert.equal(result.completedGenerations,2);
});

test('partial generation counts complete agents without committing their generation',async()=>{
 const solo=await evaluateGenome(createGenome('g0-a0',0,input.seed),document,1000);
 const clock=fakeTime();
 const result=await runEvolutionJob({...input,visualMode:true,stepBudget:solo.result.survivalSteps*4-3},{now:clock.now,delay:clock.delay});
 assert.equal(result.completedGenerations,0);assert.equal(result.champion,undefined);
 assert.equal(result.evaluatedEpisodes,result.liveFrame!.agents.filter(a=>a.done).length);
 assert.ok(result.evaluatedEpisodes>0);
});

 test('16x and32x change pacing without changing worlds or selected models',async()=>{
 const fast=await runEvolutionJob(input);
 for(const visualSpeed of [16,32]){const clock=fakeTime();const live=await runEvolutionJob({...input,visualMode:true,visualSpeed},{now:clock.now,delay:clock.delay});assert.deepEqual(live.records,fast.records);assert.deepEqual(live.champion?.parameters,fast.champion?.parameters);assert.equal(live.steps,fast.steps);assert.ok(clock.time<5000);}
 await assert.rejects(runEvolutionJob({...input,visualMode:true,visualSpeed:33}));
 });
