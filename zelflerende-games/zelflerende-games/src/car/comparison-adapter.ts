import { CarEnvironment,type CarEpisodeResult } from './environment.ts';
import { restoreCarSnapshot,validateCarSnapshot,type CarSnapshot } from './policy-adapter.ts';
import { trackIdentity,type CircuitDocument } from '../tracks/document.ts';
import { getTrackRole } from '../tracks/catalog.ts';
import { stableIdentity,validateEvaluationRecord,type EvaluationRecord } from '../evaluation/records.ts';
export function evaluateCar(snapshot:CarSnapshot,doc:CircuitDocument,options:{seed?:number;attempt?:number;allowFinal?:boolean}={}):EvaluationRecord{
  const s=validateCarSnapshot(snapshot),seed=options.seed??2005,final=getTrackRole(doc)==='final';
  if(final&&!options.allowFinal)throw new Error('Final car circuit needs explicit one-off evaluation');
  if(!Number.isSafeInteger(seed)||(final?(seed<3000||seed>3099):(seed<2000||seed>2099)))throw new Error('Evaluation seed namespace mismatch');
  const env=new CarEnvironment(doc),policy=restoreCarSnapshot(s);env.reset({seed});while(!env.completedResult)env.step(policy.action(env.getObservation()));
  return carResultRecord(env.completedResult,doc,seed,s.stage,stableIdentity(s),s,options.attempt??1,final);
}
export function carResultRecord(result:CarEpisodeResult,doc:CircuitDocument,seed:number,controller:EvaluationRecord['controller'],modelId:string,snapshot?:CarSnapshot,attempt=1,final=false){
  const t=snapshot?.training;
  return validateEvaluationRecord({schemaVersion:1,game:'car',controller,modelId,sequenceId:trackIdentity(doc),seed,attempt,mode:final?'final':'validation',configVersion:'car-world-v1',observationVersion:'car-observation-v1',budget:{demonstrationSeconds:t?.demonstrationSeconds??0,supervisedUpdates:t?.supervisedUpdates??0,trainingEpisodes:t?.reinforcementEpisodes??0,interactions:t?.interactions??0,wallTimeMs:t?.wallTimeMs??0,generations:t?.generations??0},result:{survivalSteps:result.survivalSteps,totalReward:result.totalReward,terminationReason:result.terminationReason,laps:result.laps,progress:result.progressFraction,crashed:result.crashed}});
}
