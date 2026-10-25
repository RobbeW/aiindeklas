export type SkinnerStep = 'observe' | 'action' | 'feedback' | 'next';

export interface SkinnerBoxState {
  readonly step: SkinnerStep;
  readonly illustrativeRewards: number;
}

export const createSkinnerBoxState = (): SkinnerBoxState => Object.freeze({ step: 'observe', illustrativeRewards: 0 });

const nextStep: Readonly<Record<SkinnerStep, SkinnerStep>> = Object.freeze({
  observe: 'action', action: 'feedback', feedback: 'next', next: 'observe',
});

/** Advances the drawing's four-part example; this never changes a game policy. */
export function advanceSkinnerBox(state: SkinnerBoxState): SkinnerBoxState {
  const step = nextStep[state.step];
  return Object.freeze({ step, illustrativeRewards: state.illustrativeRewards + (step === 'feedback' ? 1 : 0) });
}

export function resetSkinnerBox(): SkinnerBoxState { return createSkinnerBoxState(); }
