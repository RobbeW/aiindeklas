import test from 'node:test';
import assert from 'node:assert/strict';
import { PracticeSession } from '../src/learning/practice-session.ts';
import { BernoulliPolicy } from '../src/learning/policy.ts';
import { createPolicySnapshot } from '../src/learning/policy-snapshot.ts';
import type { WorkerCommand,WorkerMessageListener,WorkerErrorListener } from '../src/core/worker-protocol.ts';
class Port {
  listeners=new Set<WorkerMessageListener>();terminated=false;sent:WorkerCommand[]=[];
  postMessage(m:WorkerCommand){this.sent.push(m);}
  addEventListener(type:'message'|'error',listener:WorkerMessageListener|WorkerErrorListener){if(type==='message')this.listeners.add(listener as WorkerMessageListener);}
  removeEventListener(type:'message'|'error',listener:WorkerMessageListener|WorkerErrorListener){if(type==='message')this.listeners.delete(listener as WorkerMessageListener);}
  terminate(){this.terminated=true;}
  emit(data:unknown){for(const f of this.listeners)f({data});}
}
test('practice owns cancellation, pause, stale events, supersession and completed snapshots',async()=>{
  const ports:Port[]=[];const session=new PracticeSession(()=>{const p=new Port();ports.push(p);return p;});
  const snapshot=createPolicySnapshot(new BernoulliPolicy(1),{stage:'imitation'});
  const input={snapshot,episodeBudget:2,stepBudget:500,environmentSeed:1000,actionSeed:9000};
  const first=session.start(input);const failedFirst=assert.rejects(first.promise,/superseded/);
  session.pause();session.resume();
  assert.deepEqual(ports[0]!.sent.slice(1).map(m=>m.type),['pause','resume']);
  const second=session.start(input);await failedFirst;
  ports[0]!.emit({type:'complete',jobId:first.jobId,result:{snapshot:{}}});
  assert.deepEqual(session.completedSnapshot?.parameters,snapshot.parameters);
  session.cancel();await assert.rejects(second.promise,/cancelled/);
  assert.ok(ports[1]!.terminated);
  const third=session.start(input);
  const changed=createPolicySnapshot(new BernoulliPolicy(2),{stage:'post_rl'});
  ports[2]!.emit({type:'complete',jobId:third.jobId,result:{snapshot:changed}});
  await third.promise;
  assert.deepEqual(session.completedSnapshot?.parameters,changed.parameters);
  const fourth=session.start(input);session.dispose();await assert.rejects(fourth.promise,/disposed/);
  assert.ok(ports[3]!.terminated);
});
