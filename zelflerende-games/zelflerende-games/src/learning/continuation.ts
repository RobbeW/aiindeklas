import type { Observation } from "../core/contracts.ts";
import { collectBatch } from "./rollout.ts";
import { policyProbability, flattenPolicyParameters } from "./policy.ts";
import { createPolicySnapshot, restorePolicySnapshot, type PolicySnapshot } from "./policy-snapshot.ts";
import { updateReinforcementPolicy } from "./rl-update.ts";

export interface ContinuationConfig {
  readonly rolloutSeeds: readonly number[];
  readonly actionSeeds: readonly number[];
  readonly learningRate?: number;
  readonly validationObservations: readonly Observation[];
}

/** Continue an imitation checkpoint with reward-only on-policy REINFORCE. */
export function continueImitationWithRL(imitation: PolicySnapshot, config: ContinuationConfig) {
  if (imitation.stage !== "imitation") throw new RangeError("continuation requires an imitation snapshot");
  if (config.actionSeeds.length === 0 || config.actionSeeds.length !== config.rolloutSeeds.length ||
      config.actionSeeds.length > 64 ||
      config.actionSeeds.some(seed => !Number.isSafeInteger(seed)) ||
      config.rolloutSeeds.some(seed => !Number.isSafeInteger(seed) || seed < 1000 || seed > 1999)) {
    throw new RangeError("continuation requires paired action and training rollout seeds");
  }
  if (config.validationObservations.length === 0) throw new RangeError("validation observations are required");
  const frozen = restorePolicySnapshot(imitation);
  const original = flattenPolicyParameters(imitation.parameters);
  const flatLive = flattenPolicyParameters(frozen.parameters);
  if (original.some((value, i) => value !== flatLive[i])) throw new Error("restored policy parameters differ from imitation snapshot");
  const predictions = config.validationObservations.map(observation => policyProbability(frozen.parameters, observation));
  const savedPredictions = config.validationObservations.map(observation => policyProbability(imitation.parameters, observation));
  if (predictions.some((value, i) => value !== savedPredictions[i])) throw new Error("restored policy predictions differ from imitation snapshot");
  const snapshotBefore = JSON.stringify(imitation);

  const episodes = collectBatch(frozen.parameters, config.actionSeeds.map((actionSeed, index) => ({
    environmentSeed: config.rolloutSeeds[index]!, actionSeed,
  })));
  const update = updateReinforcementPolicy(frozen, episodes, { learningRate: config.learningRate ?? 0.001, maxGradientNorm: 1 });
  const after = flattenPolicyParameters(frozen.parameters);
  const postSnapshot = createPolicySnapshot(frozen, {
    stage: "post_rl", supervisedOptimizer: imitation.supervisedOptimizer ?? "sgd", trainingSeeds: [...imitation.trainingSeeds, ...config.rolloutSeeds],
    datasetProvenance: [...imitation.datasetProvenance, "reward_only_on_policy_reinforce"],
    trainingCounts: {
      supervisedUpdates: imitation.trainingCounts.supervisedUpdates,
      reinforcementEpisodes: imitation.trainingCounts.reinforcementEpisodes + episodes.length,
    },
  });
  return Object.freeze({
    preRlParameters: original,
    preRlPredictions: Object.freeze(predictions),
    preRlPredictionsExactlyImitation: predictions.every((value, i) => value === savedPredictions[i]),
    postRlParameters: after,
    postRlSnapshot: postSnapshot,
    maxParameterDelta: Math.max(...after.map((value, i) => Math.abs(value - original[i]!))),
    imitationSnapshotUnchanged: snapshotBefore === JSON.stringify(imitation),
    episodes,
    update,
  });
}
