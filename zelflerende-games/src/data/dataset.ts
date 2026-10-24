import { DEMONSTRATION_VERSION, type DemonstrationEpisode, type DemonstrationFrame } from './demonstrations.ts';
import { FLAPPY_WORLD_CONFIG_VERSION, FLAPPY_OBSERVATION_VERSION, FLAPPY_SEQUENCE_VERSION, EPISODE_HORIZON_STEPS } from '../flappy/environment.ts';
import { PHYSICS } from '../flappy/physics.ts';

function requireValid(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`Invalid demonstration: ${message}`);
}
export function validateEpisode(value: unknown): DemonstrationEpisode {
  requireValid(!!value && typeof value === 'object', 'episode object required');
  const e = value as DemonstrationEpisode;
  requireValid(e.version === DEMONSTRATION_VERSION && e.worldVersion === FLAPPY_WORLD_CONFIG_VERSION &&
    e.observationVersion === FLAPPY_OBSERVATION_VERSION && e.sequenceVersion === FLAPPY_SEQUENCE_VERSION, 'incompatible version');
  requireValid(typeof e.id === 'string' && e.id.trim().length > 0, 'id');
  requireValid(['human','synthetic_reference'].includes(e.source), 'source');
  requireValid(Number.isSafeInteger(e.seed), 'seed');
  requireValid(Array.isArray(e.frames) && e.frames.length > 0 && e.frames.length <= EPISODE_HORIZON_STEPS, 'frames');
  for (const [index,f] of e.frames.entries()) {
    requireValid(!!f && f.step === index && (f.action === 0 || f.action === 1), 'step/action');
    requireValid(Array.isArray(f.observation) && f.observation.length === 5 &&
      f.observation.every((x: unknown) => typeof x === 'number' && Number.isFinite(x) && Math.abs(x) <= 1), 'observation');
  }
  requireValid(Number.isFinite(e.durationSeconds) && Math.abs(e.durationSeconds-e.frames.length*PHYSICS.dt)<1e-9, 'duration');
  requireValid(!!e.result && e.result.survivalSteps === e.frames.length && Number.isFinite(e.result.totalReward) &&
    Number.isInteger(e.result.pipesPassed) && e.result.pipesPassed >= 0 &&
    ['floor','ceiling','pipe_collision','time_limit'].includes(e.result.terminationReason), 'terminal result');
  requireValid(e.result.terminationReason !== 'time_limit' || e.frames.length === EPISODE_HORIZON_STEPS, 'time limit');
  return Object.freeze({ ...e, result: Object.freeze({...e.result}), frames: Object.freeze(e.frames.map(f =>
    Object.freeze({...f,observation:Object.freeze([...f.observation])}))) });
}
export function classBalance(frames: readonly DemonstrationFrame[]) {
  const flaps = frames.reduce((sum,f) => sum+f.action,0);
  return Object.freeze({ flaps, waits:frames.length-flaps, total:frames.length,
    diagnostic:frames.length === 0 ? 'empty' : flaps === 0 ? 'all_wait' : flaps === frames.length ? 'all_flap' : 'mixed' });
}
/** Stable complete-episode holdout; callers record order and IDs for reproducibility. */
export function splitEpisodes(values: readonly unknown[], validationCount = 1) {
  if (!Number.isInteger(validationCount) || validationCount < 1 || validationCount >= values.length) throw new Error('need nonempty training and validation episodes');
  const episodes = values.map(validateEpisode);
  if (new Set(episodes.map(e=>e.id)).size !== episodes.length) throw new Error('duplicate episode id');
  if (new Set(episodes.map(e=>e.seed)).size !== episodes.length) throw new Error('duplicate sequence seed across demonstration split');
  const training = Object.freeze(episodes.slice(0,-validationCount));
  const validation = Object.freeze(episodes.slice(-validationCount));
  return Object.freeze({training,validation,
    trainingBalance:classBalance(training.flatMap(e=>e.frames)),
    validationBalance:classBalance(validation.flatMap(e=>e.frames))});
}
