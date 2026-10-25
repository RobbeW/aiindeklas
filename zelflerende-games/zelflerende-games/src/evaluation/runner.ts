import { FlappyEnvironment,FLAPPY_WORLD_CONFIG_VERSION,FLAPPY_OBSERVATION_VERSION,FLAPPY_SEQUENCE_VERSION } from '../flappy/environment.ts';
import { restorePolicySnapshot,type PolicySnapshot } from '../learning/policy-snapshot.ts';
import { flattenPolicyParameters } from '../learning/policy.ts';
import { stableIdentity,validateEvaluationRecord,type EvaluationBudget,type EvaluationRecord } from './records.ts';
export interface EvaluationOptions {
  readonly mode?:'validation'|'final';readonly allowFinalTests?:boolean;
  readonly budget?:Partial<EvaluationBudget>;
}
/** Frozen deterministic evaluation. Final seeds require an explicit one-off caller decision. */
export function evaluateFlappy(snapshot:PolicySnapshot,seeds:readonly number[],options:EvaluationOptions={}):readonly EvaluationRecord[] {
  const mode=options.mode??'validation';
  if(!seeds.length||new Set(seeds).size!==seeds.length||seeds.length>100)throw new Error('Need1..100distinct evaluation seeds');
  if(mode==='final'&&!options.allowFinalTests)throw new Error('Final tests require explicit opt-in; never automatically tune on these');
  const low=mode==='final'?3000:2000;
  if(seeds.some(s=>!Number.isInteger(s)||s<low||s>low+99))throw new Error('Evaluation seed namespace mismatch');
  const before=JSON.stringify(snapshot);const policy=restorePolicySnapshot(snapshot);
  const modelId=stableIdentity({stage:snapshot.stage,parameters:flattenPolicyParameters(snapshot.parameters)});
  const budget={demonstrationSeconds:0,supervisedUpdates:snapshot.trainingCounts.supervisedUpdates,
    trainingEpisodes:snapshot.trainingCounts.reinforcementEpisodes,interactions:0,wallTimeMs:0,...options.budget};
  const records=seeds.map((seed,index)=>{
    const env=new FlappyEnvironment();let obs=env.reset({seed});
    for(;;){const t=env.step(policy.deterministicAction(obs));obs=t.observation;if(t.done&&t.result){
      return validateEvaluationRecord({schemaVersion:1,game:'flappy',controller:snapshot.stage,modelId,
        sequenceId:`${FLAPPY_SEQUENCE_VERSION}:${seed}`,seed,attempt:index+1,mode,
        configVersion:FLAPPY_WORLD_CONFIG_VERSION,observationVersion:FLAPPY_OBSERVATION_VERSION,budget,result:t.result});
    }}
  });
  if(JSON.stringify(snapshot)!==before)throw new Error('Evaluation mutated snapshot');
  return Object.freeze(records);
}
