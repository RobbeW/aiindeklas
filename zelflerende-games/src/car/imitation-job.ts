import { validateCarSnapshot, restoreCarSnapshot, createCarSnapshot, type CarSnapshot } from './policy-adapter.ts';
import { validateCarEpisode, splitCarEpisodes, type CarEpisode } from './recorder.ts';
import { CarPolicy } from './policy-adapter.ts';
import { AdamOptimizer } from '../learning/adam.ts';

export interface CarImitationJobInput {
  readonly initialSnapshot: CarSnapshot;
  readonly episodes: readonly CarEpisode[];
  readonly updateBudget: number;
}
export interface CarImitationProgress {
  readonly completedUpdates: number;
  readonly trainingLoss: number;
  readonly controlLoss: number;
  readonly elapsedMs: number;
}
export interface CarImitationJobResult {
  readonly snapshot: CarSnapshot;
  readonly completedUpdates: number;
  readonly trainingLoss: number;
  readonly controlLoss: number;
  readonly elapsedMs: number;
}
// Short names used by the car teaching view and worker callers.
export type CarImitationInput = CarImitationJobInput;
export type CarImitationResult = CarImitationJobResult;
export interface CarImitationJobHooks {
  readonly isCancelled?: () => boolean;
  readonly isPaused?: () => boolean;
  readonly onProgress?: (progress: CarImitationProgress) => void;
  readonly yieldControl?: () => Promise<void>;
  readonly now?: () => number;
}
export class CarImitationJobCancelledError extends Error {
  constructor() { super('Car imitation job cancelled'); this.name = 'CarImitationJobCancelledError'; }
}
const defaultYield = () => new Promise<void>(resolve => setTimeout(resolve, 0));
const rate = 0.01;

function loss(policy: CarPolicy, episodes: readonly CarEpisode[]): number {
  let sum = 0, count = 0;
  for (const episode of episodes) for (const frame of episode.frames) {
    sum += policy.lossAndGradient(frame.observation, frame.action).loss;
    count++;
  }
  const value = sum / count;
  if (!Number.isFinite(value)) throw new RangeError('Car imitation loss is non-finite');
  return value;
}

/** Full-mean cross-entropy imitation on complete training episodes with a separately reported control split. */
export async function runCarImitationJob(input: CarImitationJobInput, hooks: CarImitationJobHooks = {}): Promise<CarImitationJobResult> {
  if (!input || typeof input !== 'object') throw new TypeError('Car imitation job input is required');
  if (!Number.isSafeInteger(input.updateBudget) || input.updateBudget < 1 || input.updateBudget > 1000) throw new RangeError('updateBudget must be an integer from 1 to 1000');
  const baseline = validateCarSnapshot(input.initialSnapshot);
  if (!Array.isArray(input.episodes)) throw new TypeError('episodes must be an array');
  // Validate copied data too: worker structured cloning removes frozen state and prototypes.
  const copied = input.episodes.map(value => validateCarEpisode(value));
  if (copied.some(e => e.worldVersion !== baseline.worldVersion)) throw new Error('Car imitation cannot mix world versions');
  const split = splitCarEpisodes(copied);
  if (!split.training.length || !split.control.length) throw new RangeError('Car imitation requires nonempty training and control splits');
  for (const episode of split.training) {
    if (episode.seed < 1000 || episode.seed > 1999) throw new RangeError('Training episodes must use training seeds 1000..1999');
  }
  const policy = restoreCarSnapshot(baseline);
  const adam = new AdamOptimizer({ parameterCount: 83 });
  const trainFrames = split.training.flatMap(e => e.frames);
  let trainingLoss = loss(policy, split.training);
  let controlLoss = loss(policy, split.control);
  const now = hooks.now ?? (() => performance.now());
  let started = now(), pausedMs = 0;
  const elapsed = () => Math.max(0, now() - started - pausedMs);
  for (let completed = 0; completed < input.updateBudget; completed++) {
    if (hooks.isCancelled?.()) throw new CarImitationJobCancelledError();
    while (hooks.isPaused?.()) {
      const pauseStart = now();
      await (hooks.yieldControl ?? defaultYield)();
      pausedMs += Math.max(0, now() - pauseStart);
      if (hooks.isCancelled?.()) throw new CarImitationJobCancelledError();
    }
    const gradient = Array<number>(83).fill(0);
    for (const frame of trainFrames) {
      const sample = policy.lossAndGradient(frame.observation, frame.action);
      for (let i = 0; i < gradient.length; i++) gradient[i] += sample.gradient[i]! / trainFrames.length;
    }
    const step = adam.update(policy.parameters, gradient, rate);
    policy.setParameters(step.parameters);
    trainingLoss = loss(policy, split.training);
    controlLoss = loss(policy, split.control);
    hooks.onProgress?.(Object.freeze({ completedUpdates: completed + 1, trainingLoss, controlLoss, elapsedMs: elapsed() }));
    await (hooks.yieldControl ?? defaultYield)();
  }
  if (hooks.isCancelled?.()) throw new CarImitationJobCancelledError();
  const actualMs = elapsed();
  const training = baseline.training;
  const snapshot = createCarSnapshot(policy, 'imitation', {
    ...training,
    sources: [...training.sources, ...split.training.map(e => `training:${e.source}:${e.id}`)],
    trackIds: [...training.trackIds, ...new Set(split.training.map(e => e.trackId))],
    trainingSeeds: [...training.trainingSeeds, ...split.training.map(e => e.seed)],
    supervisedUpdates: training.supervisedUpdates + input.updateBudget,
    demonstrationSeconds: training.demonstrationSeconds + split.training.reduce((s, e) => s + e.durationSeconds, 0),
    wallTimeMs: training.wallTimeMs + actualMs,
    supervisedOptimizer: 'adam',
  });
  return Object.freeze({ snapshot, completedUpdates: input.updateBudget, trainingLoss, controlLoss, elapsedMs: actualMs });
}
