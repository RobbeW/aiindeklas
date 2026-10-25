import type { ModelStage, Observation } from "../core/contracts.ts";
import {
  backpropagateLogit, BernoulliPolicy, flattenPolicyParameters, POLICY_PARAMETER_COUNT,
  POLICY_VERSION, unflattenPolicyParameters, type PolicyParameters,
} from "./policy.ts";
import {
  FLAPPY_OBSERVATION_VERSION, FLAPPY_SEQUENCE_VERSION, FLAPPY_WORLD_CONFIG_VERSION,
  OBSERVATION_INPUT_COUNT, OBSERVATION_NORMALIZATION,
} from "../flappy/environment.ts";

export const POLICY_SNAPSHOT_SCHEMA_VERSION = 1 as const;

export interface PolicyTrainingCounts {
  readonly supervisedUpdates: number;
  readonly reinforcementEpisodes: number;
}

export interface PolicySnapshotMetadata {
  readonly stage: ModelStage;
  /** Optimizer used for supervised updates; absent legacy metadata means SGD. */
  readonly supervisedOptimizer?: "sgd" | "adam";
  readonly trainingSeeds?: readonly number[];
  readonly datasetProvenance?: readonly string[];
  readonly trainingCounts?: PolicyTrainingCounts;
}

export interface PolicySnapshot {
  readonly schemaVersion: typeof POLICY_SNAPSHOT_SCHEMA_VERSION;
  readonly policyVersion: typeof POLICY_VERSION;
  readonly stage: ModelStage;
  readonly supervisedOptimizer?: "sgd" | "adam";
  readonly inputCount: typeof OBSERVATION_INPUT_COUNT;
  readonly observationVersion: typeof FLAPPY_OBSERVATION_VERSION;
  readonly worldConfigVersion: typeof FLAPPY_WORLD_CONFIG_VERSION;
  readonly sequenceVersion: typeof FLAPPY_SEQUENCE_VERSION;
  readonly normalization: typeof OBSERVATION_NORMALIZATION;
  readonly initializationSeed: number;
  readonly trainingSeeds: readonly number[];
  readonly datasetProvenance: readonly string[];
  readonly trainingCounts: PolicyTrainingCounts;
  readonly parameters: PolicyParameters;
}

function validateMetadata(metadata: PolicySnapshotMetadata): void {
  if (metadata === null || typeof metadata !== "object" || !["initial", "imitation", "post_rl"].includes(metadata.stage)) {
    throw new RangeError("snapshot stage must be initial, imitation, or post_rl");
  }
  if (metadata.supervisedOptimizer !== undefined && metadata.supervisedOptimizer !== "sgd" && metadata.supervisedOptimizer !== "adam") {
    throw new RangeError("supervised optimizer must be sgd or adam");
  }
  const seeds = metadata.trainingSeeds ?? [];
  if (!Array.isArray(seeds) || seeds.some((seed) => !Number.isSafeInteger(seed))) throw new RangeError("training seeds must be safe integers");
  const sources = metadata.datasetProvenance ?? [];
  if (!Array.isArray(sources) || sources.some((source) => typeof source !== "string" || source.trim() === "")) {
    throw new RangeError("dataset provenance entries must be non-empty strings");
  }
  const counts = metadata.trainingCounts ?? { supervisedUpdates: 0, reinforcementEpisodes: 0 };
  if (counts === null || typeof counts !== "object" ||
      !Number.isSafeInteger(counts.supervisedUpdates) || counts.supervisedUpdates < 0 ||
      !Number.isSafeInteger(counts.reinforcementEpisodes) || counts.reinforcementEpisodes < 0) {
    throw new RangeError("training counts must be non-negative safe integers");
  }
}

export function createPolicySnapshot(policy: BernoulliPolicy, metadata: PolicySnapshotMetadata): PolicySnapshot {
  validateMetadata(metadata);
  return Object.freeze({
    schemaVersion: POLICY_SNAPSHOT_SCHEMA_VERSION,
    policyVersion: POLICY_VERSION,
    stage: metadata.stage,
    supervisedOptimizer: metadata.supervisedOptimizer ?? "sgd",
    inputCount: OBSERVATION_INPUT_COUNT,
    observationVersion: FLAPPY_OBSERVATION_VERSION,
    worldConfigVersion: FLAPPY_WORLD_CONFIG_VERSION,
    sequenceVersion: FLAPPY_SEQUENCE_VERSION,
    normalization: OBSERVATION_NORMALIZATION,
    initializationSeed: policy.initializationSeed,
    trainingSeeds: Object.freeze([...(metadata.trainingSeeds ?? [])]),
    datasetProvenance: Object.freeze([...(metadata.datasetProvenance ?? [])]),
    trainingCounts: Object.freeze({ ...(metadata.trainingCounts ?? { supervisedUpdates: 0, reinforcementEpisodes: 0 }) }),
    parameters: unflattenPolicyParameters(flattenPolicyParameters(policy.parameters)),
  });
}

/** Validate all versioned fields and restore into a new, independent live policy. */
export function restorePolicySnapshot(snapshot: PolicySnapshot): BernoulliPolicy {
  if (snapshot === null || typeof snapshot !== "object" ||
      snapshot.schemaVersion !== POLICY_SNAPSHOT_SCHEMA_VERSION || snapshot.policyVersion !== POLICY_VERSION ||
      snapshot.inputCount !== OBSERVATION_INPUT_COUNT ||
      snapshot.observationVersion !== FLAPPY_OBSERVATION_VERSION ||
      snapshot.worldConfigVersion !== FLAPPY_WORLD_CONFIG_VERSION ||
      snapshot.sequenceVersion !== FLAPPY_SEQUENCE_VERSION ||
      JSON.stringify(snapshot.normalization) !== JSON.stringify(OBSERVATION_NORMALIZATION) ||
      !Number.isSafeInteger(snapshot.initializationSeed)) {
    throw new RangeError("snapshot schema, policy, or environment versions do not match this runtime");
  }
  validateMetadata(snapshot);
  const flat = flattenPolicyParameters(snapshot.parameters);
  if (flat.length !== POLICY_PARAMETER_COUNT) throw new RangeError("snapshot has invalid parameter dimensions");
  return new BernoulliPolicy(snapshot.initializationSeed, unflattenPolicyParameters(flat));
}

/** Convenience for recording the same raw-logit path used by imitation and RL. */
export function snapshotLogitGradient(snapshot: PolicySnapshot, observation: Observation, dLossDLogit: number) {
  return backpropagateLogit(snapshot.parameters, observation, dLossDLogit);
}
