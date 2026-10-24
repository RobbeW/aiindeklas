import assert from 'node:assert/strict';
import test from 'node:test';
import { DemonstrationRecorder } from '../src/flappy/recorder.ts';
import { splitEpisodes,validateEpisode } from '../src/data/dataset.ts';
function episode(seed:number) {
  const r=new DemonstrationRecorder(); r.start(`e${seed}`,seed);
  while (!r.step(0).done) { /* fixture */ }
  return r.completedEpisode!;
}
test('holds out complete distinct episodes and reports all-wait data explicitly',()=>{
  const split=splitEpisodes([episode(1000),episode(1001),episode(1002)]);
  assert.deepEqual(split.training.map(e=>e.seed),[1000,1001]);
  assert.deepEqual(split.validation.map(e=>e.seed),[1002]);
  assert.equal(split.trainingBalance.diagnostic,'all_wait');
  assert.equal(split.trainingBalance.flaps,0);
  assert.throws(()=>splitEpisodes([episode(1000),episode(1000)]),/duplicate/);
  assert.throws(()=>splitEpisodes([]),/nonempty/);
});
test('rejects incompatible, corrupt and non-finite data without coercion',()=>{
  const e=episode(1000);
  assert.throws(()=>validateEpisode({...e,worldVersion:'bad'}),/version/);
  for (const observation of [[NaN,0,0,0,0],[0,0],[Infinity,0,0,0,0],[2,0,0,0,0]]) {
    assert.throws(()=>validateEpisode({...e,frames:[{step:0,action:0,observation}]}),/observation/);
  }
  assert.throws(()=>validateEpisode({...e,frames:[{step:1,action:0,observation:[0,0,0,0,0]}]}),/step/);
  assert.throws(()=>validateEpisode({...e,durationSeconds:99}),/duration/);
  assert.throws(()=>validateEpisode({...e,result:{...e.result,totalReward:NaN}}),/terminal/);
});
