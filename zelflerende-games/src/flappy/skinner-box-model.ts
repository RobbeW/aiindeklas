export type SkinnerStep = 'green-observe' | 'green-press' | 'green-food' | 'red-observe' | 'red-press' | 'red-shock' | 'red-wait';

export interface SkinnerBoxState {
  readonly step: SkinnerStep;
  readonly illustrativeRewards: number;
  readonly illustrativePenalties: number;
}

export const createSkinnerBoxState = (): SkinnerBoxState => Object.freeze({ step: 'green-observe', illustrativeRewards: 0, illustrativePenalties: 0 });

const nextStep: Readonly<Record<SkinnerStep, SkinnerStep>> = Object.freeze({
  'green-observe': 'green-press', 'green-press': 'green-food', 'green-food': 'red-observe',
  'red-observe': 'red-press', 'red-press': 'red-shock', 'red-shock': 'red-wait', 'red-wait': 'green-observe',
});

/** Advances an adapted classroom illustration; it does not model historical protocol or learn a policy. */
export function advanceSkinnerBox(state: SkinnerBoxState): SkinnerBoxState {
  const step = nextStep[state.step];
  return Object.freeze({
    step,
    illustrativeRewards: state.illustrativeRewards + (step === 'green-food' ? 1 : 0),
    illustrativePenalties: state.illustrativePenalties + (step === 'red-shock' ? 1 : 0),
  });
}

export function resetSkinnerBox(): SkinnerBoxState { return createSkinnerBoxState(); }
