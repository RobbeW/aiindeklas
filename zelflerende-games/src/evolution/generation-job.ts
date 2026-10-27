import { CAR_MAX_PLAYBACK_SPEED } from '../config/workload-presets.ts';
import { createSeededRandom } from '../core/random.ts';
import { assertTrainingTrack } from '../tracks/catalog.ts';
import { validateCircuit,trackIdentity,type CircuitDocument } from '../tracks/document.ts';
import { buildRoute } from '../tracks/route.ts';
import { createCarSnapshot,type CarSnapshot } from '../car/policy-adapter.ts';
import { createGenome,genomePolicy,type Genome } from './genome.ts';
import { groupGenomes } from './species.ts';
import { nextGeneration } from './reproduction.ts';
import { scoreCarResult,type EvaluationHooks } from './population-evaluation.ts';
import { CarEnvironment,type CarEpisodeResult } from '../car/environment.ts';
import type { CarAction } from '../car/config.ts';
import type { PopulationFrame } from './live-frame.ts';

export interface TrackEvaluation {readonly trackId:string;readonly result:CarEpisodeResult;readonly fitness:number}
export interface GenerationRecord { readonly generation:number;readonly bestFitness:number;readonly meanFitness:number;readonly groupCount:number;readonly agents:readonly {readonly id:string;readonly fitness:number;readonly result:CarEpisodeResult;readonly perTrack:readonly TrackEvaluation[]}[];readonly failureReplay?:{readonly trackId:string;readonly seed:number;readonly actions:readonly CarAction[];readonly result:CarEpisodeResult}; }
export interface EvolutionProgress { readonly completedGenerations:number;readonly evaluatedEpisodes:number;readonly steps:number;readonly elapsedMs:number;readonly records:readonly GenerationRecord[];readonly trainingTrackIds:readonly string[];readonly champion?:CarSnapshot;readonly milestones?:readonly CarSnapshot[];readonly liveFrame?:PopulationFrame; }
export interface EvolutionInput { readonly document:CircuitDocument;readonly documents?:readonly CircuitDocument[];readonly populationSize:number;readonly generationBudget:number;readonly stepBudget:number;readonly seed:number;readonly generationStep?:boolean;readonly visualMode?:boolean;readonly visualSpeed?:number;readonly activeTimeLimitMs?:number; }
export interface EvolutionResult extends EvolutionProgress { readonly reason:'generation_budget'|'step_budget'|'time_limit'; }
export interface EvolutionHooks extends Omit<EvaluationHooks,'stepBudget'|'onStep'> { readonly onProgress?:(progress:EvolutionProgress)=>void;readonly onStep?:(steps:number)=>void;readonly getSpeed?:()=>number;readonly delay?:(ms:number)=>Promise<void>; }
const validSpeed=(speed:number)=>Number.isFinite(speed)&&speed>=.5&&speed<=CAR_MAX_PLAYBACK_SPEED;

export async function runEvolutionJob(input:EvolutionInput,hooks:EvolutionHooks={}):Promise<EvolutionResult>{
  if(!input||!Number.isSafeInteger(input.populationSize)||input.populationSize<4||input.populationSize>32||!Number.isSafeInteger(input.generationBudget)||input.generationBudget<1||input.generationBudget>100||!Number.isSafeInteger(input.stepBudget)||input.stepBudget<1||input.stepBudget>50_000_000||!Number.isSafeInteger(input.seed)||input.seed>Number.MAX_SAFE_INTEGER-input.populationSize||!Number.isFinite(input.activeTimeLimitMs??120000)||(input.activeTimeLimitMs??120000)<=0)throw new RangeError('Invalid evolution population, generation, step budget, seed, or time limit');
  if(input.visualSpeed!==undefined&&!validSpeed(input.visualSpeed))throw new RangeError('visualSpeed must be between 0.5 and 32');
  const selected=input.documents??[input.document];
  if(!Array.isArray(selected)||selected.length<1||selected.length>8)throw new RangeError('Select between 1 and 8 training circuits');
  const documents=selected.map(value=>{const doc=validateCircuit(value);assertTrainingTrack(doc);buildRoute(doc);return doc;});
  const trackIds=Object.freeze(documents.map(trackIdentity));
  if(new Set(trackIds).size!==trackIds.length)throw new Error('Duplicate training circuit');
  const now=hooks.now??(()=>performance.now()),begin=now();let pausedMs=0,pausedAt:number|undefined,steps=0,evaluatedEpisodes=0;
  const records:GenerationRecord[]=[],milestoneMap=new Map<number,CarSnapshot>();let champion:CarSnapshot|undefined,winner:Genome|undefined,winnerFitness=-Infinity,liveFrame:PopulationFrame|undefined;
  let population:readonly Genome[]=Object.freeze(Array.from({length:input.populationSize},(_,i)=>createGenome(`g0-a${i}`,0,input.seed+i)));
  const yieldNow=hooks.yieldControl??(()=>new Promise<void>(r=>setTimeout(r,0)));
  const pauseCheck=async()=>{if(hooks.isCancelled?.())throw new Error('Evolution cancelled');while(hooks.isPaused?.()){if(pausedAt===undefined)pausedAt=now();await yieldNow();if(hooks.isCancelled?.())throw new Error('Evolution cancelled');}if(pausedAt!==undefined){pausedMs+=Math.max(0,now()-pausedAt);pausedAt=undefined;}};
  const elapsed=()=>Math.max(0,now()-begin-pausedMs-(pausedAt===undefined?0:now()-pausedAt));
  const progress=():EvolutionProgress=>Object.freeze({completedGenerations:records.length,evaluatedEpisodes,steps,elapsedMs:elapsed(),records:Object.freeze([...records]),trainingTrackIds:trackIds,...(champion?{champion,milestones:Object.freeze([...milestoneMap.values()])}:{}),...(liveFrame?{liveFrame}:{})});
  const random=createSeededRandom(input.seed),delay=hooks.delay??(ms=>new Promise<void>(resolve=>setTimeout(resolve,ms)));
  const currentSpeed=()=>{const speed=hooks.getSpeed?.()??input.visualSpeed??1;return validSpeed(speed)?speed:(input.visualSpeed??1);};
  let reason:EvolutionResult['reason']='generation_budget',lastFastProgress=now();hooks.onProgress?.(progress());
  generation: for(let g=0;g<input.generationBudget;g++){
    await pauseCheck();
    const perAgent:Array<Array<TrackEvaluation & {readonly actions:readonly CarAction[]}>>=population.map(()=>[]);
    for(let t=0;t<documents.length;t++){
      const envs=population.map(()=>new CarEnvironment(documents[t]!)),policies=population.map(genomePolicy),observations=envs.map(env=>env.reset({seed:1000}));
      const actions:CarAction[][]=population.map(()=>[]),done=population.map(()=>false),results:Array<CarEpisodeResult|undefined>=population.map(()=>undefined);
      let round=0,roundsSinceFrame=0,groupStart=now();
      const publish=()=>{if(!input.visualMode)return;liveFrame=Object.freeze({trackId:trackIds[t]!,generation:g,round,agents:Object.freeze(population.map((genome,i)=>Object.freeze({id:genome.id,world:envs[i]!.world,done:done[i]!,...(results[i]?{result:results[i]}:{})})))});hooks.onProgress?.(progress());};
      publish();
      while(done.some(value=>!value)){
        await pauseCheck();if(roundsSinceFrame===0)groupStart=now();
        for(let i=0;i<population.length;i++)if(!done[i]){
          if(steps>=input.stepBudget||elapsed()>= (input.activeTimeLimitMs??120000)){reason=steps>=input.stepBudget?'step_budget':'time_limit';publish();break generation;}
          const action=policies[i]!.action(observations[i]!);actions[i]!.push(action);
          const transition=envs[i]!.step(action);steps++;hooks.onStep?.(steps);observations[i]=transition.observation;
          if(transition.done&&transition.result){done[i]=true;results[i]=transition.result;evaluatedEpisodes++;}
          if(!input.visualMode&&steps%128===0&&now()-lastFastProgress>=100){lastFastProgress=now();hooks.onProgress?.(progress());}
        }
        round++;roundsSinceFrame++;
        if(input.visualMode&&(roundsSinceFrame>=Math.max(1,Math.round(2*currentSpeed()))||done.every(Boolean))){
          publish();let remaining=Math.max(0,roundsSinceFrame*1000/60/currentSpeed()-(now()-groupStart));
          while(remaining>0.1){await delay(Math.min(25,remaining));await pauseCheck();if(elapsed()>=(input.activeTimeLimitMs??120000)){if(done.every(Boolean)&&t===documents.length-1)break;reason='time_limit';break generation;}remaining=Math.max(0,roundsSinceFrame*1000/60/currentSpeed()-(now()-groupStart));}roundsSinceFrame=0;
        } else if(round%128===0){await yieldNow();await pauseCheck();}
      }
      for(let i=0;i<population.length;i++){const result=results[i]!;perAgent[i]!.push(Object.freeze({trackId:trackIds[t]!,result,fitness:scoreCarResult(result),actions:Object.freeze(actions[i]!)}));}
    }
    const evaluations=population.map((genome,i)=>{const tracks=perAgent[i]!;return {id:genome.id,fitness:tracks.reduce((sum,e)=>sum+e.fitness,0)/tracks.length,tracks};});
    const scores=evaluations.map(e=>e.fitness),failure=perAgent.flat().find(e=>e.result.crashed);
    records.push(Object.freeze({generation:g,bestFitness:Math.max(...scores),meanFitness:scores.reduce((a,b)=>a+b,0)/scores.length,groupCount:groupGenomes(population).length,agents:Object.freeze(evaluations.map(e=>Object.freeze({id:e.id,fitness:e.fitness,result:e.tracks[0]!.result,perTrack:Object.freeze(e.tracks.map(({trackId,result,fitness})=>Object.freeze({trackId,result,fitness})))}))),...(failure?{failureReplay:Object.freeze({trackId:failure.trackId,seed:1000,actions:failure.actions,result:failure.result})}:{})}));
    const best=evaluations.reduce((a,b)=>b.fitness>a.fitness?b:a);if(best.fitness>winnerFitness){winner=population.find(x=>x.id===best.id)!;winnerFitness=best.fitness;}
    champion=createCarSnapshot(genomePolicy(winner!),'evolution',{sources:['fixed_topology_evolution'],trackIds,trainingSeeds:[1000],reinforcementEpisodes:0,interactions:steps,wallTimeMs:elapsed(),generations:records.length});
    for(const key of milestoneMap.keys())if(key!==1&&key!==10)milestoneMap.delete(key);
    milestoneMap.set(records.length,champion);hooks.onProgress?.(progress());
    if(g+1<input.generationBudget)population=nextGeneration(population,evaluations.map(e=>({id:e.id,fitness:e.fitness})),g+1,random);
    await yieldNow();
  }
  await pauseCheck();const final=Object.freeze({...progress(),reason});hooks.onProgress?.(final);return final;
}
