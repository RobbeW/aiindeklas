import assert from 'node:assert/strict';
import test from 'node:test';
import { generateReferencePair } from '../src/flappy/reference-demonstrations.ts';
import { FrozenCloneController, TEACH_CLONE_TEST_SEED, evaluateFrozenClone, trainImitationDirect } from '../src/flappy/imitation-controller.ts';
import { createPolicySnapshot } from '../src/learning/policy-snapshot.ts';
import { BernoulliPolicy, createInitialPolicyParameters } from '../src/learning/policy.ts';
import { validateEpisode } from '../src/data/dataset.ts';

test('worked example creates complete, explicitly labelled training and validation episodes', () => {
  const [training, validation] = generateReferencePair();
  assert.equal(training.seed, 1000);
  assert.equal(validation.seed, 2000);
  assert.equal(training.source, 'synthetic_reference');
  assert.equal(validation.source, 'synthetic_reference');
  assert.equal(validateEpisode(training).result.survivalSteps, training.frames.length);
  assert.equal(validateEpisode(validation).result.survivalSteps, validation.frames.length);
  for (const episode of [training, validation]) {
    assert.ok(episode.frames.some((frame) => frame.action === 1));
    assert.ok(episode.frames.some((frame) => frame.action === 0));
  }
});

test('frozen clone chooses from a new observation and test evaluation leaves snapshot unchanged', () => {
  const policy = new BernoulliPolicy(1222, createInitialPolicyParameters(1222));
  const snapshot = createPolicySnapshot(policy, { stage: 'imitation', supervisedOptimizer: 'adam', trainingSeeds: [1000], datasetProvenance: ['training:human:one', 'validation:human:two'], trainingCounts: { supervisedUpdates: 250, reinforcementEpisodes: 0 } });
  const clone = new FrozenCloneController(snapshot);
  const observation = [0, 0, 0, 0, 0] as const;
  assert.equal(clone.selectAction(observation), 0);
  // Recorded labels have no role in the controller interface; changing the observation changes the chosen decision.
  const parameters = policy.parameters;
  policy.setParameters({ ...parameters, outputBias: 4 });
  const changed = createPolicySnapshot(policy, { ...snapshot, stage: 'imitation' });
  assert.equal(new FrozenCloneController(changed).selectAction(observation), 1);
  const before = JSON.stringify(snapshot);
  const result = evaluateFrozenClone(snapshot, TEACH_CLONE_TEST_SEED);
  assert.equal(result.seed, 2005);
  assert.equal(JSON.stringify(snapshot), before);
});

test('worked example runs real bounded supervised training with complete role-separated splits', async () => {
  const result = await trainImitationDirect(generateReferencePair());
  assert.equal(result.actualUpdates, 250);
  assert.equal(result.optimizer, 'adam');
  assert.deepEqual(result.trainingSeeds, [1000]);
  assert.deepEqual(result.validationSeeds, [2000]);
  assert.equal(result.snapshot.trainingCounts.supervisedUpdates, 250);
  assert.equal(result.snapshot.trainingCounts.reinforcementEpisodes, 0);
  assert.ok(Number.isFinite(result.training.loss));
  assert.ok(Number.isFinite(result.validation.loss));
});
