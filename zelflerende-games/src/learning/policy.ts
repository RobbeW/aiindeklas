import type { Observation } from "../core/contracts.ts";
import { createSeededRandom } from "../core/random.ts";
import { OBSERVATION_INPUT_COUNT } from "../flappy/environment.ts";

export const POLICY_VERSION = "flappy-bernoulli-5-8-1-v1" as const;
export const POLICY_INPUT_COUNT = 5;
export const POLICY_HIDDEN_COUNT = 8;
export const POLICY_PARAMETER_COUNT = 57;
export const INITIAL_FLAP_PROBABILITY = 0.08;
export const INITIAL_OUTPUT_BIAS = Math.log(INITIAL_FLAP_PROBABILITY / (1 - INITIAL_FLAP_PROBABILITY));

export interface PolicyParameters {
  /** W, row-major: hidden-unit rows, then input columns (40 values). */
  readonly weights: readonly number[];
  readonly hiddenBias: readonly number[];
  readonly outputWeights: readonly number[];
  readonly outputBias: number;
}

export interface PolicyGradient {
  /** Same flat ordering used by flattenPolicyParameters. */
  readonly values: readonly number[];
}

function assertObservation(observation: Observation): void {
  if (!Array.isArray(observation) || observation.length !== POLICY_INPUT_COUNT ||
      observation.length !== OBSERVATION_INPUT_COUNT || observation.some((value) => !Number.isFinite(value))) {
    throw new RangeError(`observation must contain ${POLICY_INPUT_COUNT} finite values`);
  }
}

function copyParameters(parameters: PolicyParameters): PolicyParameters {
  if (parameters === null || typeof parameters !== "object" ||
      parameters.weights?.length !== 40 || parameters.hiddenBias?.length !== 8 || parameters.outputWeights?.length !== 8) {
    throw new RangeError("policy parameters must have dimensions W=40, b=8, v=8, c=1");
  }
  const values = [...parameters.weights, ...parameters.hiddenBias, ...parameters.outputWeights, parameters.outputBias];
  if (values.some((value) => !Number.isFinite(value))) throw new RangeError("policy parameters must be finite");
  return Object.freeze({
    weights: Object.freeze([...parameters.weights]),
    hiddenBias: Object.freeze([...parameters.hiddenBias]),
    outputWeights: Object.freeze([...parameters.outputWeights]),
    outputBias: parameters.outputBias,
  });
}

export function flattenPolicyParameters(parameters: PolicyParameters): readonly number[] {
  const copy = copyParameters(parameters);
  return Object.freeze([...copy.weights, ...copy.hiddenBias, ...copy.outputWeights, copy.outputBias]);
}

export function unflattenPolicyParameters(values: readonly number[]): PolicyParameters {
  if (!Array.isArray(values) || values.length !== POLICY_PARAMETER_COUNT || values.some((value) => !Number.isFinite(value))) {
    throw new RangeError(`flat policy parameters must contain ${POLICY_PARAMETER_COUNT} finite values`);
  }
  return copyParameters({
    weights: values.slice(0, 40), hiddenBias: values.slice(40, 48),
    outputWeights: values.slice(48, 56), outputBias: values[56]!,
  });
}

export function createInitialPolicyParameters(seed: number): PolicyParameters {
  const random = createSeededRandom(seed);
  // Small seeded W values break hidden-unit symmetry; zero b/v preserves the
  // specified initial 0.08 flap probability for every valid observation.
  const weights = Array.from({ length: 40 }, () => (random() * 2 - 1) * 0.05);
  return copyParameters({
    weights, hiddenBias: Array(8).fill(0), outputWeights: Array(8).fill(0), outputBias: INITIAL_OUTPUT_BIAS,
  });
}

function forward(parameters: PolicyParameters, observation: Observation): { readonly hidden: number[]; readonly logit: number } {
  assertObservation(observation);
  const p = copyParameters(parameters);
  const hidden = Array.from({ length: 8 }, (_, unit) => {
    let activation = p.hiddenBias[unit]!;
    for (let input = 0; input < 5; input += 1) activation += p.weights[unit * 5 + input]! * observation[input]!;
    return Math.tanh(activation);
  });
  let logit = p.outputBias;
  for (let unit = 0; unit < 8; unit += 1) logit += p.outputWeights[unit]! * hidden[unit]!;
  if (!Number.isFinite(logit)) throw new RangeError("policy logit is non-finite");
  return { hidden, logit };
}

export function policyLogit(parameters: PolicyParameters, observation: Observation): number {
  return forward(parameters, observation).logit;
}

export function sigmoid(logit: number): number {
  if (!Number.isFinite(logit)) throw new RangeError("logit must be finite");
  if (logit >= 0) return 1 / (1 + Math.exp(-logit));
  const exp = Math.exp(logit);
  return exp / (1 + exp);
}

function softplus(value: number): number {
  return Math.max(value, 0) + Math.log1p(Math.exp(-Math.abs(value)));
}

export function policyProbability(parameters: PolicyParameters, observation: Observation): number {
  return sigmoid(policyLogit(parameters, observation));
}

export function policyLogProbability(parameters: PolicyParameters, observation: Observation, action: 0 | 1): number {
  if (action !== 0 && action !== 1) throw new RangeError("action must be 0 (wait) or 1 (flap)");
  const logit = policyLogit(parameters, observation);
  return action === 1 ? -softplus(-logit) : -softplus(logit);
}

export function deterministicPolicyAction(parameters: PolicyParameters, observation: Observation): 0 | 1 {
  return policyProbability(parameters, observation) >= 0.5 ? 1 : 0;
}

export function samplePolicyAction(parameters: PolicyParameters, observation: Observation, random: () => number): 0 | 1 {
  if (typeof random !== "function") throw new TypeError("random must be a function");
  const sample = random();
  if (!Number.isFinite(sample) || sample < 0 || sample >= 1) throw new RangeError("random source must return a finite value in [0, 1)");
  return sample < policyProbability(parameters, observation) ? 1 : 0;
}

/** Backpropagate a raw derivative d(loss)/d(logit) into W,b,v,c order. */
export function backpropagateLogit(parameters: PolicyParameters, observation: Observation, logitGradient: number): PolicyGradient {
  if (!Number.isFinite(logitGradient)) throw new RangeError("logit gradient must be finite");
  const pass = forward(parameters, observation);
  const p = copyParameters(parameters);
  const gradient = Array<number>(57).fill(0);
  for (let unit = 0; unit < 8; unit += 1) {
    const hiddenGradient = logitGradient * p.outputWeights[unit]!;
    const activationGradient = hiddenGradient * (1 - pass.hidden[unit]! ** 2);
    gradient[40 + unit] = activationGradient;
    gradient[48 + unit] = logitGradient * pass.hidden[unit]!;
    for (let input = 0; input < 5; input += 1) gradient[unit * 5 + input] = activationGradient * observation[input]!;
  }
  gradient[56] = logitGradient;
  if (gradient.some((value) => !Number.isFinite(value))) throw new RangeError("policy gradient is non-finite");
  return Object.freeze({ values: Object.freeze(gradient) });
}

export class BernoulliPolicy {
  private current: PolicyParameters;
  readonly initializationSeed: number;

  constructor(seed: number, parameters: PolicyParameters = createInitialPolicyParameters(seed)) {
    if (!Number.isSafeInteger(seed)) throw new RangeError("initialization seed must be a finite safe integer");
    this.initializationSeed = seed;
    this.current = copyParameters(parameters);
  }

  get parameters(): PolicyParameters { return this.current; }
  setParameters(parameters: PolicyParameters): void { this.current = copyParameters(parameters); }
  logit(observation: Observation): number { return policyLogit(this.current, observation); }
  probability(observation: Observation): number { return policyProbability(this.current, observation); }
  logProbability(observation: Observation, action: 0 | 1): number { return policyLogProbability(this.current, observation, action); }
  deterministicAction(observation: Observation): 0 | 1 { return deterministicPolicyAction(this.current, observation); }
  sampleAction(observation: Observation, random: () => number): 0 | 1 { return samplePolicyAction(this.current, observation, random); }
  backpropagateLogit(observation: Observation, gradient: number): PolicyGradient { return backpropagateLogit(this.current, observation, gradient); }
}
