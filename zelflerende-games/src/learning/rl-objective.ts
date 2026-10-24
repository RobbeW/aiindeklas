import { backpropagateLogit, policyLogProbability, policyProbability, type PolicyParameters } from './policy.ts';
import type { RolloutEpisode } from './rollout.ts';

export function rewardToGo(rewards:readonly number[]):readonly number[] {
  if (rewards.length===0 || rewards.some(r=>!Number.isFinite(r))) throw new Error('nonempty finite rewards required');
  let total=0; const returns=Array<number>(rewards.length);
  for (let i=rewards.length-1;i>=0;i--) {
    total+=rewards[i]!;
    if (!Number.isFinite(total)) throw new Error('nonfinite return');
    returns[i]=total;
  }
  return Object.freeze(returns);
}
/** Undiscounted reward-to-go score-function loss; divide by EPISODES, never frames. */
export function rlObjective(parameters:PolicyParameters, episodes:readonly RolloutEpisode[]) {
  if (!episodes.length) throw new Error('empty rollout batch');
  const gradient=Array<number>(57).fill(0); let loss=0;
  for (const episode of episodes) {
    const returns=rewardToGo(episode.steps.map(s=>s.reward));
    episode.steps.forEach((s,t)=>{
      const value=returns[t]!;
      loss-=policyLogProbability(parameters,s.observation,s.action)*value/episodes.length;
      const g=backpropagateLogit(parameters,s.observation,(policyProbability(parameters,s.observation)-s.action)*value).values;
      g.forEach((v,i)=>{gradient[i]=gradient[i]!+v/episodes.length;});
    });
  }
  if (!Number.isFinite(loss) || gradient.some(v=>!Number.isFinite(v))) throw new Error('nonfinite RL objective');
  return Object.freeze({loss,gradient:Object.freeze(gradient)});
}
