import test from 'node:test';
import assert from 'node:assert/strict';
import { advanceSkinnerBox, createSkinnerBoxState, resetSkinnerBox } from '../src/flappy/skinner-box-model.ts';

test('green light gives one food reward and red waiting never adds a shock', () => {
  let state = createSkinnerBoxState();
  assert.deepEqual(state, { step: 'green-observe', illustrativeRewards: 0, illustrativePenalties: 0 });
  state = advanceSkinnerBox(state);
  assert.equal(state.step, 'green-press');
  assert.equal(state.illustrativeRewards, 0);
  state = advanceSkinnerBox(state);
  assert.equal(state.step, 'green-food');
  assert.equal(state.illustrativeRewards, 1);
  assert.equal(state.illustrativePenalties, 0);
  state = advanceSkinnerBox(state);
  assert.equal(state.step, 'red-observe');
  state = advanceSkinnerBox(state);
  assert.equal(state.step, 'red-press');
  assert.equal(state.illustrativePenalties, 0);
  state = advanceSkinnerBox(state);
  assert.equal(state.step, 'red-shock');
  assert.equal(state.illustrativePenalties, 1);
  state = advanceSkinnerBox(state);
  assert.equal(state.step, 'red-wait');
  assert.equal(state.illustrativePenalties, 1);
  state = advanceSkinnerBox(state);
  assert.equal(state.step, 'green-observe');
  assert.equal(state.illustrativePenalties, 1);
});

test('reset clears both illustrative counters and starts at green', () => {
  const state = resetSkinnerBox();
  assert.deepEqual(state, { step: 'green-observe', illustrativeRewards: 0, illustrativePenalties: 0 });
});
