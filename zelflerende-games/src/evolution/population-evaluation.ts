import { assertTrainingTrack } from '../tracks/catalog.ts';
import { CarEnvironment, type CarEpisodeResult } from '../car/environment.ts';
import type { CarAction } from '../car/config.ts';
import { genomePolicy } from './genome.ts';
import type { Genome } from './genome.ts';
import type { CircuitDocument } from '../tracks/document.ts';

export interface EvaluationHooks { readonly isCancelled?:()=>boolean; readonly isPaused?:()=>boolean; readonly yieldControl?:()=>Promise<void>; readonly onStep?:(steps:number)=>void; readonly now?:()=>number; readonly stepBudget?:number; }
export interface GenomeEvaluation { readonly id:string; readonly fitness:number; readonly result:CarEpisodeResult; readonly actions:readonly CarAction[]; }
export function scoreCarResult(result:CarEpisodeResult):number { return result.progressFraction+2*result.laps+(.1*result.laps*(1-result.survivalSteps/1800))-(result.crashed?.05:0); }
export async function evaluateGenome(genome:Genome,document:CircuitDocument,seed=1000,hooks:EvaluationHooks={}):Promise<GenomeEvaluation>{
  if(!Number.isSafeInteger(seed))throw new RangeError('evaluation seed must be a safe integer');
  if(hooks.stepBudget!==undefined&&(!Number.isSafeInteger(hooks.stepBudget)||hooks.stepBudget<1))throw new RangeError('stepBudget must be a positive safe integer');
  assertTrainingTrack(document);
  const env=new CarEnvironment(document),policy=genomePolicy(genome),actions:CarAction[]=[];let observation=env.reset({seed}),steps=0;
  const yieldNow=hooks.yieldControl??(()=>new Promise<void>(r=>setTimeout(r,0)));
  const check=async()=>{if(hooks.isCancelled?.())throw new Error('Evolution cancelled');if(hooks.isPaused?.())while(hooks.isPaused?.()){await yieldNow();if(hooks.isCancelled?.())throw new Error('Evolution cancelled');}};
  await check();
  while(true){
    if(steps>= (hooks.stepBudget??Number.MAX_SAFE_INTEGER))throw new Error('Step budget exhausted');
    const action=policy.action(observation),transition=env.step(action);actions.push(action);steps++;hooks.onStep?.(steps);observation=transition.observation;
    if(transition.done&&transition.result){const result=transition.result;const fitness=scoreCarResult(result);return Object.freeze({id:genome.id,fitness,result,actions:Object.freeze(actions)});}
    if(steps%128===0){await check();await yieldNow();}
  }
}
