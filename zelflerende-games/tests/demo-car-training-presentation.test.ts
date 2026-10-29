import test from 'node:test';
import assert from 'node:assert/strict';
import { runEvolutionJob } from '../src/evolution/generation-job.ts';
import { CarTrainingPresentation, SplitCarTrainingPresentation } from '../src/demo/car-training-presentation.ts';
import { createInitialLibrary,getTrainingDocuments } from '../src/tracks/library.ts';

const docs=getTrainingDocuments(createInitialLibrary());
const run=runEvolutionJob({document:docs[0]!,documents:docs,populationSize:12,generationBudget:10,stepBudget:50_000_000,activeTimeLimitMs:1_000_000,seed:1701,capturePresentationSnapshots:true},{now:()=>0,yieldControl:async()=>{}});
function finish(p:CarTrainingPresentation){const visits:string[]=[];let ticks=0,last='';while(p.state.status!=='complete'){
 const s=p.state;if(s.status==='track-boundary'){assert.ok(s.frame);p.acknowledgeTrackBoundary();continue;}
 assert.notEqual(s.status,'waiting');const key=`${s.trackIndex}:${s.attemptIndex}`;if(key!==last){visits.push(key);last=key;}
 p.advance(100);if(++ticks>100000)throw new Error('Replay did not finish');
 }assert.ok(p.state.frame,'completed presentation keeps its final frame for the slower split pane');return {visits,ms:ticks*100};}

test('real populations replay exactly in grouped order with ramp and immutable identities',async()=>{
 const result=await run,snapshots=result.presentationSnapshots!,before=JSON.stringify(snapshots);
 assert.equal(snapshots.length,10);const p=new CarTrainingPresentation(docs);for(const s of snapshots)p.addSnapshot(s);p.seal();
 const seen:number[]=[];let previous='';while(p.state.status!=='complete'){
  const s=p.state;if(s.status==='track-boundary'){p.acknowledgeTrackBoundary();continue;}
  const key=`${s.trackIndex}:${s.attemptIndex}`;if(key!==previous){seen.push(s.speed);assert.equal(s.generation,s.attemptIndex-1);assert.deepEqual(s.frame!.agents.map(a=>a.id),snapshots[s.attemptIndex-1]!.agents.map(a=>a.genome.id));previous=key;}
  p.advance(100);
 }
 assert.deepEqual(seen,Array(3).fill([1,1,1,2,2,2,4,4,4,4]).flat());assert.equal(JSON.stringify(snapshots),before);assert.equal(result.completedGenerations,10);
});

test('waiting, partial archive, boundaries, pause, stale delta, terminal hold and disposal',async()=>{
 const s=(await run).presentationSnapshots![0]!,p=new CarTrainingPresentation(docs);assert.equal(p.state.status,'waiting');p.addSnapshot(s);
 p.setPaused(true);p.advance(1000);assert.equal(p.state.elapsedAttemptMs,0);p.setPaused(false);p.setHidden(true);p.advance(100);assert.equal(p.state.elapsedAttemptMs,0);p.setHidden(false);p.advance(10000);assert.equal(p.state.elapsedAttemptMs,100);
 const status=()=>p.state.status;while(status()==='playing')p.advance(100);if(status()==='terminal'){assert.ok(p.state.elapsedAttemptMs<2000);while(status()==='terminal')p.advance(100);}
 assert.equal(p.state.status,'waiting');p.seal();assert.equal(p.state.status,'track-boundary');assert.ok(p.state.frame);p.acknowledgeTrackBoundary();assert.equal(p.state.trackIndex,2);
 while(status()==='playing')p.advance(100);assert.equal(status(),'terminal');assert.ok(p.state.elapsedAttemptMs<2000);const held=p.state.frame; p.advance(100);assert.equal(p.state.frame!.round,held!.round);while(status()==='terminal')p.advance(100);assert.equal(status(),'track-boundary');p.acknowledgeTrackBoundary();
 const done=finish(p);assert.deepEqual(done.visits,['3:1']);p.dispose();assert.equal(p.state.status,'disposed');assert.throws(()=>p.advance(1));
 const empty=new CarTrainingPresentation(docs);empty.seal();assert.equal(empty.state.status,'complete');assert.throws(()=>empty.addSnapshot(s));
});

test('fixed speeds and reduced motion preserve complete replay outcomes',async()=>{
 const snapshots=(await run).presentationSnapshots!;const durations:number[]=[];
 for(const options of [{fixedSpeed:2 as const},{fixedSpeed:8 as const},{fixedSpeed:8 as const,reducedMotion:true}]){
  const p=new CarTrainingPresentation(docs,options);for(const s of snapshots)p.addSnapshot(s);p.seal();const out=finish(p);assert.equal(out.visits.length,30);durations.push(out.ms);
 }
 assert.ok(durations[1]!<durations[0]!);assert.ok(durations[2]!>durations[0]!);
});


test('split clocks hold the fast circuit until both are ready and share boundaries', async()=>{
 const snapshots=(await run).presentationSnapshots!,p=new SplitCarTrainingPresentation(docs);
 for(const s of snapshots)p.addSnapshot(s);p.seal();
 assert.equal(p.state.speed,2);assert.equal(p.rightState.speed,8);
 p.setPaused(true);p.advance(100);assert.equal(p.state.elapsedAttemptMs,0);p.setPaused(false);
 p.setHidden(true);p.advance(100);assert.equal(p.rightState.elapsedAttemptMs,0);p.setHidden(false);
 let held=false, transitions=0, ticks=0;
 while(p.state.status!=='complete'){
  if(p.rightState.status==='track-boundary' && p.state.status!=='track-boundary'){
   const frame=p.rightState.frame;p.acknowledgeTrackBoundary();p.advance(100);assert.equal(p.rightState.frame,frame);assert.equal(p.rightState.trackIndex,p.state.trackIndex);held=true;
  }else if(p.state.status==='track-boundary'){
   assert.equal(p.rightState.status,'track-boundary');p.acknowledgeTrackBoundary();assert.equal(p.state.trackIndex,p.rightState.trackIndex);transitions++;
  }else p.advance(100);
  if(++ticks>100000)throw new Error('Split replay did not finish');
 }
 assert.ok(held);assert.equal(transitions,2);assert.equal(p.rightState.status,'complete');assert.ok(p.rightState.frame);p.dispose();assert.throws(()=>p.advance(1));
});


test('split supports a sealed partial or empty archive', async()=>{
 for(const snapshots of [[],(await run).presentationSnapshots!.slice(0,1)]){
  const p=new SplitCarTrainingPresentation(docs);for(const s of snapshots)p.addSnapshot(s);p.seal();let ticks=0;
  while(p.state.status!=='complete'){if(p.state.status==='track-boundary')p.acknowledgeTrackBoundary();else p.advance(100);if(++ticks>10000)throw new Error('Partial replay did not finish');}
  assert.equal(p.rightState.status,'complete');assert.equal(p.state.availableAttempts,snapshots.length);p.dispose();
 }
});
