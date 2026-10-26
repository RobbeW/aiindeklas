import { createSeededRandom } from '../core/random.ts';
import { assertTrainingTrack } from '../tracks/catalog.ts';
import { trackIdentity,type CircuitDocument } from '../tracks/document.ts';
import { createCarSnapshot,type CarSnapshot } from '../car/policy-adapter.ts';
import { createGenome,genomePolicy,type Genome } from './genome.ts';
import { groupGenomes } from './species.ts';
import { nextGeneration } from './reproduction.ts';
import { evaluateGenome,type EvaluationHooks,type GenomeEvaluation } from './population-evaluation.ts';
import type { CarEpisodeResult } from '../car/environment.ts';
import type { CarAction } from '../car/config.ts';
import { CarEnvironment } from '../car/environment.ts';
import type { PopulationFrame } from './live-frame.ts';

export interface GenerationRecord { readonly generation:number;readonly bestFitness:number;readonly meanFitness:number;readonly groupCount:number;readonly agents:readonly {readonly id:string;readonly fitness:number;readonly result:CarEpisodeResult}[];readonly failureReplay?:{readonly seed:number;readonly actions:readonly CarAction[];readonly result:CarEpisodeResult}; }
export interface EvolutionProgress { readonly completedGenerations:number;readonly evaluatedEpisodes:number;readonly steps:number;readonly elapsedMs:number;readonly records:readonly GenerationRecord[];readonly champion?:CarSnapshot;readonly liveFrame?:PopulationFrame; }
export interface EvolutionInput { readonly document:CircuitDocument;readonly populationSize:number;readonly generationBudget:number;readonly stepBudget:number;readonly seed:number;readonly generationStep?:boolean;readonly visualMode?:boolean;readonly visualSpeed?:number; }
export interface EvolutionResult extends EvolutionProgress { readonly reason:'generation_budget'|'step_budget'; }
export interface EvolutionHooks extends Omit<EvaluationHooks,'stepBudget'|'onStep'> { readonly onProgress?:(progress:EvolutionProgress)=>void;readonly onStep?:(steps:number)=>void;readonly getSpeed?:()=>number;readonly delay?:(ms:number)=>Promise<void>; }

function validSpeed(speed:number):boolean{return Number.isFinite(speed)&&speed>=.5&&speed<=8;}

export async function runEvolutionJob(input:EvolutionInput,hooks:EvolutionHooks={}):Promise<EvolutionResult>{
  if(!input||!Number.isSafeInteger(input.populationSize)||input.populationSize<4||input.populationSize>32||!Number.isSafeInteger(input.generationBudget)||input.generationBudget<1||input.generationBudget>20||!Number.isSafeInteger(input.stepBudget)||input.stepBudget<1||input.stepBudget>1_000_000||!Number.isSafeInteger(input.seed)||input.seed>Number.MAX_SAFE_INTEGER-input.populationSize)throw new RangeError('Invalid evolution population, generation, step budget, or seed');
  assertTrainingTrack(input.document);
  if(input.visualSpeed!==undefined&&!validSpeed(input.visualSpeed))throw new RangeError('visualSpeed must be between 0.5 and 8');
  const now=hooks.now??(()=>performance.now()),begin=now();let pausedMs=0,pausedAt:number|undefined,steps=0,evaluatedEpisodes=0,champion:CarSnapshot|undefined;
  const records:GenerationRecord[]=[];let winner:Genome|undefined,winnerFitness=-Infinity;let population:readonly Genome[]=Object.freeze(Array.from({length:input.populationSize},(_,i)=>createGenome(`g0-a${i}`,0,input.seed+i)));
  const yieldNow=hooks.yieldControl??(()=>new Promise<void>(r=>setTimeout(r,0)));
  const cooperativeYield=async()=>{if(hooks.isPaused?.()&&pausedAt===undefined)pausedAt=now();await yieldNow();if(pausedAt!==undefined&&hooks.isPaused?.()!==true){pausedMs+=Math.max(0,now()-pausedAt);pausedAt=undefined;}};
  const pauseCheck=async()=>{if(hooks.isCancelled?.())throw new Error('Evolution cancelled');while(hooks.isPaused?.()){await cooperativeYield();if(hooks.isCancelled?.())throw new Error('Evolution cancelled');}};
  const elapsed=()=>Math.max(0,now()-begin-pausedMs-(pausedAt===undefined?0:now()-pausedAt));
  let liveFrame:PopulationFrame|undefined;
  const progress=():EvolutionProgress=>{
    if(winner)champion=createCarSnapshot(genomePolicy(winner),'evolution',{sources:['fixed_topology_evolution'],trackIds:[trackIdentity(input.document)],trainingSeeds:[1000],reinforcementEpisodes:0,interactions:steps,wallTimeMs:elapsed(),generations:records.length});
    return Object.freeze({completedGenerations:records.length,evaluatedEpisodes,steps,elapsedMs:elapsed(),records:Object.freeze([...records]),...(champion?{champion}:{}),...(liveFrame?{liveFrame}:{})});
  };
  const evolutionRandom=createSeededRandom(input.seed);
  hooks.onProgress?.(progress());
  for(let g=0;g<input.generationBudget;g++){
    await pauseCheck();
    if(input.visualMode){
      const envs=population.map(()=>new CarEnvironment(input.document));
      const policies=population.map(genomePolicy);
      const observations=envs.map(env=>env.reset({seed:1000}));
      const actions:CarAction[][]=population.map(()=>[]);
      const done=population.map(()=>false);
      const results:Array<CarEpisodeResult|undefined>=population.map(()=>undefined);
      let round=0,roundsSinceFrame=0,groupStart=now();
      const publish=()=>{liveFrame=Object.freeze({trackId:trackIdentity(input.document),generation:g,round,agents:Object.freeze(population.map((genome,i)=>Object.freeze({id:genome.id,world:envs[i]!.world,done:done[i]!,...(results[i]?{result:results[i]}:{})})))});hooks.onProgress?.(progress());};
      const delay=hooks.delay??(ms=>new Promise<void>(resolve=>setTimeout(resolve,ms)));
      const currentSpeed=()=>{const speed=hooks.getSpeed?.()??input.visualSpeed??1;return validSpeed(speed)?speed:(input.visualSpeed??1);};
      const waitForFrame=async(groupRounds:number,groupStart:number)=>{
        let remaining=Math.max(0,groupRounds*1000/60/currentSpeed()-(now()-groupStart));
        while(remaining>0.1){await delay(Math.min(25,remaining));await pauseCheck();remaining=Math.max(0,groupRounds*1000/60/currentSpeed()-(now()-groupStart));}
      };
      publish();
      let exhausted=false;
      while(done.some(value=>!value)){
        await pauseCheck();
        if(roundsSinceFrame===0)groupStart=now();
        for(let i=0;i<population.length;i++)if(!done[i]){
          if(steps>=input.stepBudget){exhausted=true;break;}
          const action=policies[i]!.action(observations[i]!);actions[i]!.push(action);
          const transition=envs[i]!.step(action);steps++;hooks.onStep?.(steps);observations[i]=transition.observation;
          if(transition.done&&transition.result){done[i]=true;results[i]=transition.result;evaluatedEpisodes++;}
        }
        if(exhausted)break;
        round++;roundsSinceFrame++;
        const groupSize=Math.max(1,Math.round(2*currentSpeed()));
        const terminal=done.every(Boolean);
        if(roundsSinceFrame>=groupSize||terminal){publish();await waitForFrame(roundsSinceFrame,groupStart);roundsSinceFrame=0;}
        else if(round%128===0)await pauseCheck();
      }
      if(exhausted){publish();break;}
      const evaluations=population.map((genome,i)=>{
        const result=results[i]!;
        const fitness=result.progressFraction+2*result.laps+(.1*result.laps*(1-result.survivalSteps/1800))-(result.crashed?.05:0);
        return Object.freeze({id:genome.id,fitness,result,actions:Object.freeze(actions[i]!)});
      });
      const scores=evaluations.map(e=>e.fitness),best=Math.max(...scores),mean=scores.reduce((a,b)=>a+b,0)/scores.length;
      const failure=evaluations.find(e=>e.result.crashed);
      records.push(Object.freeze({generation:g,bestFitness:best,meanFitness:mean,groupCount:groupGenomes(population).length,
        agents:Object.freeze(evaluations.map(e=>Object.freeze({id:e.id,fitness:e.fitness,result:e.result}))),
        ...(failure?{failureReplay:Object.freeze({seed:1000,actions:failure.actions,result:failure.result})}:{})}));
      const bestEval=evaluations.reduce((a,b)=>b.fitness>a.fitness?b:a);
      if(bestEval.fitness>winnerFitness){winner=population.find(x=>x.id===bestEval.id)!;winnerFitness=bestEval.fitness;}
      hooks.onProgress?.(progress());
      if(g+1<input.generationBudget)population=nextGeneration(population,evaluations.map(e=>({id:e.id,fitness:e.fitness})),g+1,evolutionRandom);
      await yieldNow();continue;
    }
    const evaluations:GenomeEvaluation[]=[];let exhausted=false;
    for(const genome of population){
      await pauseCheck();
      const remaining=input.stepBudget-steps;if(remaining<=0){exhausted=true;break;}
      try{
        const ev=await evaluateGenome(genome,input.document,1000,{isCancelled:hooks.isCancelled,isPaused:hooks.isPaused,yieldControl:cooperativeYield,now,stepBudget:remaining,onStep:()=>{steps++;if(steps%128===0)hooks.onProgress?.(progress());}});
        evaluations.push(ev);evaluatedEpisodes++;
      }catch(e){if(e instanceof Error&&e.message==='Step budget exhausted'){exhausted=true;break;}throw e;}
      await pauseCheck();hooks.onProgress?.(progress());
    }
    await pauseCheck();
    if(exhausted||evaluations.length!==population.length)break;
    const scores=evaluations.map(e=>e.fitness),best=Math.max(...scores),mean=scores.reduce((a,b)=>a+b,0)/scores.length;
    const failure=evaluations.find(e=>e.result.crashed);
    const record:GenerationRecord=Object.freeze({generation:g,bestFitness:best,meanFitness:mean,groupCount:groupGenomes(population).length,
      agents:Object.freeze(evaluations.map(e=>Object.freeze({id:e.id,fitness:e.fitness,result:e.result}))),
      ...(failure?{failureReplay:Object.freeze({seed:1000,actions:failure.actions,result:failure.result})}:{})});
    records.push(record);
    const bestEval=evaluations.reduce((a,b)=>b.fitness>a.fitness?b:a);
    if(bestEval.fitness>winnerFitness){winner=population.find(x=>x.id===bestEval.id)!;winnerFitness=bestEval.fitness;}
    hooks.onProgress?.(progress());
    if(g+1<input.generationBudget)population=nextGeneration(population,evaluations.map(e=>({id:e.id,fitness:e.fitness})),g+1,evolutionRandom);
    await yieldNow();
  }
  await pauseCheck();
  const reason:EvolutionResult['reason']=records.length>=input.generationBudget?'generation_budget':'step_budget';
  const final=Object.freeze({...progress(),reason});hooks.onProgress?.(final);return final;
}
