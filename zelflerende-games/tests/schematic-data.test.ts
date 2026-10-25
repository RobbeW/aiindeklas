import test from 'node:test';
import assert from 'node:assert/strict';
import { createRewardAttempt,createCoverageCollections,coveredKinds,coverageKinds,dataRoles,FrozenChoiceExample } from '../src/flappy/schematic-data.ts';
import { createInitialPolicyParameters,BernoulliPolicy } from '../src/learning/policy.ts';
import { createPolicySnapshot } from '../src/learning/policy-snapshot.ts';
import { createSeededRandom } from '../src/core/random.ts';
import { createObservationExamples } from '../src/flappy/observation-examples.ts';

test('reward explanation adds every real step and keeps opening bonus and collision replacement distinct',()=>{
 const {frames,moments}=createRewardAttempt();let total=0;
 for(const f of frames){total+=f.reward;assert.equal(f.total,total);assert.equal(f.step,f.world.steps);}
 assert.equal(moments[0]!.reward,.01);assert.equal(moments[1]!.reward,1.01);assert.equal(moments[2]!.reward,-1);assert.equal(moments[1]!.score,1);assert.equal(moments[2]!.score,1);
 assert.equal(moments[2]!.total,frames.at(-1)!.total);assert.notEqual(moments[2]!.total,moments[2]!.score);assert.ok(moments[2]!.total<moments[1]!.total);
});
test('coverage examples count real situations independently without assigning a quality score',()=>{
 const {waiting,varied}=createCoverageCollections();assert.equal(waiting.total,40);assert.equal(waiting.counts.rising,0);assert.equal(waiting.counts.high,0);assert.ok(waiting.counts.falling>0);
 for(const k of coverageKinds){assert.ok(varied.counts[k]>0);assert.ok(coveredKinds(varied.examples[k]!).includes(k));}
 const frame={step:0,action:0 as const,observation:[0,0,1,0,0]};assert.deepEqual(coveredKinds(frame),[]);
 assert.equal(dataRoles.training.changes,true);assert.equal(dataRoles.control.changes,false);assert.equal(dataRoles.test.changes,false);
});
test('twelve choices use one exact frozen policy, independent RNGs and repeatable reset',()=>{
 const parameters={...createInitialPolicyParameters(12),outputBias:0},policy=new BernoulliPolicy(12,parameters),snapshot=createPolicySnapshot(policy,{stage:'imitation'}),before=JSON.stringify(snapshot),observation=createObservationExamples()[0]!.observation;
 const demo=new FrozenChoiceExample(snapshot),streams=Array.from({length:12},(_,i)=>createSeededRandom(8000+i));
 const first=demo.choose(observation);assert.equal(first.probability,.5);assert.deepEqual(first.actions,streams.map(random=>policy.sampleAction(observation,random)));
 for(let i=0;i<5;i++)assert.deepEqual(demo.choose(observation).actions,streams.map(random=>policy.sampleAction(observation,random)));
 demo.reset();assert.deepEqual(demo.choose(observation),first);assert.equal(JSON.stringify(snapshot),before);assert.equal(JSON.stringify(demo.snapshot.parameters),JSON.stringify(snapshot.parameters));
 assert.equal(demo.snapshot.trainingCounts.reinforcementEpisodes,0);
});
