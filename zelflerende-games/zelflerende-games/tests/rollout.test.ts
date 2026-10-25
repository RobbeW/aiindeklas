import assert from 'node:assert/strict';
import test from 'node:test';
import { collectBatch,collectEpisode } from '../src/learning/rollout.ts';
import { createInitialPolicyParameters,flattenPolicyParameters } from '../src/learning/policy.ts';
import { FlappyEnvironment } from '../src/flappy/environment.ts';
test('seeded on-policy rollouts replay pre-action states and rewards through terminal/reset',()=>{
  const p=createInitialPolicyParameters(10); const before=flattenPolicyParameters(p);
  const batch=collectBatch(p,[{environmentSeed:1000,actionSeed:9000},{environmentSeed:1001,actionSeed:9001}]);
  for (const episode of batch) {
    const env=new FlappyEnvironment(); env.reset({seed:episode.environmentSeed});
    for (const s of episode.steps) {
      assert.deepEqual(s.observation,env.getObservation());
      assert.equal(env.step(s.action).reward,s.reward);
    }
    assert.deepEqual(episode.result,env.completedResult);
    assert.equal(episode.steps.length,episode.result.survivalSteps);
    assert.equal(episode.steps.at(-1)?.reward,-1);
  }
  assert.deepEqual(collectEpisode(p,1000,9000),batch[0]);
  assert.deepEqual(flattenPolicyParameters(p),before);
  assert.throws(()=>collectEpisode(p,2000,9000),/training namespace/);
  assert.throws(()=>collectEpisode(p,3000,9000),/training namespace/);
});
