import assert from 'node:assert/strict';
import test from 'node:test';
import { collectEpisode, type RolloutEpisode } from '../src/learning/rollout.ts';
import { BernoulliPolicy, flattenPolicyParameters } from '../src/learning/policy.ts';
import { RewardTrainer } from '../src/learning/reward-trainer.ts';

function oneStep(reward:number):RolloutEpisode {
 return {environmentSeed:1000,actionSeed:1,steps:[{observation:[0,0,0,0,0],action:0,reward}],result:{pipesPassed:0,survivalSteps:1,totalReward:reward,terminationReason:'floor'}};
}

test('trainer validates empty and non-finite batches before applying updates',()=>{
 const policy=new BernoulliPolicy(7),trainer=new RewardTrainer();
 assert.throws(()=>trainer.update(policy,[]),/empty rollout batch/);
 assert.throws(()=>trainer.update(policy,[{...oneStep(1),steps:[]}]),/empty rollout batch/);
 assert.throws(()=>trainer.update(policy,[oneStep(Number.NaN)]),/nonfinite return/);
 assert.equal(trainer.update(policy,[oneStep(1)]).updates,1);
});

test('constant batch returns yield zero normalized gradient without disturbing exact input parameters',()=>{
 const policy=new BernoulliPolicy(18),before=flattenPolicyParameters(policy.parameters);
 const result=new RewardTrainer().update(policy,[oneStep(1)]);
 assert.equal(result.returnMean,1);assert.equal(result.returnScale,0);
 assert.deepEqual(flattenPolicyParameters(policy.parameters),before);
});

test('real sampled trajectories produce finite deterministic Adam updates',()=>{
 const source=new BernoulliPolicy(19),before=flattenPolicyParameters(source.parameters);
 const episode=collectEpisode(source.parameters,1000,2026);
 const a=new BernoulliPolicy(19,source.parameters),b=new BernoulliPolicy(19,source.parameters);
 const updateA=new RewardTrainer().update(a,[episode]),updateB=new RewardTrainer().update(b,[episode]);
 const after=flattenPolicyParameters(a.parameters);
 assert.deepEqual(flattenPolicyParameters(b.parameters),after);
 assert.notDeepEqual(after,before);assert.ok(after.every(Number.isFinite));
 assert.ok(Number.isFinite(updateA.rawGradientNorm));assert.equal(updateA.updates,1);
});
