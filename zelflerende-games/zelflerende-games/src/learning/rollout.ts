import { createSeededRandom } from '../core/random.ts';
import type { Observation } from '../core/contracts.ts';
import { FlappyEnvironment, type FlappyEpisodeResult } from '../flappy/environment.ts';
import { BernoulliPolicy, samplePolicyAction, type PolicyParameters } from './policy.ts';

export interface RolloutStep { readonly observation: Observation; readonly action: 0|1; readonly reward:number; }
export interface RolloutEpisode {
  readonly environmentSeed:number; readonly actionSeed:number;
  readonly steps:readonly RolloutStep[]; readonly result:Readonly<FlappyEpisodeResult>;
}
export function assertTrainingSeed(seed:number):void {
  if (!Number.isInteger(seed) || seed<1000 || seed>1999) throw new Error('RL environment seed must be training namespace 1000..1999');
}
/** Complete on-policy episode. The fixed parameters cannot change during collection. */
export function collectEpisode(parameters:PolicyParameters, environmentSeed:number, actionSeed:number):RolloutEpisode {
  assertTrainingSeed(environmentSeed);
  const fixed = new BernoulliPolicy(0,parameters).parameters;
  const environment=new FlappyEnvironment();
  let observation=environment.reset({seed:environmentSeed});
  const random=createSeededRandom(actionSeed);
  const steps:RolloutStep[]=[];
  for (;;) {
    const action=samplePolicyAction(fixed,observation,random);
    const transition=environment.step(action);
    steps.push(Object.freeze({observation,action,reward:transition.reward}));
    if (transition.done && transition.result) return Object.freeze({environmentSeed,actionSeed,
      steps:Object.freeze(steps),result:transition.result});
    observation=transition.observation;
  }
}
export function collectBatch(parameters:PolicyParameters,seeds:readonly {environmentSeed:number;actionSeed:number}[]):readonly RolloutEpisode[] {
  if (seeds.length===0) throw new Error('empty rollout batch');
  const fixed=new BernoulliPolicy(0,parameters).parameters;
  return Object.freeze(seeds.map(s=>collectEpisode(fixed,s.environmentSeed,s.actionSeed)));
}
