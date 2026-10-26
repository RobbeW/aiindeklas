import test from 'node:test';import assert from 'node:assert/strict';
import { FlappyFlock,advanceVisualClock,flockLeader } from '../src/flappy/flock.ts';
import { BernoulliPolicy } from '../src/learning/policy.ts';
import { createPolicySnapshot,restorePolicySnapshot } from '../src/learning/policy-snapshot.ts';
import { FlappyEnvironment } from '../src/flappy/environment.ts';
import { createSeededRandom } from '../src/core/random.ts';
const snapshot=createPolicySnapshot(new BernoulliPolicy(1222),{stage:'imitation',trainingCounts:{supervisedUpdates:250,reinforcementEpisodes:0}});

test('live flock matches each independent policy/environment trajectory with common openings and immutable checkpoint',()=>{
 const before=structuredClone(snapshot),flock=new FlappyFlock(snapshot,12),individual=Array.from({length:12},(_,i)=>{const env=new FlappyEnvironment();env.reset({seed:2005});return{env,policy:restorePolicySnapshot(snapshot),rng:createSeededRandom(5000+i)};});
 for(let tick=0;tick<1800&&!flock.done;tick++){flock.step();for(const b of individual)if(!b.env.completedResult)b.env.step(b.policy.sampleAction(b.env.getObservation(),b.rng));
  const live=flock.birds.filter(b=>!b.done);for(const b of live)assert.deepEqual(b.world.pipes,live[0]!.world.pipes);
 }
 assert.equal(flock.done,true);assert.equal(flock.birds.length,12);assert.deepEqual(snapshot,before);assert.deepEqual(flock.snapshot,snapshot);
 for(const [i,b]of flock.birds.entries()){assert.deepEqual(b.world,individual[i]!.env.world);assert.deepEqual(b.result,individual[i]!.env.completedResult);}
 assert.ok(new Set(flock.birds.map(b=>b.world.steps)).size>1,'independent choices produce visible outcome differences');
 const leader=flockLeader(flock.birds)!;assert.equal(leader.pipesPassed,Math.max(...flock.birds.map(b=>b.pipesPassed)));assert.ok(Object.isFrozen(flock.birds[0]?.world));
});

test('visual speed changes wall pacing only; equal simulated time preserves all birds exactly',()=>{
 const run=(frames:number,speed:number)=>{const flock=new FlappyFlock(snapshot);let remainder=0;for(let f=0;f<frames;f++){const next=advanceVisualClock(10,remainder,speed);remainder=next.accumulatorMs;for(let i=0;i<next.steps;i++)flock.step();}return flock.birds;};
 assert.deepEqual(run(160,.5),run(10,8));assert.deepEqual(run(80,1),run(40,2));
 assert.equal(advanceVisualClock(10000,0,1).steps,6);assert.throws(()=>advanceVisualClock(10,0,9));assert.throws(()=>new FlappyFlock(snapshot,33));assert.throws(()=>new FlappyFlock({...snapshot,inputCount:6} as never));
});
