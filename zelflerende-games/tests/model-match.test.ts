import test from 'node:test';
import assert from 'node:assert/strict';
import { ModelMatchSession } from '../src/flappy/model-match.ts';
import { evaluateFlappy } from '../src/evaluation/runner.ts';
import { createPolicySnapshot } from '../src/learning/policy-snapshot.ts';
import { BernoulliPolicy } from '../src/learning/policy.ts';

const models = [
  { id:'A' as const, snapshot:createPolicySnapshot(new BernoulliPolicy(1222),{stage:'initial'}), available:true },
  { id:'B' as const, snapshot:createPolicySnapshot(new BernoulliPolicy(500),{stage:'imitation'}), available:true },
  { id:'C' as const, snapshot:createPolicySnapshot(new BernoulliPolicy(99),{stage:'post_rl',trainingCounts:{supervisedUpdates:0,reinforcementEpisodes:12}}), available:true },
];
const budget={demonstrationSeconds:3,practiceSteps:100,practiceElapsedMs:500};
function complete(session:ModelMatchSession, action:0|1=0){session.start();let safety=0;while(session.snapshot.phase==='running'&&safety++<20000)session.step(action);assert.ok(safety<20000,'attempt finishes');}

test('frozen model results match evaluateFlappy for the same three seeds',()=>{
 const session=new ModelMatchSession(models,budget);complete(session);
 const actual=session.recordsForCompletedTest();
 for(const model of models){const expected=evaluateFlappy(model.snapshot,[2030])[0]!;const row=actual.find(item=>item.controller===model.snapshot.stage)!;assert.deepEqual(row.result,expected.result);assert.equal(row.modelId,expected.modelId);assert.equal(row.sequenceId,expected.sequenceId);}
});

test('one independent human action changes only human trajectory and frozen models do not change',()=>{
 const original=JSON.stringify(models);const steady=new ModelMatchSession(models,budget),flapping=new ModelMatchSession(models,budget);steady.start();flapping.start();
 for(let i=0;i<75;i++){steady.step(0);flapping.step(i===2?1:0);}
 for(const id of ['A','B','C'] as const)assert.deepEqual(steady.snapshot.players.find(p=>p.id===id)?.world,flapping.snapshot.players.find(p=>p.id===id)?.world);
 assert.notDeepEqual(steady.snapshot.players.find(p=>p.id==='D')?.world,flapping.snapshot.players.find(p=>p.id==='D')?.world);
 assert.equal(JSON.stringify(models),original);
});

test('pause freezes frames; terminal participants stay frozen while others continue',()=>{
 const session=new ModelMatchSession(models,budget);session.start();const before=session.snapshot;session.pause();const paused=session.snapshot;session.step(1);assert.deepEqual(session.snapshot.players,paused.players);session.resume();
 let steps=0;while(session.snapshot.phase==='running'&&steps++<20000){const prior=session.snapshot;const next=session.step(steps%7===0?1:0);for(const p of prior.players){if(p.result)assert.deepEqual(next.players.find(n=>n.id===p.id)?.world,p.world);}}
 assert.equal(session.snapshot.phase,'completed');assert.equal(session.recordsForCompletedTest().length,4);
});

test('missing B/C are rejected instead of being substituted',()=>{
 assert.throws(()=>new ModelMatchSession([models[0]!,{id:'B',available:false},{id:'C',available:true,snapshot:models[2]!.snapshot}],budget),/required/);
});
