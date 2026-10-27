import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateGenome } from '../src/evolution/population-evaluation.ts';
import { runEvolutionJob } from '../src/evolution/generation-job.ts';
import { createGenome } from '../src/evolution/genome.ts';
import { teachingLoop } from './fixtures/circuits.ts';
import { validateCircuit,TRACK_VERSION } from '../src/tracks/document.ts';

const doc=teachingLoop();
test('single and population evaluation share exact fitness; completed generations are reproducible and immutable',async()=>{
  const genomes=Array.from({length:4},(_,i)=>createGenome(`g0-a${i}`,0,17+i));
  const solo=await evaluateGenome(genomes[0]!,doc,1000);
  const job=await runEvolutionJob({document:doc,populationSize:4,generationBudget:1,stepBudget:10000,seed:17});
  assert.equal(job.reason,'generation_budget');assert.equal(job.completedGenerations,1);assert.equal(job.evaluatedEpisodes,4);
  assert.equal(job.records[0]!.agents[0]!.fitness,solo.fitness);assert.equal(job.records[0]!.agents[0]!.result.survivalSteps,solo.result.survivalSteps);
  const repeat=await runEvolutionJob({document:doc,populationSize:4,generationBudget:1,stepBudget:10000,seed:17});
  assert.deepEqual(job.records,repeat.records);assert.deepEqual(job.champion?.parameters,repeat.champion?.parameters);
  assert.equal(job.steps,job.records[0]!.agents.reduce((n,a)=>n+a.result.survivalSteps,0));
  assert.equal(job.champion?.training.interactions,job.steps);assert.equal(job.champion?.training.generations,1);assert.equal(job.champion?.training.reinforcementEpisodes,0);
  assert.ok(Object.isFrozen(job.champion)&&Object.isFrozen(job.champion?.parameters));
});

test('partial generation is excluded at step limit and cancellation rejects after preserving prior progress',async()=>{
  const progress:any[]=[];const bounded=await runEvolutionJob({document:doc,populationSize:4,generationBudget:2,stepBudget:1,seed:21},{onProgress:p=>progress.push(p)});
  assert.equal(bounded.reason,'step_budget');assert.equal(bounded.completedGenerations,0);assert.equal(bounded.steps,1);assert.equal(bounded.evaluatedEpisodes,0);assert.equal(bounded.champion,undefined);
  let cancelled=false,commitSteps=0;const prior:any[]=[];
  await assert.rejects(runEvolutionJob({document:doc,populationSize:4,generationBudget:2,stepBudget:10000,seed:17},{isCancelled:()=>cancelled,onProgress:p=>{prior.push(p);if(p.completedGenerations===1&&commitSteps===0)commitSteps=p.steps;},onStep:n=>{if(commitSteps&&n>=commitSteps+128)cancelled=true;}}),/cancelled/);
  assert.ok(prior.some(p=>p.completedGenerations===1&&p.champion));assert.ok(prior.at(-1)!.completedGenerations===1);
});

test('reserved track and invalid budgets are rejected',async()=>{
  const reserved=validateCircuit({version:TRACK_VERSION,width:4,height:3,cells:[
    {x:0,y:0,kind:'turn',rotation:1},{x:1,y:0,kind:'straight',rotation:1},{x:2,y:0,kind:'straight',rotation:1},{x:3,y:0,kind:'turn',rotation:2},
    {x:3,y:1,kind:'straight',rotation:0},{x:3,y:2,kind:'turn',rotation:3},{x:2,y:2,kind:'straight',rotation:1},{x:1,y:2,kind:'straight',rotation:1},
    {x:0,y:2,kind:'turn',rotation:0},{x:0,y:1,kind:'straight',rotation:0}],start:{x:1,y:0,direction:'E'}});
  await assert.rejects(runEvolutionJob({document:reserved,populationSize:4,generationBudget:1,stepBudget:10,seed:1}),/Reserved/);
  await assert.rejects(runEvolutionJob({document:doc,documents:[doc,reserved],populationSize:4,generationBudget:1,stepBudget:10,seed:1}),/Reserved/);
  for(const [populationSize,generationBudget,stepBudget] of [[3,1,10],[4,0,10],[4,101,10],[4,1,50_000_001]])
    await assert.rejects(runEvolutionJob({document:doc,populationSize,generationBudget,stepBudget,seed:1}));
});

test('pause time is excluded from active elapsed time',async()=>{
  let clock=0,paused=false,waited=false;
  const result=await runEvolutionJob({document:doc,populationSize:4,generationBudget:1,stepBudget:10000,seed:3},{now:()=>clock,isPaused:()=>paused,
    onStep:n=>{if(n>=128&&!waited){paused=true;}},
    yieldControl:async()=>{clock+=10;if(paused&&!waited){waited=true;clock+=900;paused=false;}}});
  assert.equal(result.reason,'generation_budget');assert.ok(result.elapsedMs<=result.steps*0+100);
});


test('multi-track selection covers each model equally, retains checkpoints and matches live mode',async()=>{
  const other=validateCircuit({...doc,start:{...doc.start!,direction:doc.start!.direction==='E'?'W':'E'}});
  const {trackIdentity}=await import('../src/tracks/document.ts');
  for(const seed of [17,31]){
    const input={document:doc,documents:[doc,other],populationSize:4,generationBudget:11,stepBudget:200000,activeTimeLimitMs:1_000_000,seed};
    const fast=await runEvolutionJob(input);
    let clock=0;const live=await runEvolutionJob({...input,visualMode:true},{now:()=>clock,delay:async ms=>{clock+=ms;}});
    assert.equal(fast.completedGenerations,11);assert.equal(fast.evaluatedEpisodes,88);
    assert.deepEqual(fast.trainingTrackIds,[trackIdentity(doc),trackIdentity(other)]);
    assert.deepEqual(live.records,fast.records);assert.deepEqual(live.champion?.parameters,fast.champion?.parameters);
    assert.deepEqual(fast.milestones?.map(s=>s.training.generations),[1,10,11]);
    for(const snapshot of fast.milestones!)assert.deepEqual(snapshot.training.trackIds,fast.trainingTrackIds);
    for(const record of fast.records)for(const agent of record.agents){assert.deepEqual(agent.perTrack.map(t=>t.trackId),fast.trainingTrackIds);assert.equal(agent.fitness,(agent.perTrack[0]!.fitness+agent.perTrack[1]!.fitness)/2);}
    assert.ok(fast.records[0]!.failureReplay?.trackId);
  }
});

test('circuit set rejects duplicates, invalid loops, and oversized sets; incomplete second track cannot select',async()=>{
  const base={document:doc,populationSize:4,generationBudget:1,stepBudget:10000,seed:17};
  const other=validateCircuit({...doc,start:{...doc.start!,direction:doc.start!.direction==='E'?'W':'E'}});
  await assert.rejects(runEvolutionJob({...base,documents:[doc,doc]}),/Duplicate/);
  await assert.rejects(runEvolutionJob({...base,documents:Array(9).fill(doc)}),/between 1 and 8/);
  await assert.rejects(runEvolutionJob({...base,documents:[doc,{...doc,cells:doc.cells.slice(1)}]}));
  const single=await runEvolutionJob(base);
  const partial=await runEvolutionJob({...base,documents:[doc,other],stepBudget:single.steps+1});
  assert.equal(partial.completedGenerations,0);assert.equal(partial.evaluatedEpisodes,4);assert.equal(partial.champion,undefined);
});

test('active time limit stops a partial generation',async()=>{
  let clock=0;const result=await runEvolutionJob({document:doc,populationSize:4,generationBudget:2,stepBudget:10000,seed:17,activeTimeLimitMs:3},{now:()=>clock,onStep:()=>{clock++;}});
  assert.equal(result.reason,'time_limit');assert.equal(result.steps,3);assert.equal(result.completedGenerations,0);assert.equal(result.elapsedMs,3);
});

test('fast transient progress is throttled and generation and final updates retain counts',async()=>{
  let clock=0;const emissions:Array<{time:number;completed:number;steps:number}>=[];
  const result=await runEvolutionJob({document:doc,populationSize:4,generationBudget:2,stepBudget:10000,seed:17},{now:()=>clock,onStep:()=>{clock+=0.1;},onProgress:p=>emissions.push({time:clock,completed:p.completedGenerations,steps:p.steps})});
  assert.deepEqual(emissions[0],{time:0,completed:0,steps:0});
  assert.ok(emissions.some(p=>p.completed===1));assert.equal(emissions.at(-1)!.steps,result.steps);assert.equal(emissions.at(-1)!.completed,2);
  assert.ok(emissions.length<=Math.floor(clock/100)+4);
  const transient=emissions.filter(p=>p.steps>0&&p.steps%128===0&&p.completed<2);
  for(let i=1;i<transient.length;i++)assert.ok(transient[i]!.time-transient[i-1]!.time>=100);
});

test('partial next generation does not change champion training metadata',async()=>{
  const base={document:doc,populationSize:4,generationBudget:1,stepBudget:10000,seed:17};
  const complete=await runEvolutionJob(base);
  const partial=await runEvolutionJob({...base,generationBudget:2,stepBudget:complete.steps+50});
  assert.equal(partial.completedGenerations,1);assert.equal(partial.steps,complete.steps+50);
  assert.equal(partial.champion!.training.interactions,complete.steps);assert.ok(partial.champion!.training.interactions<=partial.steps);
  assert.deepEqual(partial.champion!.parameters,complete.champion!.parameters);
  assert.equal(partial.champion!.training.generations,1);
});
