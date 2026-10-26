import { POLICY_PARAMETER_COUNT, type PolicyGradient } from "./policy.ts";

export const DEFAULT_ADAM_BETA1 = 0.9;
export const DEFAULT_ADAM_BETA2 = 0.999;
export const DEFAULT_ADAM_EPSILON = 1e-8;
export const DEFAULT_ADAM_GRADIENT_NORM_CAP = 1;

export interface AdamOptions {
  readonly parameterCount?: number;
  readonly beta1?: number;
  readonly beta2?: number;
  readonly epsilon?: number;
  readonly maxGradientNorm?: number;
}

export interface AdamStepResult {
  readonly step: number;
  readonly rawGradientNorm: number;
  readonly clippingScale: number;
  readonly clipped: boolean;
}

/** Stateful Adam for a bounded flat parameter vector (57 by default). Gradients are globally clipped before moments are updated. */
export class AdamOptimizer {
  private readonly firstMoment: number[];
  private readonly secondMoment: number[];
  private readonly parameterCount: number;
  private updateCount = 0;
  private readonly beta1: number;
  private readonly beta2: number;
  private readonly epsilon: number;
  private readonly maxGradientNorm: number;

  constructor(options: AdamOptions = {}) {
    this.parameterCount = options.parameterCount ?? POLICY_PARAMETER_COUNT;
    if (!Number.isSafeInteger(this.parameterCount) || this.parameterCount < 1 || this.parameterCount > 4096) throw new RangeError("Adam parameter count must be 1..4096");
    this.firstMoment = Array<number>(this.parameterCount).fill(0);
    this.secondMoment = Array<number>(this.parameterCount).fill(0);
    this.beta1 = options.beta1 ?? DEFAULT_ADAM_BETA1;
    this.beta2 = options.beta2 ?? DEFAULT_ADAM_BETA2;
    this.epsilon = options.epsilon ?? DEFAULT_ADAM_EPSILON;
    this.maxGradientNorm = options.maxGradientNorm ?? DEFAULT_ADAM_GRADIENT_NORM_CAP;
    if (!Number.isFinite(this.beta1) || this.beta1 < 0 || this.beta1 >= 1 ||
        !Number.isFinite(this.beta2) || this.beta2 < 0 || this.beta2 >= 1 ||
        !Number.isFinite(this.epsilon) || this.epsilon <= 0 ||
        !Number.isFinite(this.maxGradientNorm) || this.maxGradientNorm <= 0) {
      throw new RangeError("Adam beta values must be in [0, 1), and epsilon and gradient cap must be positive and finite");
    }
  }

  get steps(): number { return this.updateCount; }

  update(parameters: readonly number[], rawGradient: PolicyGradient | readonly number[], learningRate: number): { readonly parameters: readonly number[]; readonly metrics: AdamStepResult } {
    const gradient = Array.isArray(rawGradient) ? rawGradient : rawGradient?.values;
    if (!Array.isArray(parameters) || parameters.length !== this.parameterCount || parameters.some(v => !Number.isFinite(v))) {
      throw new RangeError(`Adam parameters must contain ${this.parameterCount} finite values`);
    }
    if (!Array.isArray(gradient) || gradient.length !== this.parameterCount || gradient.some(v => !Number.isFinite(v))) {
      throw new RangeError(`Adam gradient must contain ${this.parameterCount} finite values`);
    }
    if (!Number.isFinite(learningRate) || learningRate <= 0) throw new RangeError("Adam learning rate must be positive and finite");
    const rawNorm = Math.hypot(...gradient);
    if (!Number.isFinite(rawNorm)) throw new RangeError("Adam global gradient norm is non-finite");
    const scale = rawNorm > this.maxGradientNorm ? this.maxGradientNorm / rawNorm : 1;
    const clipped = gradient.map(value => value * scale);
    const step = this.updateCount + 1;
    const nextFirst = clipped.map((g, i) => this.beta1 * this.firstMoment[i]! + (1 - this.beta1) * g);
    const nextSecond = clipped.map((g, i) => this.beta2 * this.secondMoment[i]! + (1 - this.beta2) * g * g);
    const firstCorrection = 1 - this.beta1 ** step;
    const secondCorrection = 1 - this.beta2 ** step;
    const updated = parameters.map((p, i) => {
      const mHat = nextFirst[i]! / firstCorrection;
      const vHat = nextSecond[i]! / secondCorrection;
      return p - learningRate * mHat / (Math.sqrt(vHat) + this.epsilon);
    });
    if (nextFirst.some(v => !Number.isFinite(v)) || nextSecond.some(v => !Number.isFinite(v)) || updated.some(v => !Number.isFinite(v))) {
      throw new RangeError("Adam update would make moments or parameters non-finite");
    }
    for (let i = 0; i < this.parameterCount; i += 1) {
      this.firstMoment[i] = nextFirst[i]!;
      this.secondMoment[i] = nextSecond[i]!;
    }
    this.updateCount = step;
    return Object.freeze({ parameters: Object.freeze(updated), metrics: Object.freeze({ step, rawGradientNorm: rawNorm, clippingScale: scale, clipped: scale < 1 }) });
  }
}
