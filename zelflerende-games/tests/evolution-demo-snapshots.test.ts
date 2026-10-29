import test from 'node:test';
import assert from 'node:assert/strict';
import { runEvolutionJob } from '../src/evolution/generation-job.ts';
import { appendPresentationSnapshot,PRESENTATION_ARCHIVE_BYTE_LIMIT,type PresentationPopulationSnapshot } from '../src/evolution/presentation-snapshots.ts';
import { CarEnvironment } from '../src/car/environment.ts';
import { CarPolicy } from '../src/car/policy-adapter.ts';
import { validateCircuit } from '../src/tracks/document.ts';
import { teachingLoop } from './fixtures/circuits.ts';

const doc=teachingLoop();
const other=validateCircuit({...doc,start:{...doc.start!,direction:doc.start!.direction==='E'?'W':'E'}});
const base={document:doc,documents:[doc,other],populationSize:12,generationBudget:11,stepBudget:500000,activeTimeLimitMs:1000000,seed:17};
const clock={now:()=>0,yieldControl:async()=>{}};

test('opt-in capture preserves learning and replays every actual car on both tracks',async()=>{
  const deltas:PresentationPopulationSnapshot[]=[];
  const off=await runEvolutionJob(base,clock);
  const on=await runEvolutionJob({...base,capturePresentationSnapshots:true},{...clock,onProgress:p=>{if(p.presentationSnapshot)deltas.push(p.presentationSnapshot);}});
  assert.equal(off.presentationSnapshots,undefined);
  assert.deepEqual(on.records,off.records);assert.deepEqual(on.champion,off.champion);assert.deepEqual(on.milestones,off.milestones);
  assert.equal(on.steps,off.steps);assert.equal(on.evaluatedEpisodes,off.evaluatedEpisodes);
  assert.equal(on.presentationSnapshots!.length,10);assert.deepEqual(deltas,on.presentationSnapshots);
  assert.ok(new TextEncoder().encode(JSON.stringify(on.presentationSnapshots)).byteLength<=PRESENTATION_ARCHIVE_BYTE_LIMIT);
  for(const snapshot of on.presentationSnapshots!){
    assert.equal(snapshot.worldVersion,'car-world-v2');assert.equal(snapshot.seed,1000);assert.equal(snapshot.agents.length,12);
    assert.ok(Object.isFrozen(snapshot.agents[0]!.genome.parameters));
    assert.deepEqual(snapshot.agents.map(a=>a.genome.id),on.records[snapshot.generation]!.agents.map(a=>a.id));
    for(const [t,track] of [doc,other].entries()) for(const agent of snapshot.agents){
      const env=new CarEnvironment(track,snapshot.worldVersion),policy=new CarPolicy(agent.genome.initializationSeed,agent.genome.parameters,snapshot.worldVersion);
      let obs=env.reset({seed:snapshot.seed}),result;
      do {const step=env.step(policy.action(obs));obs=step.observation;result=step.result;} while(!result);
      assert.equal(agent.perTrack[t]!.trackId,snapshot.trackIds[t]);assert.deepEqual(result,agent.perTrack[t]!.result);
    }
  }
});

test('partial budgets and cancellation expose only completed snapshots',async()=>{
  const single=await runEvolutionJob({...base,generationBudget:1,capturePresentationSnapshots:true},clock);
  const partial=await runEvolutionJob({...base,generationBudget:2,stepBudget:single.steps+1,capturePresentationSnapshots:true},clock);
  assert.equal(partial.reason,'step_budget');assert.equal(partial.presentationSnapshots!.length,1);
  let tick=0;const timed=await runEvolutionJob({...base,capturePresentationSnapshots:true,activeTimeLimitMs:3},{now:()=>tick,onStep:()=>tick++,yieldControl:async()=>{}});
  assert.equal(timed.reason,'time_limit');assert.equal(timed.presentationSnapshots!.length,0);
  let cancel=false,completed=0;const snapshots:PresentationPopulationSnapshot[]=[];
  await assert.rejects(runEvolutionJob({...base,capturePresentationSnapshots:true},{...clock,isCancelled:()=>cancel,onProgress:p=>{if(p.presentationSnapshot){snapshots.push(p.presentationSnapshot);completed=p.steps;}},onStep:n=>{if(completed&&n>completed+10)cancel=true;}}),/cancelled/);
  assert.equal(snapshots.length,1);
});

test('archive rejects oversized snapshots and never exceeds ten',()=>{
  const huge={padding:'x'.repeat(PRESENTATION_ARCHIVE_BYTE_LIMIT)} as unknown as PresentationPopulationSnapshot;
  const empty:readonly PresentationPopulationSnapshot[]=Object.freeze([]);
  assert.equal(appendPresentationSnapshot(empty,huge),empty);
  const small={generation:0} as PresentationPopulationSnapshot;
  let archive=empty;for(let i=0;i<11;i++)archive=appendPresentationSnapshot(archive,small);
  assert.equal(archive.length,10);assert.ok(Object.isFrozen(archive));
});
