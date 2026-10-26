import type { DemonstrationFrame } from "../data/demonstrations.ts";
import {
  backpropagateLogit, flattenPolicyParameters, POLICY_PARAMETER_COUNT,
  type PolicyGradient,
} from "./policy.ts";
import { BernoulliPolicy, sigmoid, unflattenPolicyParameters } from "./policy.ts";

export const DEFAULT_SUPERVISED_LEARNING_RATE = 0.01;
export const DEFAULT_GLOBAL_GRADIENT_NORM_CAP = 1;

export interface SupervisedBatchGradient {
  readonly loss: number;
  readonly gradient: PolicyGradient;
  readonly flapCount: number;
  readonly waitCount: number;
  readonly sampleCount: number;
}

export interface GradientApplicationOptions {
  readonly learningRate?: number;
  readonly maxGradientNorm?: number;
}

export interface GradientApplicationResult {
  readonly rawGradientNorm: number;
  readonly appliedGradientNorm: number;
  readonly clippingScale: number;
  readonly clipped: boolean;
}

export interface SupervisedUpdateResult extends GradientApplicationResult {
  readonly loss: number;
  readonly flapCount: number;
  readonly waitCount: number;
  readonly sampleCount: number;
}

function validateFrames(frames: readonly DemonstrationFrame[], allowSingleClass = false): { flapCount: number; waitCount: number } {
  if (!Array.isArray(frames) || frames.length === 0) throw new RangeError("supervised batch is empty");
  let flapCount = 0;
  for (const [index, frame] of frames.entries()) {
    if (frame === null || typeof frame !== "object" ||
        !Number.isSafeInteger(frame.step) || frame.step < 0 ||
        (frame.action !== 0 && frame.action !== 1) ||
        !Array.isArray(frame.observation) || frame.observation.length !== 5 ||
        frame.observation.some((value: number) => !Number.isFinite(value) || Math.abs(value) > 1)) {
      throw new RangeError(`supervised frame ${index} has invalid step, action, or observation`);
    }
    flapCount += frame.action;
  }
  const waitCount = frames.length - flapCount;
  if (!allowSingleClass && flapCount === 0) throw new RangeError("supervised batch has all_wait labels; both actions are required");
  if (!allowSingleClass && waitCount === 0) throw new RangeError("supervised batch has all_flap labels; both actions are required");
  return { flapCount, waitCount };
}

function softplus(value: number): number {
  return Math.max(value, 0) + Math.log1p(Math.exp(-Math.abs(value)));
}

/** Mean binary cross-entropy and its raw, pre-clipping mean gradient. */
export function computeSupervisedBatchGradient(
  policy: BernoulliPolicy,
  frames: readonly DemonstrationFrame[],
  options: {readonly allowSingleClass?: boolean} = {},
): SupervisedBatchGradient {
  const { flapCount, waitCount } = validateFrames(frames, options.allowSingleClass);
  const gradient = Array<number>(POLICY_PARAMETER_COUNT).fill(0);
  let totalLoss = 0;
  for (const frame of frames) {
    const logit = policy.logit(frame.observation);
    const loss = softplus(logit) - frame.action * logit;
    const logitDerivative = sigmoid(logit) - frame.action;
    if (!Number.isFinite(loss) || !Number.isFinite(logitDerivative)) throw new RangeError("supervised loss or logit gradient is non-finite");
    totalLoss += loss;
    const sampleGradient = backpropagateLogit(policy.parameters, frame.observation, logitDerivative).values;
    for (let index = 0; index < POLICY_PARAMETER_COUNT; index += 1) gradient[index] += sampleGradient[index]!;
  }
  const sampleCount = frames.length;
  totalLoss /= sampleCount;
  for (let index = 0; index < POLICY_PARAMETER_COUNT; index += 1) gradient[index] /= sampleCount;
  if (!Number.isFinite(totalLoss) || gradient.some((value) => !Number.isFinite(value))) {
    throw new RangeError("mean supervised loss or gradient is non-finite");
  }
  return Object.freeze({
    loss: totalLoss,
    gradient: Object.freeze({ values: Object.freeze(gradient) }),
    flapCount,
    waitCount,
    sampleCount,
  });
}

/** Apply one finite gradient-descent step, clipping its global norm after aggregation. */
export function applyBoundedGradientDescent(
  policy: BernoulliPolicy,
  rawGradient: PolicyGradient | readonly number[],
  options: GradientApplicationOptions = {},
): GradientApplicationResult {
  const values = Array.isArray(rawGradient) ? rawGradient : rawGradient?.values;
  if (!Array.isArray(values) || values.length !== POLICY_PARAMETER_COUNT || values.some((value) => !Number.isFinite(value))) {
    throw new RangeError(`gradient must contain ${POLICY_PARAMETER_COUNT} finite values`);
  }
  const learningRate = options.learningRate ?? DEFAULT_SUPERVISED_LEARNING_RATE;
  const maxGradientNorm = options.maxGradientNorm ?? DEFAULT_GLOBAL_GRADIENT_NORM_CAP;
  if (!Number.isFinite(learningRate) || learningRate <= 0) throw new RangeError("learning rate must be positive and finite");
  if (!Number.isFinite(maxGradientNorm) || maxGradientNorm <= 0) throw new RangeError("gradient norm cap must be positive and finite");

  const rawNorm = Math.hypot(...values);
  if (!Number.isFinite(rawNorm)) throw new RangeError("global gradient norm is non-finite");
  const scale = rawNorm > maxGradientNorm ? maxGradientNorm / rawNorm : 1;
  const appliedNorm = rawNorm * scale;
  const current = flattenPolicyParameters(policy.parameters);
  const next = current.map((parameter, index) => parameter - learningRate * values[index]! * scale);
  if (next.some((parameter) => !Number.isFinite(parameter))) throw new RangeError("gradient update would make policy parameters non-finite");
  policy.setParameters(unflattenPolicyParameters(next));
  return Object.freeze({ rawGradientNorm: rawNorm, appliedGradientNorm: appliedNorm, clippingScale: scale, clipped: scale < 1 });
}

/** One mean-BCE supervised update; no class reweighting or reward terms are applied. */
export function updateSupervisedPolicy(
  policy: BernoulliPolicy,
  frames: readonly DemonstrationFrame[],
  options: GradientApplicationOptions = {},
): SupervisedUpdateResult {
  const batch = computeSupervisedBatchGradient(policy, frames);
  const applied = applyBoundedGradientDescent(policy, batch.gradient, options);
  return Object.freeze({
    loss: batch.loss,
    flapCount: batch.flapCount,
    waitCount: batch.waitCount,
    sampleCount: batch.sampleCount,
    ...applied,
  });
}
