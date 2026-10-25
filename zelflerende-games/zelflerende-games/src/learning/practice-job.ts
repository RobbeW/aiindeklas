import { createSeededRandom } from '../core/random.ts';
import { FlappyEnvironment } from '../flappy/environment.ts';
import { createPolicySnapshot,restorePolicySnapshot,type PolicySnapshot } from './policy-snapshot.ts';
import type { RolloutEpisode,RolloutStep } from './rollout.ts';
import { updateReinforcementPolicy } from './rl-update.ts';

export interface PracticeInput {
  readonly snapshot:PolicySnapshot;
  readonly episodeBudget:number;
  readonly stepBudget:number;
  readonly environmentSeed:number;
  readonly actionSeed:number;
  readonly batchSize?:number;
}
export interface AttemptReplay { readonly seed:number; readonly actions:readonly (0|1)[]; readonly result:RolloutEpisode['result']; }
export interface PracticeProgress {
  readonly cumulativeSteps?:number;readonly cumulativeElapsedMs?:number;
  readonly episodes:number; readonly steps:number; readonly simulatedSeconds:number;
  readonly elapsedMs:number; readonly stepsPerSecond:number; readonly trainedEpisodes:number;
  readonly snapshot:PolicySnapshot; readonly history:readonly AttemptReplay[];
  readonly scoreHistory:readonly {readonly attempt:number;readonly seed:number;readonly pipesPassed:number;readonly survivalSteps:number;readonly totalReward:number}[];
}
export interface PracticeResult extends PracticeProgress { readonly reason:'episode_budget'|'step_budget'; }
export interface PracticeHooks {
  readonly isCancelled?:()=>boolean; readonly isPaused?:()=>boolean;
  readonly yieldControl?:()=>Promise<void>; readonly onProgress?:(value:PracticeProgress)=>void;
  readonly now?:()=>number;
}
export class PracticeCancelledError extends Error { constructor(){super('Practice cancelled');this.name='PracticeCancelledError';} }
const yieldDefault=()=>new Promise<void>(resolve=>setTimeout(resolve,0));

/** One agent, sequential complete attempts, fixed policy within each on-policy batch. */
export async function runPracticeJob(input:PracticeInput,hooks:PracticeHooks={}):Promise<PracticeResult> {
  if (!Number.isInteger(input.episodeBudget)||input.episodeBudget<1||input.episodeBudget>512 ||
      !Number.isInteger(input.stepBudget)||input.stepBudget<1||input.stepBudget>500_000 ||
      !Number.isInteger(input.environmentSeed)||input.environmentSeed<1000||input.environmentSeed>1999 ||
      !Number.isSafeInteger(input.actionSeed)) throw new Error('Invalid finite practice budget or training seed');
  const batchSize=input.batchSize??4;
  if (!Number.isInteger(batchSize)||batchSize<1||batchSize>16) throw new Error('Practice batch size must be1..16');
  if (!['imitation','post_rl'].includes(input.snapshot.stage)) throw new Error('Practice requires a trained imitation or RL snapshot');
  const policy=restorePolicySnapshot(input.snapshot);
  const now=hooks.now??(()=>performance.now()); const began=now();
  let pausedMs=0,steps=0,episodes=0,trainedEpisodes=0;
  let saved=input.snapshot;
  const history:AttemptReplay[]=[];const usedSeeds:number[]=[];
  const scores:PracticeProgress['scoreHistory'][number][]=[];
  let pending:RolloutEpisode[]=[];
  const checkpoint=async()=>{
    if(hooks.isCancelled?.())throw new PracticeCancelledError();
    if(hooks.isPaused?.()) {
      const start=now();
      while(hooks.isPaused?.()) {await(hooks.yieldControl??yieldDefault)();if(hooks.isCancelled?.())throw new PracticeCancelledError();}
      pausedMs+=now()-start;
    }
  };
  const progress=():PracticeProgress=>{
    const elapsedMs=Math.max(0,now()-began-pausedMs);
    return Object.freeze({episodes,steps,simulatedSeconds:steps/60,elapsedMs,
      stepsPerSecond:elapsedMs>0?steps*1000/elapsedMs:0,trainedEpisodes,snapshot:saved,
      history:Object.freeze([...history]),scoreHistory:Object.freeze([...scores])});
  };
  const commit=()=>{
    if(!pending.length)return;
    updateReinforcementPolicy(policy,pending);
    trainedEpisodes+=pending.length;usedSeeds.push(...pending.map(e=>e.environmentSeed));pending=[];
    saved=createPolicySnapshot(policy,{...input.snapshot,stage:'post_rl',
      trainingSeeds:[...input.snapshot.trainingSeeds,...usedSeeds],
      datasetProvenance:[...input.snapshot.datasetProvenance,'reward_only_sequential_practice'],
      trainingCounts:{supervisedUpdates:input.snapshot.trainingCounts.supervisedUpdates,
        reinforcementEpisodes:input.snapshot.trainingCounts.reinforcementEpisodes+trainedEpisodes}});
  };
  hooks.onProgress?.(progress());
  while(episodes<input.episodeBudget&&steps<input.stepBudget) {
    await checkpoint();
    const seed=1000+(input.environmentSeed-1000+episodes)%1000;
    const actionSeed=input.actionSeed+episodes;
    const random=createSeededRandom(actionSeed);const env=new FlappyEnvironment();
    let observation=env.reset({seed});const trajectory:RolloutStep[]=[];
    let completed=false;
    while(steps<input.stepBudget) {
      await checkpoint();
      const action=policy.sampleAction(observation,random);const t=env.step(action);steps++;
      trajectory.push(Object.freeze({observation,action,reward:t.reward}));observation=t.observation;
      if(t.done&&t.result) {
        const rollout=Object.freeze({environmentSeed:seed,actionSeed,steps:Object.freeze(trajectory),result:t.result});
        pending.push(rollout);episodes++;completed=true;
        history.push(Object.freeze({seed,actions:Object.freeze(trajectory.map(s=>s.action)),result:t.result}));
        if(history.length>8)history.shift();
        scores.push(Object.freeze({attempt:episodes,seed,pipesPassed:t.result.pipesPassed,survivalSteps:t.result.survivalSteps,totalReward:t.result.totalReward}));
        if(pending.length===batchSize)commit();
        hooks.onProgress?.(progress());
        break;
      }
      if(steps%128===0) {hooks.onProgress?.(progress());await(hooks.yieldControl??yieldDefault)();}
    }
    if(!completed)break; // Partial attempt is counted as steps, never treated as a terminal rollout.
    await(hooks.yieldControl??yieldDefault)();
  }
  await checkpoint();commit();
  const result=Object.freeze({...progress(),reason:episodes>=input.episodeBudget?'episode_budget' as const:'step_budget' as const});
  hooks.onProgress?.(result);
  return result;
}
