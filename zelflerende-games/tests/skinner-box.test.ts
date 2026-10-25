import test from 'node:test';
import assert from 'node:assert/strict';
import { advanceSkinnerBox, createSkinnerBoxState, resetSkinnerBox } from '../src/flappy/skinner-box-model.ts';

test('illustrative reward increments once on each feedback step and reset clears the drawing', () => {
  let state = createSkinnerBoxState();
  assert.deepEqual(state, { step: 'observe', illustrativeRewards: 0 });
  state = advanceSkinnerBox(state);
  assert.deepEqual(state, { step: 'action', illustrativeRewards: 0 });
  state = advanceSkinnerBox(state);
  assert.deepEqual(state, { step: 'feedback', illustrativeRewards: 1 });
  state = advanceSkinnerBox(state);
  assert.deepEqual(state, { step: 'next', illustrativeRewards: 1 });
  state = advanceSkinnerBox(state);
  assert.deepEqual(state, { step: 'observe', illustrativeRewards: 1 });
  state = advanceSkinnerBox(advanceSkinnerBox(state));
  assert.deepEqual(state, { step: 'feedback', illustrativeRewards: 2 });
  assert.deepEqual(resetSkinnerBox(), { step: 'observe', illustrativeRewards: 0 });
});
