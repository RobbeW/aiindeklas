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
  await assert.rejects(runEvolutionJob({document:doc,populationSize:4,generationBudget:2,stepBudget:10000,seed:17},{isCancelled:()=>cancelled,onProgress:p=>{prior.push(p);if(p.completedGenerations===1&&commitSteps===0)commitSteps=p.steps;if(p.completedGenerations===1&&p.steps>=commitSteps+128)cancelled=true;}}),/cancelled/);
  assert.ok(prior.some(p=>p.completedGenerations===1&&p.champion));assert.ok(prior.at(-1)!.completedGenerations===1);
});

test('reserved track and invalid budgets are rejected',async()=>{
  const reserved=validateCircuit({version:TRACK_VERSION,width:4,height:3,cells:[
    {x:0,y:0,kind:'turn',rotation:1},{x:1,y:0,kind:'straight',rotation:1},{x:2,y:0,kind:'straight',rotation:1},{x:3,y:0,kind:'turn',rotation:2},
    {x:3,y:1,kind:'straight',rotation:0},{x:3,y:2,kind:'turn',rotation:3},{x:2,y:2,kind:'straight',rotation:1},{x:1,y:2,kind:'straight',rotation:1},
    {x:0,y:2,kind:'turn',rotation:0},{x:0,y:1,kind:'straight',rotation:0}],start:{x:1,y:0,direction:'E'}});
  await assert.rejects(runEvolutionJob({document:reserved,populationSize:4,generationBudget:1,stepBudget:10,seed:1}),/Reserved/);
  for(const [populationSize,generationBudget,stepBudget] of [[3,1,10],[4,0,10],[4,21,10],[4,1,1_000_001]])
    await assert.rejects(runEvolutionJob({document:doc,populationSize,generationBudget,stepBudget,seed:1}));
});

test('pause time is excluded from active elapsed time',async()=>{
  let clock=0,paused=false,waited=false;
  const result=await runEvolutionJob({document:doc,populationSize:4,generationBudget:1,stepBudget:10000,seed:3},{now:()=>clock,isPaused:()=>paused,
    onProgress:p=>{if(p.steps>=128&&!waited){paused=true;}},
    yieldControl:async()=>{clock+=10;if(paused&&!waited){waited=true;clock+=900;paused=false;}}});
  assert.equal(result.reason,'generation_budget');assert.ok(result.elapsedMs<=result.steps*0+100);
});

