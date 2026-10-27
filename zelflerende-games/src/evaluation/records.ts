import { FLAPPY_WORLD_CONFIG_VERSION,FLAPPY_OBSERVATION_VERSION } from '../flappy/environment.ts';
export { stableIdentity } from '../core/identity.ts';
export type EvaluationController='human'|'initial'|'imitation'|'post_rl'|'evolution';
export interface EvaluationBudget {
  readonly demonstrationSeconds:number;readonly supervisedUpdates:number;
  readonly trainingEpisodes:number;readonly interactions:number;readonly wallTimeMs:number;
  readonly generations?:number;
}
export interface EvaluationRecord {
  readonly schemaVersion:1;readonly game:'flappy'|'car';
  readonly controller:EvaluationController;readonly modelId:string;
  readonly sequenceId:string;readonly seed:number;readonly attempt:number;
  readonly mode:'validation'|'final';readonly actionSeed?:number;
  readonly configVersion:string;readonly observationVersion:string;
  readonly budget:EvaluationBudget;
  readonly result:{readonly survivalSteps:number;readonly totalReward:number;readonly terminationReason:string;
    readonly pipesPassed?:number;readonly laps?:number;readonly progress?:number;readonly crashed?:boolean;};
}
export function validateEvaluationRecord(value:unknown):EvaluationRecord {
  if(!value||typeof value!=='object')throw new Error('Evaluation record required');
  const r=value as EvaluationRecord;
  if(r.schemaVersion!==1||!['flappy','car'].includes(r.game)||
    !['human','initial','imitation','post_rl','evolution'].includes(r.controller)||
    !['validation','final'].includes(r.mode)||!Number.isSafeInteger(r.seed)||
    !Number.isSafeInteger(r.attempt)||r.attempt<1||
    [r.modelId,r.sequenceId,r.configVersion,r.observationVersion].some(s=>typeof s!=='string'||!s.trim()))throw new Error('Invalid evaluation provenance/version');
  const low=r.mode==='final'?3000:2000;if(r.seed<low||r.seed>low+99)throw new Error('Evaluation seed namespace mismatch');
  if(r.game==='car'&&(!['car-world-v1','car-world-v2'].includes(r.configVersion)||r.observationVersion!=='car-observation-v1'))throw new Error('Incompatible car evaluation versions or lap metrics');
  if(r.actionSeed!==undefined&&!Number.isSafeInteger(r.actionSeed))throw new Error('Invalid evaluation action seed');
  if(r.game==='flappy'&&(r.configVersion!==FLAPPY_WORLD_CONFIG_VERSION||r.observationVersion!==FLAPPY_OBSERVATION_VERSION))throw new Error('Incompatible Flappy evaluation versions');
  if(!r.budget||[r.budget.demonstrationSeconds,r.budget.supervisedUpdates,r.budget.trainingEpisodes,r.budget.interactions,r.budget.wallTimeMs,...(r.budget.generations===undefined?[]:[r.budget.generations])].some(n=>!Number.isFinite(n)||n<0))throw new Error('Invalid evaluation budget');
  if([r.budget.supervisedUpdates,r.budget.trainingEpisodes,r.budget.interactions,...(r.budget.generations===undefined?[]:[r.budget.generations])].some(n=>!Number.isSafeInteger(n)))throw new Error('Invalid evaluation budget counts');
  const result=r.result;
  if(!result||!Number.isSafeInteger(result.survivalSteps)||result.survivalSteps<1||!Number.isFinite(result.totalReward)||
    typeof result.terminationReason!=='string'||!result.terminationReason||
    [result.pipesPassed,result.laps].some(n=>n!==undefined&&(!Number.isSafeInteger(n)||n<0))||
    (result.progress!==undefined&&(!Number.isFinite(result.progress)||result.progress<0))||
    (result.crashed!==undefined&&typeof result.crashed!=='boolean'))throw new Error('Invalid evaluation result');
  if(r.game==='flappy'&&result.pipesPassed===undefined)throw new Error('Flappy result needs pipe count');
  if(r.game==='car'&&(result.laps===undefined||result.progress===undefined))throw new Error('Car result needs lap/progress metrics');
  if(r.game==='car'&&(![0,1].includes(result.laps!)||result.progress!>1+1e-7||typeof result.crashed!=='boolean'||!['collision','lap_complete','time_limit'].includes(result.terminationReason)||result.crashed!==(result.terminationReason==='collision')||result.laps!==(result.terminationReason==='lap_complete'?1:0)))throw new Error('Invalid car lap/progress/result consistency');
  return Object.freeze({...r,budget:Object.freeze({...r.budget}),result:Object.freeze({...r.result})});
}
export function summarizeEvaluations(records:readonly EvaluationRecord[]) {
  const rows=records.map(validateEvaluationRecord);
  const pipes=rows.map(r=>r.result.pipesPassed??r.result.laps??0);
  return Object.freeze({attempts:rows.length,mean:rows.length?pipes.reduce((a,b)=>a+b,0)/rows.length:null,
    min:rows.length?Math.min(...pipes):null,max:rows.length?Math.max(...pipes):null,
    meanSurvivalSteps:rows.length?rows.reduce((a,r)=>a+r.result.survivalSteps,0)/rows.length:null});
}
