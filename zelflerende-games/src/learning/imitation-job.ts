import type { DemonstrationEpisode, DemonstrationFrame } from "../data/demonstrations.ts";
import { validateEpisode } from "../data/dataset.ts";
import { BernoulliPolicy, flattenPolicyParameters, unflattenPolicyParameters } from "./policy.ts";
import { createPolicySnapshot, restorePolicySnapshot, type PolicySnapshot } from "./policy-snapshot.ts";
import { computeSupervisedBatchGradient, applyBoundedGradientDescent, DEFAULT_SUPERVISED_LEARNING_RATE } from "./imitation-update.ts";
import { AdamOptimizer } from "./adam.ts";

export interface ImitationJobInput {
  readonly initialSnapshot: PolicySnapshot;
  readonly episodes: readonly DemonstrationEpisode[];
  /** Whole-episode holdout IDs; all remaining episodes are training data. */
  readonly validationEpisodeIds: readonly string[];
  readonly updateBudget: number;
  readonly learningRate?: number;
  /** Defaults to the historical SGD update path. */
  readonly optimizer?: "sgd" | "adam";
  /** Used for snapshots and audit metadata; never drives sampling or data order. */
  readonly trainingSeed: number;
}
export interface ImitationMetrics {
  readonly loss: number;
  readonly flapCount: number;
  readonly waitCount: number;
  readonly sampleCount: number;
}
export interface ImitationProgress { readonly completedUpdates: number; readonly updateBudget: number; readonly training: ImitationMetrics; readonly validation: ImitationMetrics }
export interface ImitationJobResult {
  readonly optimizer: "sgd" | "adam";
  readonly snapshot: PolicySnapshot;
  readonly parameters: PolicySnapshot["parameters"];
  readonly actualUpdates: number;
  readonly training: ImitationMetrics;
  readonly validation: ImitationMetrics;
  readonly trainingEpisodeIds: readonly string[];
  readonly validationEpisodeIds: readonly string[];
  readonly trainingSeeds: readonly number[];
  readonly validationSeeds: readonly number[];
}
export interface ImitationJobHooks {
  readonly isCancelled?: () => boolean;
  readonly isPaused?: () => boolean;
  readonly onProgress?: (progress: ImitationProgress) => void;
  readonly yieldControl?: () => Promise<void>;
}
export class ImitationJobCancelledError extends Error { constructor() { super("Imitation job cancelled"); this.name = "ImitationJobCancelledError"; } }
const defaultYield = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

function assertSafeTrainingSeed(seed: number): void {
  if (!Number.isSafeInteger(seed) || seed < 1000 || seed > 1999) throw new RangeError("trainingSeed must be in the training namespace 1000..1999");
}
function metric(policy: BernoulliPolicy, frames: readonly DemonstrationFrame[]): ImitationMetrics {
  if (frames.length === 0) throw new RangeError("imitation split is empty");
  let loss = 0, flapCount = 0;
  for (const frame of frames) {
    const z = policy.logit(frame.observation);
    // Stable BCE: max(z,0) - a*z + log1p(exp(-abs(z))).
    loss += Math.max(z, 0) - frame.action * z + Math.log1p(Math.exp(-Math.abs(z)));
    flapCount += frame.action;
  }
  loss /= frames.length;
  if (!Number.isFinite(loss)) throw new RangeError("imitation metrics are non-finite");
  return Object.freeze({ loss, flapCount, waitCount: frames.length - flapCount, sampleCount: frames.length });
}
function deepCopySnapshot(snapshot: PolicySnapshot): PolicySnapshot {
  return createPolicySnapshot(restorePolicySnapshot(snapshot), {
    stage: snapshot.stage, supervisedOptimizer: snapshot.supervisedOptimizer ?? "sgd", trainingSeeds: snapshot.trainingSeeds, datasetProvenance: snapshot.datasetProvenance,
    trainingCounts: snapshot.trainingCounts,
  });
}

/** Deterministic, full-dataset-batch imitation. Each update uses every training frame exactly once. */
export async function runImitationJob(input: ImitationJobInput, hooks: ImitationJobHooks = {}): Promise<ImitationJobResult> {
  if (!input || typeof input !== "object") throw new TypeError("imitation job input is required");
  assertSafeTrainingSeed(input.trainingSeed);
  if (!Number.isSafeInteger(input.updateBudget) || input.updateBudget < 1 || input.updateBudget > 10_000) throw new RangeError("updateBudget must be an integer from 1 to 10000");
  const learningRate = input.learningRate ?? DEFAULT_SUPERVISED_LEARNING_RATE;
  const optimizerKind = input.optimizer ?? "sgd";
  if (optimizerKind !== "sgd" && optimizerKind !== "adam") throw new RangeError("optimizer must be sgd or adam");
  if (!Number.isFinite(learningRate) || learningRate <= 0 || learningRate > 0.01) throw new RangeError("learningRate must be finite and in (0, 0.01]");
  if (!Array.isArray(input.episodes) || input.episodes.length < 2) throw new RangeError("imitation job needs training and validation episodes");
  if (!Array.isArray(input.validationEpisodeIds) || input.validationEpisodeIds.length < 1 || input.validationEpisodeIds.length >= input.episodes.length) throw new RangeError("validation episode IDs must select a nonempty holdout");
  const episodes = input.episodes.map(validateEpisode);
  const ids = episodes.map((episode) => episode.id);
  const seeds = episodes.map((episode) => episode.seed);
  if (new Set(ids).size !== ids.length) throw new RangeError("duplicate episode ID");
  if (new Set(seeds).size !== seeds.length) throw new RangeError("duplicate sequence seed");
  if (seeds.some((seed) => seed >= 3000 && seed <= 3099)) throw new RangeError("final-test seeds 3000..3099 are prohibited");
  const validationSet = new Set(input.validationEpisodeIds);
  if (validationSet.size !== input.validationEpisodeIds.length || input.validationEpisodeIds.some((id) => !ids.includes(id))) throw new RangeError("validation IDs must be unique IDs from the supplied episodes");
  const trainingEpisodes = episodes.filter((episode) => !validationSet.has(episode.id));
  const validationEpisodes = episodes.filter((episode) => validationSet.has(episode.id));
  if (trainingEpisodes.some((episode) => episode.seed < 1000 || episode.seed > 1999)) throw new RangeError("training episodes must use seeds 1000..1999");
  if (validationEpisodes.some((episode) => episode.seed < 2000 || episode.seed > 2099)) throw new RangeError("validation episodes must use seeds 2000..2099");
  const trainingFrames = trainingEpisodes.flatMap((episode) => episode.frames);
  const validationFrames = validationEpisodes.flatMap((episode) => episode.frames);
  const allFrames = [...trainingFrames, ...validationFrames];
  if (!allFrames.length) throw new RangeError("imitation data is empty");
  const allFlaps = allFrames.reduce((sum, frame) => sum + frame.action, 0);
  if (allFlaps === 0 || allFlaps === allFrames.length) throw new RangeError("complete dataset has a single action class");
  const policy = restorePolicySnapshot(deepCopySnapshot(input.initialSnapshot));
  const provenance = [...input.initialSnapshot.datasetProvenance,
    ...trainingEpisodes.map((episode) => `training:${episode.source}:${episode.id}`),
    ...validationEpisodes.map((episode) => `validation:${episode.source}:${episode.id}`)];
  let latestTraining = metric(policy, trainingFrames);
  let latestValidation = metric(policy, validationFrames);
  const adam = optimizerKind === "adam" ? new AdamOptimizer() : undefined;
  for (let completed = 0; completed < input.updateBudget; completed += 1) {
    if (hooks.isCancelled?.()) throw new ImitationJobCancelledError();
    while (hooks.isPaused?.()) {
      await (hooks.yieldControl ?? defaultYield)();
      if (hooks.isCancelled?.()) throw new ImitationJobCancelledError();
    }
    const batch = computeSupervisedBatchGradient(policy, trainingFrames);
    if (adam) {
      const result = adam.update(flattenPolicyParameters(policy.parameters), batch.gradient, learningRate);
      policy.setParameters(unflattenPolicyParameters(result.parameters));
    } else {
      applyBoundedGradientDescent(policy, batch.gradient, { learningRate });
    }
    latestTraining = metric(policy, trainingFrames);
    latestValidation = metric(policy, validationFrames);
    hooks.onProgress?.(Object.freeze({ completedUpdates: completed + 1, updateBudget: input.updateBudget, training: latestTraining, validation: latestValidation }));
    await (hooks.yieldControl ?? defaultYield)();
  }
  const snapshot = createPolicySnapshot(policy, {
    stage: "imitation", supervisedOptimizer: optimizerKind, trainingSeeds: trainingEpisodes.map((episode) => episode.seed), datasetProvenance: provenance,
    trainingCounts: { supervisedUpdates: input.initialSnapshot.trainingCounts.supervisedUpdates + input.updateBudget, reinforcementEpisodes: input.initialSnapshot.trainingCounts.reinforcementEpisodes },
  });
  return Object.freeze({ snapshot, parameters: snapshot.parameters, optimizer: optimizerKind, actualUpdates: input.updateBudget,
    training: latestTraining, validation: latestValidation,
    trainingEpisodeIds: Object.freeze(trainingEpisodes.map((episode) => episode.id)), validationEpisodeIds: Object.freeze(validationEpisodes.map((episode) => episode.id)),
    trainingSeeds: Object.freeze(trainingEpisodes.map((episode) => episode.seed)), validationSeeds: Object.freeze(validationEpisodes.map((episode) => episode.seed)) });
}

