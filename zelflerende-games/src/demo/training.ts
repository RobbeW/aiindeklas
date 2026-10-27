import {WorkerJobClient} from '../core/worker-client.ts';
import type {WorkerPort} from '../core/worker-protocol.ts';
import {BernoulliPolicy} from '../learning/policy.ts';
import {createPolicySnapshot,type PolicySnapshot} from '../learning/policy-snapshot.ts';
import type {ImitationJobInput,ImitationProgress,ImitationJobResult} from '../learning/imitation-job.ts';
import type {ParallelPracticeInput,ParallelPracticeProgress,ParallelPracticeResult} from '../learning/parallel-practice.ts';
import type {EvolutionInput,EvolutionProgress,EvolutionResult} from '../evolution/generation-job.ts';
import type {CircuitDocument} from '../tracks/document.ts';
import type {DemonstrationEpisode} from '../data/demonstrations.ts';
import {generateReferenceDemonstration} from '../flappy/reference-demonstrations.ts';

export const demoInitial=()=>createPolicySnapshot(new BernoulliPolicy(1222),{stage:'initial'});
/** Two openly labelled references keep idle and first-attempt demonstrations useful. */
export function demoExamples(human:readonly DemonstrationEpisode[]){
 const selected=human.filter(e=>e.source==='human').slice(-24);
 const used=new Set(selected.map(e=>e.seed)),seeds:number[]=[];for(let seed=1999;seeds.length<2;seed--)if(!used.has(seed))seeds.push(seed);
 return [...selected,...seeds.map(seed=>generateReferenceDemonstration(seed,`showfloor-reference-${seed}`))];
}
export function createDemoTraining(){
 const imitation=new WorkerJobClient<ImitationJobInput,ImitationProgress,ImitationJobResult>(()=>new Worker(new URL('../workers/imitation.worker.ts',import.meta.url),{type:'module'}) as unknown as WorkerPort);
 const reward=new WorkerJobClient<ParallelPracticeInput,ParallelPracticeProgress,ParallelPracticeResult>(()=>new Worker(new URL('../workers/parallel-practice.worker.ts',import.meta.url),{type:'module'}) as unknown as WorkerPort);
 const cars=new WorkerJobClient<EvolutionInput,EvolutionProgress,EvolutionResult>(()=>new Worker(new URL('../workers/evolution.worker.ts',import.meta.url),{type:'module'}) as unknown as WorkerPort);
 const clients=[imitation,reward,cars];
 return {
  imitation(episodes:readonly DemonstrationEpisode[],progress:(p:ImitationProgress)=>void){return imitation.start({initialSnapshot:demoInitial(),episodes,validationEpisodeIds:[],allowTrainingOnly:true,updateBudget:250,optimizer:'adam',trainingSeed:1701},progress).promise;},
  reward(snapshot:PolicySnapshot,progress:(p:ParallelPracticeProgress)=>void){return reward.start({snapshot,roundBudget:64,agentCount:12,environmentSeed:1720,actionSeed:15000,speed:64,mode:'live',timeBudgetMs:45000},progress).promise;},
  cars(documents:readonly CircuitDocument[],progress:(p:EvolutionProgress)=>void){return cars.start({document:documents[0]!,documents,populationSize:12,generationBudget:30,stepBudget:50_000_000,seed:1701,visualMode:true,visualSpeed:32,activeTimeLimitMs:65000},progress).promise;},
  pause(){for(const c of clients)c.pause();},resume(){for(const c of clients)c.resume();},cancel(){for(const c of clients)c.cancel();},dispose(){for(const c of clients)c.dispose();},
 };
}
