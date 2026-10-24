import type { Observation, RandomSource } from "../core/contracts.ts";
import { createSeededRandom } from "../core/random.ts";
import { CAR_CONFIG } from "./config.ts";

export const CAR_POLICY_VERSION = "car-softmax-6-8-3-v1" as const;
export const CAR_POLICY_SCHEMA_VERSION = 1 as const;
export const CAR_POLICY_PARAMETER_COUNT = 83;
export const CAR_POLICY_INPUT_COUNT = 6;
export const CAR_POLICY_HIDDEN_COUNT = 8;
export const CAR_POLICY_ACTION_COUNT = 3;
export type CarTrainingStage = "initial" | "imitation" | "post_rl" | "evolution";
export type CarAction = 0 | 1 | 2;
export type CarPolicyParameters = readonly number[];

export interface CarLossGradient { readonly loss: number; readonly gradient: readonly number[] }
export interface CarTrainingMetadata {
  readonly sources: readonly string[];
  readonly trackIds: readonly string[];
  readonly trainingSeeds: readonly number[];
  readonly supervisedUpdates: number;
  readonly reinforcementEpisodes: number;
  readonly interactions: number;
  readonly demonstrationSeconds: number;
  readonly wallTimeMs: number;
  readonly supervisedOptimizer: "none" | "sgd" | "adam";
  readonly generations: number;
}
export interface CarSnapshot {
  readonly kind: "car-policy";
  readonly schemaVersion: 1;
  readonly policyVersion: typeof CAR_POLICY_VERSION;
  readonly worldVersion: typeof CAR_CONFIG.version;
  readonly observationVersion: typeof CAR_CONFIG.observationVersion;
  readonly inputCount: 6;
  readonly actionCount: 3;
  readonly normalization: Readonly<{ rayRange: 150; maxSpeed: 55 }>;
  readonly initializationSeed: number;
  readonly stage: CarTrainingStage;
  readonly parameters: readonly number[];
  readonly training: CarTrainingMetadata;
}

function copyFlat(values: readonly number[]): number[] {
  if (!Array.isArray(values) || values.length !== CAR_POLICY_PARAMETER_COUNT || values.some((v) => !Number.isFinite(v)))
    throw new RangeError("car policy parameters must contain 83 finite values");
  return [...values];
}
function validateObservation(obs: Observation): void {
  if (!Array.isArray(obs) || obs.length !== CAR_POLICY_INPUT_COUNT || obs.some((v) => !Number.isFinite(v) || v < 0 || v > 1))
    throw new RangeError("car observation must contain 6 finite values in [0, 1]");
}
function validateAction(action: number): asserts action is CarAction {
  if (action !== 0 && action !== 1 && action !== 2) throw new RangeError("car action must be 0, 1, or 2");
}
function initialParameters(seed: number): number[] {
  if (!Number.isSafeInteger(seed)) throw new RangeError("initialization seed must be a finite safe integer");
  const rng = createSeededRandom(seed);
  const p = Array<number>(83).fill(0);
  for (let i = 0; i < 48; i++) p[i] = (rng() * 2 - 1) * 0.05;
  for (let i = 56; i < 80; i++) p[i] = (rng() * 2 - 1) * 0.05;
  p[80] = 1;
  return p;
}
function evaluate(parameters: readonly number[], obs: Observation) {
  validateObservation(obs);
  const hidden = Array.from({ length: 8 }, (_, h) => {
    let z = parameters[48 + h]!;
    for (let i = 0; i < 6; i++) z += parameters[h * 6 + i]! * obs[i]!;
    return Math.tanh(z);
  });
  const logits = Array.from({ length: 3 }, (_, a) => {
    let z = parameters[80 + a]!;
    for (let h = 0; h < 8; h++) z += parameters[56 + a * 8 + h]! * hidden[h]!;
    return z;
  });
  if (logits.some((x) => !Number.isFinite(x))) throw new RangeError("car policy logits are non-finite");
  const max = Math.max(...logits), exps = logits.map((x) => Math.exp(x - max)), sum = exps.reduce((a, b) => a + b, 0);
  return { hidden, logits, logProbs: logits.map((x) => x - max - Math.log(sum)), probs: exps.map((x) => x / sum) };
}

export class CarPolicy {
  private current: number[];
  readonly initializationSeed: number;
  constructor(seed: number, parameters: readonly number[] = initialParameters(seed)) {
    if (!Number.isSafeInteger(seed)) throw new RangeError("initialization seed must be a finite safe integer");
    this.initializationSeed = seed;
    this.current = copyFlat(parameters);
  }
  get parameters(): CarPolicyParameters { return Object.freeze([...this.current]); }
  setParameters(parameters: readonly number[]): void { this.current = copyFlat(parameters); }
  probabilities(observation: Observation): readonly number[] { return Object.freeze(evaluate(this.current, observation).probs); }
  action(observation: Observation): CarAction {
    const p = evaluate(this.current, observation).probs;
    let best = 0;
    for (let i = 1; i < 3; i++) if (p[i]! > p[best]!) best = i;
    return best as CarAction;
  }
  sampleAction(observation: Observation, rng: RandomSource): CarAction {
    if (typeof rng !== "function") throw new TypeError("rng must be a function");
    const draw = rng();
    if (!Number.isFinite(draw) || draw < 0 || draw >= 1) throw new RangeError("rng must return a finite value in [0, 1)");
    const p = evaluate(this.current, observation).probs;
    let cumulative = 0;
    for (let i = 0; i < 3; i++) { cumulative += p[i]!; if (draw < cumulative) return i as CarAction; }
    return 2;
  }
  lossAndGradient(observation: Observation, action: number, weight = 1): CarLossGradient {
    validateAction(action);
    if (!Number.isFinite(weight)) throw new RangeError("weight must be finite");
    const { hidden, logProbs, probs } = evaluate(this.current, observation);
    const grad = Array<number>(83).fill(0), dl = probs.map((p, i) => weight * (p - (i === action ? 1 : 0)));
    for (let a = 0; a < 3; a++) {
      grad[80 + a] = dl[a]!;
      for (let h = 0; h < 8; h++) grad[56 + a * 8 + h] = dl[a]! * hidden[h]!;
    }
    for (let h = 0; h < 8; h++) {
      let dh = 0;
      for (let a = 0; a < 3; a++) dh += dl[a]! * this.current[56 + a * 8 + h]!;
      const dz = dh * (1 - hidden[h]! ** 2);
      grad[48 + h] = dz;
      for (let i = 0; i < 6; i++) grad[h * 6 + i] = dz * observation[i]!;
    }
    return Object.freeze({ loss: -weight * logProbs[action]!, gradient: Object.freeze(grad) });
  }
}

const TRAINING_DEFAULTS: CarTrainingMetadata = Object.freeze({ sources: Object.freeze([]), trackIds: Object.freeze([]), trainingSeeds: Object.freeze([]), supervisedUpdates: 0, reinforcementEpisodes: 0, interactions: 0, demonstrationSeconds: 0, wallTimeMs: 0, supervisedOptimizer: "none", generations: 0 });
function copyTraining(training: Partial<CarTrainingMetadata> = {}): CarTrainingMetadata {
  const t = { ...TRAINING_DEFAULTS, ...training };
  for (const k of ["supervisedUpdates", "reinforcementEpisodes", "interactions", "generations"] as const)
    if (!Number.isSafeInteger(t[k]) || t[k] < 0) throw new RangeError(`${k} must be a non-negative safe integer`);
  for (const k of ["demonstrationSeconds", "wallTimeMs"] as const)
    if (!Number.isFinite(t[k]) || t[k] < 0) throw new RangeError(`${k} must be finite and non-negative`);
  if (!Array.isArray(t.sources) || t.sources.some((x) => typeof x !== "string" || !x.trim()) ||
      !Array.isArray(t.trackIds) || t.trackIds.some((x) => typeof x !== "string" || !x.trim()) ||
      !Array.isArray(t.trainingSeeds) || t.trainingSeeds.some((x) => !Number.isSafeInteger(x)) ||
      !["none", "sgd", "adam"].includes(t.supervisedOptimizer)) throw new RangeError("invalid car training metadata");
  return Object.freeze({ ...t, sources: Object.freeze([...t.sources]), trackIds: Object.freeze([...t.trackIds]), trainingSeeds: Object.freeze([...t.trainingSeeds]) });
}
export function createCarSnapshot(policy: CarPolicy, stage: CarTrainingStage, training: Partial<CarTrainingMetadata> = {}): CarSnapshot {
  if (!(policy instanceof CarPolicy) || !["initial", "imitation", "post_rl", "evolution"].includes(stage)) throw new RangeError("invalid car policy or stage");
  return Object.freeze({ kind: "car-policy", schemaVersion: 1, policyVersion: CAR_POLICY_VERSION, worldVersion: CAR_CONFIG.version,
    observationVersion: CAR_CONFIG.observationVersion, inputCount: 6, actionCount: 3,
    normalization: Object.freeze({ rayRange: 150, maxSpeed: 55 }), initializationSeed: policy.initializationSeed,
    stage, parameters: Object.freeze(copyFlat(policy.parameters)), training: copyTraining(training) });
}
export function validateCarSnapshot(value: unknown): CarSnapshot {
  if (!value || typeof value !== "object") throw new RangeError("car snapshot must be an object");
  const s = value as Record<string, unknown>;
  if (s.kind !== "car-policy" || s.schemaVersion !== 1 || s.policyVersion !== CAR_POLICY_VERSION || s.worldVersion !== CAR_CONFIG.version ||
      s.observationVersion !== CAR_CONFIG.observationVersion || s.inputCount !== 6 || s.actionCount !== 3 ||
      !s.normalization || typeof s.normalization !== 'object' || (s.normalization as Record<string,unknown>).rayRange !== 150 || (s.normalization as Record<string,unknown>).maxSpeed !== 55 || !Number.isSafeInteger(s.initializationSeed) ||
      !["initial", "imitation", "post_rl", "evolution"].includes(String(s.stage))) throw new RangeError("snapshot kind, schema, policy, dimensions, or versions do not match car runtime");
  if (!s.training || typeof s.training !== "object") throw new RangeError("Car training metadata required");
  const t=s.training as Record<string,unknown>;
  for(const key of Object.keys(TRAINING_DEFAULTS)) if(!(key in t)) throw new RangeError(`Missing car training field ${key}`);
  return createCarSnapshot(new CarPolicy(s.initializationSeed as number,s.parameters as readonly number[]),s.stage as CarTrainingStage,s.training as CarTrainingMetadata);
}
export function restoreCarSnapshot(value: unknown): CarPolicy {
  const s = validateCarSnapshot(value);
  return new CarPolicy(s.initializationSeed, s.parameters);
}
