export const PARALLEL_ROUND_OPTIONS = Object.freeze([16, 32, 64, 256, 1024] as const);
export const MAX_PARALLEL_ROUNDS = 1024;
export const MAX_PARALLEL_STEPS = 1024 * 24 * 1800;
export type ParallelPracticeMode = 'live' | 'fast';
export function parallelPracticeMode(rounds: number): ParallelPracticeMode {
  return rounds >= 256 ? 'fast' : 'live';
}
export function parallelPracticeStepBudget(rounds: number, agents: number): number {
  return Math.min(MAX_PARALLEL_STEPS, rounds * agents * 1800);
}
