import { AdamOptimizer } from './adam.ts';
import { BernoulliPolicy, backpropagateLogit, flattenPolicyParameters, policyProbability, unflattenPolicyParameters } from './policy.ts';
import type { RolloutEpisode } from './rollout.ts';

export const REWARD_TRAINER_PROVENANCE = 'reward_adam_normalized_returns_v1' as const;
export const REWARD_TRAINER_LEARNING_RATE = 0.01;

/**
 * Stateful, on-policy REINFORCE trainer for accelerated Flappy practice.
 * A fresh instance is created for each practice job. The same sampled trajectories,
 * environment rewards, and reward-to-go are used; returns are centered/scaled within
 * the current frozen-policy batch before Adam applies the policy gradient.
 */
export class RewardTrainer {
  private readonly optimizer = new AdamOptimizer();
  private updateCount = 0;
  private readonly learningRate:number;

  constructor(learningRate = REWARD_TRAINER_LEARNING_RATE) {
    if (!Number.isFinite(learningRate) || learningRate <= 0) throw new RangeError('learning rate must be positive and finite');
    this.learningRate=learningRate;
  }

  update(policy: BernoulliPolicy, episodes: readonly RolloutEpisode[]) {
    if (!episodes.length) throw new RangeError('empty rollout batch');
    const returns: { observation: RolloutEpisode['steps'][number]['observation']; action: 0 | 1; value: number }[] = [];
    for (const episode of episodes) {
      let total = 0;
      const episodeReturns = Array<number>(episode.steps.length);
      for (let i = episode.steps.length - 1; i >= 0; i--) {
        total += episode.steps[i]!.reward;
        if (!Number.isFinite(total)) throw new RangeError('nonfinite return');
        episodeReturns[i] = total;
      }
      episode.steps.forEach((step, index) => returns.push({ observation: step.observation, action: step.action, value: episodeReturns[index]! }));
    }
    if (!returns.length) throw new RangeError('empty rollout batch');
    const mean = returns.reduce((sum, item) => sum + item.value, 0) / returns.length;
    const variance = returns.reduce((sum, item) => sum + (item.value - mean) ** 2, 0) / returns.length;
    const scale = Math.sqrt(variance);
    const divisor = scale > 1e-8 ? scale : 1;
    const gradient = Array<number>(57).fill(0);
    const parameters = policy.parameters;
    for (const item of returns) {
      const advantage = (item.value - mean) / divisor;
      const sample = backpropagateLogit(parameters, item.observation,
        (policyProbability(parameters, item.observation) - item.action) * advantage).values;
      sample.forEach((value, index) => { gradient[index] = gradient[index]! + value / returns.length; });
    }
    const result = this.optimizer.update(flattenPolicyParameters(parameters), gradient, this.learningRate);
    policy.setParameters(unflattenPolicyParameters(result.parameters));
    this.updateCount++;
    return Object.freeze({ updates: this.updateCount, episodes: episodes.length, returnMean: mean, returnScale: scale, ...result.metrics });
  }
}
