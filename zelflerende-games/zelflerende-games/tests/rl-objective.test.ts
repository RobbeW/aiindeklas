import assert from 'node:assert/strict';
import test from 'node:test';
import { rewardToGo,rlObjective } from '../src/learning/rl-objective.ts';
import { unflattenPolicyParameters } from '../src/learning/policy.ts';
import type { RolloutEpisode } from '../src/learning/rollout.ts';
const p=unflattenPolicyParameters(Array(57).fill(0));
function fixture(rewards:number[],actions:(0|1)[]):RolloutEpisode {
  return {environmentSeed:1000,actionSeed:1,steps:rewards.map((reward,i)=>({reward,action:actions[i]!,observation:[1,0,0,0,0]})),
    result:{survivalSteps:rewards.length,pipesPassed:0,totalReward:rewards.reduce((a,b)=>a+b,0),terminationReason:'floor'}};
}
test('hand returns and logit gradient distinguish episode averaging from frame averaging',()=>{
  assert.deepEqual(rewardToGo([1,-1]),[0,-1]);
  assert.deepEqual(rewardToGo([0,0]),[0,0]);
  assert.deepEqual(rewardToGo([2,2]),[4,2]);
  assert.equal(rlObjective(p,[fixture([2],[1])]).gradient[56],-1);
  assert.equal(rlObjective(p,[fixture([-2],[1])]).gradient[56],1);
  assert.equal(rlObjective(p,[fixture([1,-1],[1,0])]).gradient[56],-.5);
  assert.equal(rlObjective(p,[fixture([1,-1],[1,0]),fixture([2],[1])]).gradient[56],-.75);
  assert.throws(()=>rewardToGo([Infinity]),/finite/);
  assert.throws(()=>rewardToGo([1e308,1e308]),/nonfinite/);
});
