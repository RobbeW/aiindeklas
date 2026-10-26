import { evaluateFlappy } from '../evaluation/runner.ts';
import type { PolicySnapshot } from './policy-snapshot.ts';

/** Validation only: never supplied to the reward updater or used to select weights. */
export const PRACTICE_CHECK_SEEDS = Object.freeze([2080, 2081, 2082, 2083, 2084]);
export interface PracticeCheckScore {
  readonly meanScore: number;
  readonly meanSurvivalSteps: number;
  readonly meanReward: number;
}
export interface PracticeModelCheck {
  readonly seeds: readonly number[];
  readonly before: PracticeCheckScore;
  readonly after: PracticeCheckScore;
}
export function checkPracticeModel(snapshot: PolicySnapshot): PracticeCheckScore {
  const rows = evaluateFlappy(snapshot, PRACTICE_CHECK_SEEDS);
  const mean = (get: (row: typeof rows[number]) => number) => rows.reduce((sum, row) => sum + get(row), 0) / rows.length;
  return Object.freeze({meanScore: mean(row => row.result.pipesPassed!),
    meanSurvivalSteps: mean(row => row.result.survivalSteps), meanReward: mean(row => row.result.totalReward)});
}
export function comparePracticeModels(before: PolicySnapshot, after: PolicySnapshot): PracticeModelCheck {
  return Object.freeze({seeds: PRACTICE_CHECK_SEEDS, before: checkPracticeModel(before), after: checkPracticeModel(after)});
}
/** Imported summaries are bounded and keep the exact meaning of these five fixed checks. */
export function validatePracticeModelCheck(value: unknown): PracticeModelCheck {
  const check = value as PracticeModelCheck;
  if (!check || JSON.stringify(check.seeds) !== JSON.stringify(PRACTICE_CHECK_SEEDS)) throw new Error('Invalid practice check sequences');
  const score = (s: PracticeCheckScore): PracticeCheckScore => {
    if (!s || ![s.meanScore,s.meanSurvivalSteps,s.meanReward].every(Number.isFinite) ||
        s.meanScore < 0 || s.meanScore > 1800 || s.meanSurvivalSteps < 1 || s.meanSurvivalSteps > 1800 ||
        s.meanReward < -1 || s.meanReward > 2000) throw new Error('Invalid practice check score');
    return Object.freeze({meanScore:s.meanScore,meanSurvivalSteps:s.meanSurvivalSteps,meanReward:s.meanReward});
  };
  return Object.freeze({seeds:PRACTICE_CHECK_SEEDS,before:score(check.before),after:score(check.after)});
}
