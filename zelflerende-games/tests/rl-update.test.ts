import assert from 'node:assert/strict';
import test from 'node:test';
import { BernoulliPolicy,flattenPolicyParameters,unflattenPolicyParameters } from '../src/learning/policy.ts';
import { createPolicySnapshot } from '../src/learning/policy-snapshot.ts';
import { updateReinforcementPolicy } from '../src/learning/rl-update.ts';
import { rlObjective } from '../src/learning/rl-objective.ts';
import type { RolloutEpisode } from '../src/learning/rollout.ts';
const episode=(reward:number):RolloutEpisode=>({environmentSeed:1000,actionSeed:1,
  steps:[{observation:[1,0,0,0,0],action:1,reward}],
  result:{survivalSteps:1,pipesPassed:0,totalReward:reward,terminationReason:'floor'}});
test('reward sign changes update direction while frozen imitation stays intact',()=>{
  const p=new BernoulliPolicy(1,unflattenPolicyParameters(Array(57).fill(0)));
  const snapshot=createPolicySnapshot(p,{stage:'imitation'}); const saved=JSON.stringify(snapshot);
  updateReinforcementPolicy(p,[episode(2)]);
  assert.ok(p.parameters.outputBias>0);
  const q=new BernoulliPolicy(1,snapshot.parameters); updateReinforcementPolicy(q,[episode(-2)]);
  assert.ok(q.parameters.outputBias<0);
  assert.equal(JSON.stringify(snapshot),saved);
  assert.throws(()=>updateReinforcementPolicy(p,[]),/empty/);
});
test('RL raw gradients agree with central finite differences through all57 parameters',()=>{
  const flat=Array.from({length:57},(_,i)=>Math.sin(i+1)*.1);
  const p=unflattenPolicyParameters(flat);
  const episodes=[{...episode(2),steps:[{observation:[.2,-.4,.7,-.1,.3],action:1 as const,reward:2},{observation:[-.5,.4,.1,.2,-.3],action:0 as const,reward:-.3}]}];
  const analytic=rlObjective(p,episodes).gradient; const eps=1e-5;
  let maxError=0;
  flat.forEach((v,i)=>{
    const plus=[...flat],minus=[...flat]; plus[i]=v+eps;minus[i]=v-eps;
    const numerical=(rlObjective(unflattenPolicyParameters(plus),episodes).loss-rlObjective(unflattenPolicyParameters(minus),episodes).loss)/(2*eps);
    maxError=Math.max(maxError,Math.abs(numerical-analytic[i]!));
  });
  assert.ok(maxError<1e-8,`max gradient error ${maxError}`);
  assert.equal(flattenPolicyParameters(p).length,57);
});
