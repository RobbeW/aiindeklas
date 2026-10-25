import test from 'node:test';
import assert from 'node:assert/strict';
import { chooseRecording,inspectRecording,recordingRole } from '../src/flappy/recording-examples.ts';
import { generateReferencePair } from '../src/flappy/reference-demonstrations.ts';
import { FlappyEnvironment } from '../src/flappy/environment.ts';
import { createPolicySnapshot } from '../src/learning/policy-snapshot.ts';
import { BernoulliPolicy,flattenPolicyParameters } from '../src/learning/policy.ts';
import { feedbackSteps,inspectHandoff,nextFeedbackStep } from '../src/flappy/handoff-explainer-state.ts';

test('recording cards preserve pre-action measurements and recorded labels in both roles',()=>{
 const pair=generateReferencePair();
 assert.equal(recordingRole(pair[0]),'training');assert.equal(recordingRole(pair[1]),'validation');
 for(const role of ['training','validation'] as const){
  const chosen=chooseRecording(pair,role),before=JSON.stringify(chosen.episode),samples=chosen.examples;
  const env=new FlappyEnvironment();env.reset({seed:chosen.episode.seed});
  let checked=0;
  for(const frame of chosen.episode.frames){
   const sample=samples.find(s=>s.frame.step===frame.step);
   if(sample){assert.deepEqual(sample.frame.observation,env.getObservation());assert.deepEqual(sample.world,env.world);assert.equal(sample.frame.action,frame.action);checked++;}
   if(checked===samples.length)break;env.step(frame.action);
  }
  assert.equal(checked,4);assert.ok(samples.some(s=>s.frame.action===1));assert.equal(JSON.stringify(chosen.episode),before);
 }
});
test('missing recordings use labelled synthetic fixtures; inconsistent imports do not overwrite data',()=>{
 const a=chooseRecording([],'training'),b=chooseRecording([],'validation');
 assert.equal(a.episode.source,'synthetic_reference');assert.notEqual(a.episode.seed,b.episode.seed);
 const human={...a.episode,id:'human-example',source:'human' as const};assert.equal(chooseRecording([a.episode,human],'training').episode.id,'human-example');
 const frames=a.episode.frames.map((f,i)=>i===a.examples[0]!.frame.step?{...f,observation:[0,0,0,0,0]}:f);
 const inconsistent={...a.episode,frames};const original=JSON.stringify(inconsistent);
 assert.throws(()=>inspectRecording(inconsistent));const fallback=chooseRecording([inconsistent],'training');assert.equal(fallback.fallback,true);assert.equal(JSON.stringify(inconsistent),original);
});
test('switching feedback descriptions preserves the exact saved imitation at the handoff',()=>{
 const policy=new BernoulliPolicy(1222),snapshot=createPolicySnapshot(policy,{stage:'imitation',trainingCounts:{supervisedUpdates:250,reinforcementEpisodes:0}}),original=JSON.stringify(snapshot);
 const first=inspectHandoff(snapshot);
 for(const mode of ['examples','rewards'] as const){let step=0;for(let i=0;i<8;i++){assert.ok(feedbackSteps[mode][step]!.text);step=nextFeedbackStep(step);assert.deepEqual(inspectHandoff(snapshot).parameters,first.parameters);assert.equal(inspectHandoff(snapshot).modelId,first.modelId);}}
 assert.deepEqual(first.parameters,flattenPolicyParameters(policy.parameters));assert.equal(JSON.stringify(snapshot),original);
 assert.equal(inspectHandoff().available,false);assert.throws(()=>inspectHandoff(createPolicySnapshot(policy,{stage:'initial'})));assert.throws(()=>nextFeedbackStep(4));
});
