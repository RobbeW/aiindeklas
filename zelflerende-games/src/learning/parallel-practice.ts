import { createSeededRandom } from '../core/random.ts';
import { FlappyEnvironment } from '../flappy/environment.ts';
import type { WorldState } from '../flappy/world.ts';
import { createPolicySnapshot, restorePolicySnapshot, type PolicySnapshot } from './policy-snapshot.ts';
import { updateReinforcementPolicy } from './rl-update.ts';
import type { PracticeHooks, PracticeProgress } from './practice-job.ts';
import type { RolloutEpisode, RolloutStep } from './rollout.ts';

export interface ParallelPracticeInput {
  readonly snapshot: PolicySnapshot; readonly roundBudget: number; readonly agentCount: number;
  readonly environmentSeed: number; readonly actionSeed: number; readonly speed: number; readonly stepBudget?: number;
}
export interface ParallelPracticeProgress extends PracticeProgress {
  readonly round: number; readonly completedRounds: number; readonly roundBudget: number; readonly agentCount: number;
  readonly phase: 'collecting'|'updating'|'complete';
  readonly birds: readonly {readonly id:number;readonly world:WorldState;readonly done:boolean;readonly score:number;readonly reward:number;readonly totalReward:number}[];
  readonly updates: number;
  readonly roundHistory: readonly {readonly round:number;readonly attempts:number;readonly meanScore:number;readonly meanReward:number;readonly elapsedMs:number}[];
}
export interface ParallelPracticeHooks extends Omit<PracticeHooks,'onProgress'> {
  readonly pace?:boolean;
  readonly onProgress?:(value:ParallelPracticeProgress)=>void;
}
export interface ParallelPracticeResult extends ParallelPracticeProgress { readonly reason:'round_budget'|'step_budget'; }
export class ParallelPracticeCancelledError extends Error { constructor(){super('Parallel practice cancelled');this.name='ParallelPracticeCancelledError';} }
const yieldDefault=()=>new Promise<void>(resolve=>setTimeout(resolve,0));

/** Several independent attempts share a frozen policy for each collection round. */
export async function runParallelPractice(input:ParallelPracticeInput,hooks:ParallelPracticeHooks={}):Promise<ParallelPracticeResult> {
  const stepBudget=input.stepBudget??2_800_000,paced=hooks.pace!==false;
  if(!Number.isInteger(input.roundBudget)||input.roundBudget<1||input.roundBudget>64 ||
     ![6,12,18,24].includes(input.agentCount) || ![1,4,16,64].includes(input.speed) ||
     !Number.isInteger(input.environmentSeed)||input.environmentSeed<1000||input.environmentSeed>1999 ||
     !Number.isSafeInteger(input.actionSeed) || !Number.isInteger(stepBudget)||stepBudget<1||stepBudget>2_800_000)
    throw new Error('Invalid finite parallel practice budget, agent count, speed, or training seed');
  if(input.snapshot.stage!=='imitation'&&input.snapshot.stage!=='post_rl') throw new Error('Parallel practice requires an imitation or RL snapshot');
  const policy=restorePolicySnapshot(input.snapshot), now=hooks.now??(()=>performance.now()), began=now();
  let pausedMs=0,steps=0,episodes=0,trainedEpisodes=0,completedRounds=0,updates=0,round=1;
  let saved=input.snapshot, phase:ParallelPracticeProgress['phase']='collecting';
  let birds:ParallelPracticeProgress['birds']=Object.freeze([]);
  const history:ParallelPracticeProgress['history'][number][]=[];const usedSeeds:number[]=[];
  const scores:ParallelPracticeProgress['scoreHistory'][number][]=[];
  const roundHistory:ParallelPracticeProgress['roundHistory'][number][]=[];
  const checkpoint=async()=>{if(hooks.isCancelled?.())throw new ParallelPracticeCancelledError();if(hooks.isPaused?.()){
    const start=now(); while(hooks.isPaused?.()){await(hooks.yieldControl??yieldDefault)();if(hooks.isCancelled?.())throw new ParallelPracticeCancelledError();} pausedMs+=now()-start;
  }};
  const progress=():ParallelPracticeProgress=>{const elapsedMs=Math.max(0,now()-began-pausedMs);return Object.freeze({episodes,steps,simulatedSeconds:steps/60,elapsedMs,stepsPerSecond:elapsedMs?steps*1000/elapsedMs:0,trainedEpisodes,snapshot:saved,history:Object.freeze([...history]),scoreHistory:Object.freeze([...scores]),round,completedRounds,roundBudget:input.roundBudget,agentCount:input.agentCount,phase,birds,updates,roundHistory:Object.freeze([...roundHistory])});};
  const emit=()=>hooks.onProgress?.(progress());
  const update=async(trajectories:RolloutEpisode[],roundElapsed:number)=>{if(!trajectories.length)return;phase='updating';emit();if(paced)await new Promise<void>(r=>setTimeout(r,180));await(hooks.yieldControl??yieldDefault)();await checkpoint();
    updateReinforcementPolicy(policy,trajectories);trainedEpisodes+=trajectories.length;updates++;usedSeeds.push(...trajectories.map(t=>t.environmentSeed));
    saved=createPolicySnapshot(policy,{...input.snapshot,stage:'post_rl',trainingSeeds:[...input.snapshot.trainingSeeds,...usedSeeds],datasetProvenance:[...input.snapshot.datasetProvenance,'reward_only_parallel_practice'],trainingCounts:{supervisedUpdates:input.snapshot.trainingCounts.supervisedUpdates,reinforcementEpisodes:input.snapshot.trainingCounts.reinforcementEpisodes+trainedEpisodes}});
    roundHistory.push(Object.freeze({round,attempts:trajectories.length,meanScore:trajectories.reduce((s,t)=>s+t.result.pipesPassed,0)/trajectories.length,meanReward:trajectories.reduce((s,t)=>s+t.result.totalReward,0)/trajectories.length,elapsedMs:roundElapsed}));if(roundHistory.length>64)roundHistory.shift();phase='collecting';
  };
  emit();
  while(completedRounds<input.roundBudget&&steps<stepBudget){
    await checkpoint();round=completedRounds+1;const roundStart=now(),roundPausedAtStart=pausedMs;const seed=1000+(input.environmentSeed-1000+round-1)%1000;
    const agents=Array.from({length:input.agentCount},(_,i)=>{const env=new FlappyEnvironment();const observation=env.reset({seed});return{id:i,env,observation,random:createSeededRandom(input.actionSeed+round*input.agentCount+i),trajectory:[] as RolloutStep[],done:false,score:0,reward:0,totalReward:0,seed,actionSeed:input.actionSeed+round*input.agentCount+i};});
    const rollouts:RolloutEpisode[]=[];let lastEmit=now(),lastYield=lastEmit,ticks=0;const activeStart=now()-pausedMs;let roundFinished=false;
    while(agents.some(a=>!a.done)&&steps<stepBudget){await checkpoint();
      for(const a of agents){if(a.done||steps>=stepBudget)continue;const action=policy.sampleAction(a.observation,a.random);const t=a.env.step(action);a.trajectory.push(Object.freeze({observation:a.observation,action,reward:t.reward}));a.observation=t.observation;a.reward=t.reward;a.totalReward+=t.reward;a.score=a.env.pipesPassed;steps++;
        if(t.done&&t.result){a.done=true;a.score=t.result.pipesPassed;episodes++;scores.push(Object.freeze({attempt:episodes,seed:a.seed,pipesPassed:t.result.pipesPassed,survivalSteps:t.result.survivalSteps,totalReward:t.result.totalReward}));if(scores.length>64)scores.shift();rollouts.push(Object.freeze({environmentSeed:a.seed,actionSeed:a.actionSeed,steps:Object.freeze(a.trajectory),result:t.result}));}
      }
      birds=Object.freeze(agents.map(a=>Object.freeze({id:a.id,world:a.env.world,done:a.done,score:a.score,reward:a.reward,totalReward:a.totalReward})));
      ticks++;const n=now();if(!paced||ticks===1||n-lastEmit>=1000/16||agents.every(a=>a.done)){emit();lastEmit=n;}
      if(paced){const wait=activeStart+ticks*1000/60/input.speed-(now()-pausedMs);if(wait>=8){await new Promise<void>(r=>setTimeout(r,Math.min(wait,32)));lastYield=now();}else if(now()-lastYield>=16){await(hooks.yieldControl??yieldDefault)();lastYield=now();}}
      else await(hooks.yieldControl??yieldDefault)();
    }
    roundFinished=agents.every(a=>a.done);
    await update(rollouts,Math.max(0,now()-roundStart-(pausedMs-roundPausedAtStart)));
    if(roundFinished)completedRounds++;else break;
    phase='collecting';emit();
  }
  await checkpoint();phase='complete';round=completedRounds;emit();
  return Object.freeze({...progress(),phase:'complete',reason:completedRounds>=input.roundBudget?'round_budget':'step_budget'});
}
