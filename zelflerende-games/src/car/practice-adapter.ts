import { createSeededRandom } from '../core/random.ts';
import { assertTrainingTrack } from '../tracks/catalog.ts';
import { trackIdentity,type CircuitDocument } from '../tracks/document.ts';
import { CarEnvironment,type CarEpisodeResult } from './environment.ts';
import { createCarSnapshot,restoreCarSnapshot,validateCarSnapshot,type CarPolicy,type CarSnapshot } from './policy-adapter.ts';
import type { CarAction } from './config.ts';
export interface CarRolloutStep {readonly observation:readonly number[];readonly action:CarAction;readonly reward:number;}
export interface CarRollout {readonly seed:number;readonly steps:readonly CarRolloutStep[];readonly result:CarEpisodeResult;}
export interface CarPracticeInput {readonly snapshot:CarSnapshot;readonly document:CircuitDocument;readonly episodeBudget:number;readonly stepBudget:number;readonly actionSeed:number;readonly environmentSeed:number;readonly batchSize?:number;}
export interface CarPracticeProgress {readonly episodes:number;readonly trainedEpisodes:number;readonly steps:number;readonly elapsedMs:number;readonly simulatedSeconds:number;readonly snapshot:CarSnapshot;readonly history:readonly CarRollout[];readonly scores:readonly CarEpisodeResult[];}
export interface CarPracticeResult extends CarPracticeProgress {readonly reason:'episode_budget'|'step_budget';}
export interface CarPracticeHooks {readonly isCancelled?:()=>boolean;readonly isPaused?:()=>boolean;readonly yieldControl?:()=>Promise<void>;readonly onProgress?:(p:CarPracticeProgress)=>void;readonly now?:()=>number;}
/** Raw negative expected return objective, averaged by complete episodes, not timesteps. */
export function carRewardGradient(policy:CarPolicy,episodes:readonly CarRollout[]){
  if(!episodes.length)throw new Error('Complete car episodes required');const gradient=Array<number>(83).fill(0);let loss=0;
  for(const episode of episodes){if(episode.steps.length!==episode.result.survivalSteps||!episode.steps.length)throw new Error('Partial car rollout prohibited');let returns=0;
    for(let i=episode.steps.length-1;i>=0;i--){const s=episode.steps[i]!;if(!Number.isFinite(s.reward))throw new Error('Nonfinite car reward');returns+=s.reward;const g=policy.lossAndGradient(s.observation,s.action,returns);loss+=g.loss;for(let j=0;j<83;j++)gradient[j]!+=g.gradient[j]!/episodes.length;}
  }
  return Object.freeze({loss:loss/episodes.length,gradient:Object.freeze(gradient)});
}
export async function runCarPracticeJob(input:CarPracticeInput,hooks:CarPracticeHooks={}):Promise<CarPracticeResult>{
  if(!input||!Number.isSafeInteger(input.episodeBudget)||input.episodeBudget<1||input.episodeBudget>128||!Number.isSafeInteger(input.stepBudget)||input.stepBudget<1||input.stepBudget>230400||!Number.isSafeInteger(input.actionSeed)||!Number.isSafeInteger(input.environmentSeed)||input.environmentSeed<1000||input.environmentSeed>1999)throw new Error('Invalid finite car practice budget/seeds');
  const batchSize=input.batchSize??4;if(batchSize!==4)throw new Error('Car on-policy batches must contain exactly4 complete episodes');
  assertTrainingTrack(input.document);const baseline=validateCarSnapshot(input.snapshot);if(!['imitation','post_rl'].includes(baseline.stage))throw new Error('Car practice starts from imitation or post-RL parameters');
  const policy=restoreCarSnapshot(baseline),env=new CarEnvironment(input.document,baseline.worldVersion),now=hooks.now??(()=>performance.now()),begin=now();let pausedMs=0,episodes=0,trainedEpisodes=0,steps=0,snapshot=baseline;const history:CarRollout[]=[],scores:CarEpisodeResult[]=[],seeds:number[]=[];let pending:CarRollout[]=[];
  const yieldNow=hooks.yieldControl??(()=>new Promise<void>(r=>setTimeout(r,0)));
  const check=async()=>{if(hooks.isCancelled?.())throw new Error('Car practice cancelled');if(hooks.isPaused?.()){const began=now();while(hooks.isPaused?.()){await yieldNow();if(hooks.isCancelled?.())throw new Error('Car practice cancelled');}pausedMs+=now()-began;}};
  const elapsed=()=>Math.max(0,now()-begin-pausedMs);
  const progress=():CarPracticeProgress=>Object.freeze({episodes,trainedEpisodes,steps,elapsedMs:elapsed(),simulatedSeconds:steps/60,snapshot,history:Object.freeze([...history]),scores:Object.freeze([...scores])});
  const commit=()=>{if(!pending.length)return;const raw=carRewardGradient(policy,pending).gradient,norm=Math.hypot(...raw),scale=norm>1?1/norm:1;if(!Number.isFinite(norm))throw new Error('Nonfinite car gradient');policy.setParameters(policy.parameters.map((p,i)=>p-.001*raw[i]!*scale));trainedEpisodes+=pending.length;seeds.push(...pending.map(e=>e.seed));pending=[];snapshot=createCarSnapshot(policy,'post_rl',{...baseline.training,sources:[...baseline.training.sources,'reward_only_car_practice'],trackIds:[...new Set([...baseline.training.trackIds,trackIdentity(input.document)])],trainingSeeds:[...baseline.training.trainingSeeds,...seeds],reinforcementEpisodes:baseline.training.reinforcementEpisodes+trainedEpisodes,interactions:baseline.training.interactions+steps,wallTimeMs:baseline.training.wallTimeMs+elapsed()});};
  hooks.onProgress?.(progress());
  while(episodes<input.episodeBudget&&steps<input.stepBudget){await check();const seed=1000+(input.environmentSeed-1000+episodes)%1000,rng=createSeededRandom(input.actionSeed+episodes),trajectory:CarRolloutStep[]=[];let obs=env.reset({seed}),complete=false;
    while(steps<input.stepBudget){await check();const action=policy.sampleAction(obs,rng),t=env.step(action);trajectory.push(Object.freeze({observation:obs,action,reward:t.reward}));steps++;obs=t.observation;
      if(t.done&&t.result){const rollout=Object.freeze({seed,steps:Object.freeze(trajectory),result:t.result});pending.push(rollout);history.push(rollout);if(history.length>4)history.shift();scores.push(t.result);episodes++;complete=true;if(pending.length===batchSize)commit();hooks.onProgress?.(progress());break;}
      if(steps%128===0){hooks.onProgress?.(progress());await yieldNow();}
    }
    if(!complete)break;await yieldNow();
  }
  await check();const result=Object.freeze({...progress(),reason:episodes>=input.episodeBudget?'episode_budget' as const:'step_budget' as const});hooks.onProgress?.(result);return result;
}
