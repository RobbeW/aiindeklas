import test from 'node:test';import assert from 'node:assert/strict';
import { CarEpisodeRecorder,generateCarReferenceEpisode,splitCarEpisodes,validateCarEpisode } from '../src/car/recorder.ts';
import { teachingLoop,fixtureCircuit } from './fixtures/circuits.ts';

test('records immutable pre-action six-value frames and validates provenance and whole-episode split',()=>{
  const doc=teachingLoop(),rec=new CarEpisodeRecorder(doc);rec.start('complete',1000);let actions=0;
  for(let i=0;i<1800;i++){const t=rec.step(0);actions++;if(t.done)break;}
  const episode=rec.completedEpisode!;assert.ok(episode);assert.equal(episode.frames.length,actions);assert.equal(episode.frames[0]?.step,0);assert.equal(episode.frames[0]?.observation.length,6);assert.equal(episode.game,'car');assert.equal(episode.source,'human');assert.ok(Object.isFrozen(episode.circuit));
  assert.deepEqual(splitCarEpisodes([episode]),{training:[episode],control:[]});assert.deepEqual(validateCarEpisode(structuredClone(episode)),episode);
  assert.throws(()=>splitCarEpisodes([{...episode,game:'flappy'} as never]),/incompatible|bird/i);
  assert.throws(()=>splitCarEpisodes([{...episode,frames:[Object.freeze({...episode.frames[0]!,observation:[0,0,0,0,0]})]}]),/dimensions/i);
  assert.throws(()=>splitCarEpisodes([episode,episode]),/distinct/i);
});

test('route reference follows actual car environment to one complete lap and rejects reserved training tracks',async()=>{
  const doc=teachingLoop(),training=generateCarReferenceEpisode(doc,1000);assert.equal(training.source,'synthetic_reference');assert.equal(training.result.laps,1);assert.equal(training.result.terminationReason,'lap_complete');
  const control=generateCarReferenceEpisode(doc,2000);assert.deepEqual(splitCarEpisodes([training,control]).training,[training]);assert.deepEqual(splitCarEpisodes([training,control]).control,[control]);
  const reserved=fixtureCircuit('long-loop');assert.throws(()=>generateCarReferenceEpisode(reserved,1001),/reserved|training/i);
});

test('legacy recorded episodes survive import and replay with their original physics',()=>{
 const doc=teachingLoop(),episode=generateCarReferenceEpisode(doc,1001,'synthetic_reference','car-world-v1');
 assert.equal(episode.frames.length,838);assert.equal(episode.worldVersion,'car-world-v1');
 const imported=validateCarEpisode(structuredClone(episode));const replay=new CarEpisodeRecorder(doc,imported.worldVersion);replay.start(imported.id,imported.seed,imported.source);
 for(const frame of imported.frames){assert.deepEqual(replay.environment.getObservation(),frame.observation);replay.step(frame.action);}
 assert.deepEqual(replay.completedEpisode,imported);
});
