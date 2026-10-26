import { BernoulliPolicy } from './policy.ts';
import { applyBoundedGradientDescent, type GradientApplicationOptions } from './imitation-update.ts';
import { rlObjective } from './rl-objective.ts';
import type { RolloutEpisode } from './rollout.ts';

/** Rewards alone drive this update of the existing live policy. */
export function updateReinforcementPolicy(policy:BernoulliPolicy,episodes:readonly RolloutEpisode[],options:GradientApplicationOptions={}) {
  const objective=rlObjective(policy.parameters,episodes);
  const update=applyBoundedGradientDescent(policy,objective.gradient,{...options,learningRate:options.learningRate??.001});
  return Object.freeze({loss:objective.loss,episodes:episodes.length,...update});
}
