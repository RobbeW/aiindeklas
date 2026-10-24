import { validateEpisode } from '../data/dataset.ts';
import { splitCarEpisodes } from '../car/recorder.ts';
import { validateCircuit } from '../tracks/document.ts';
import { buildRoute } from '../tracks/route.ts';
import { createPolicySnapshot,restorePolicySnapshot,type PolicySnapshot } from '../learning/policy-snapshot.ts';
import { validateCarSnapshot } from '../car/policy-adapter.ts';
import { validateEvaluationRecord } from '../evaluation/records.ts';
import type { FlappyLearningState } from '../flappy/learning-view.ts';
import type { CarLearningState } from '../car/learning-view.ts';
import type { EvolutionProgress,GenerationRecord } from '../evolution/generation-job.ts';
export const MAX_EXPERIMENT_BYTES=8*1024*1024;
export type Game='flappy'|'car';
export type SavedExperiment={readonly kind:'learning-experiment';readonly version:1;readonly game:Game;readonly savedAt:string;readonly payload:FlappyLearningState|CarLearningState;};
const object=(v:unknown):Record<string,any>=>{if(!v||typeof v!=='object'||Array.isArray(v))throw new Error('Object required in experiment');return v as Record<string,any>;};
const count=(v:unknown)=>{if(!Number.isSafeInteger(v)||(v as number)<0)throw new Error('Invalid experiment count');return v as number;};
const finite=(v:unknown)=>{if(typeof v!=='number'||!Number.isFinite(v)||v<0)throw new Error('Invalid experiment duration');return v;};
const bird=(v:unknown)=>{const s=v as PolicySnapshot;return createPolicySnapshot(restorePolicySnapshot(s),s);};
const rows=(v:unknown,game:Game)=>{if(!Array.isArray(v)||v.length>500)throw new Error('Invalid or excessive evaluation rows');return Object.freeze(v.map(x=>{const row=validateEvaluationRecord(x);if(row.game!==game)throw new Error('Wrong-game evaluation');return row;}));};
function evolutionProgress(value:unknown):EvolutionProgress|undefined{
 if(value===undefined)return undefined;const e=object(value);
 const completedGenerations=count(e.completedGenerations),evaluatedEpisodes=count(e.evaluatedEpisodes),steps=count(e.steps),elapsedMs=finite(e.elapsedMs);
 if(!Array.isArray(e.records)||e.records.length>20||completedGenerations!==e.records.length||evaluatedEpisodes>(e.records.length+1)*32)throw new Error('Invalid evolution progress/records');
 let completedAgentSteps=0,completedAgentCount=0;
 const records=e.records.map((raw,index)=>{const r=object(raw);if(r.generation!==index||typeof r.bestFitness!=='number'||!Number.isFinite(r.bestFitness)||typeof r.meanFitness!=='number'||!Number.isFinite(r.meanFitness)||!Number.isSafeInteger(r.groupCount)||r.groupCount<1||r.groupCount>32||!Array.isArray(r.agents)||r.agents.length<4||r.agents.length>32)throw new Error('Invalid evolution generation record');
  const ids=new Set<string>();const agents=r.agents.map(rawAgent=>{const a=object(rawAgent),result=object(a.result);if(typeof a.id!=='string'||!a.id||ids.has(a.id)||typeof a.fitness!=='number'||!Number.isFinite(a.fitness)||!Number.isSafeInteger(result.survivalSteps)||result.survivalSteps<1||result.survivalSteps>1800||typeof result.totalReward!=='number'||!Number.isFinite(result.totalReward)||!['collision','lap_complete','time_limit'].includes(String(result.terminationReason))||!Number.isSafeInteger(result.laps)||![0,1].includes(result.laps)||typeof result.crashed!=='boolean'||result.crashed!==(result.terminationReason==='collision')||result.laps!==(result.terminationReason==='lap_complete'?1:0)||![result.progressDistance,result.routeLength,result.progressFraction,result.elapsedSimulatedSeconds].every(n=>typeof n==='number'&&Number.isFinite(n)&&n>=0)||result.routeLength<=0||result.progressDistance>result.routeLength+1e-7||result.progressFraction>1+1e-7||Math.abs(result.progressFraction-result.progressDistance/result.routeLength)>1e-8||Math.abs(result.elapsedSimulatedSeconds-result.survivalSteps/60)>1e-9||result.terminationReason==='time_limit'&&result.survivalSteps!==1800)throw new Error('Invalid evolution agent result');ids.add(a.id);completedAgentSteps+=result.survivalSteps;completedAgentCount++;return Object.freeze({id:a.id,fitness:a.fitness,result:Object.freeze({...result})});});
  const scores=agents.map(a=>a.fitness),best=Math.max(...scores),mean=scores.reduce((sum,n)=>sum+n,0)/scores.length;if(Math.abs(best-r.bestFitness)>1e-9||Math.abs(mean-r.meanFitness)>1e-9)throw new Error('Evolution summary does not match agent fitness values');
  return Object.freeze({generation:index,bestFitness:r.bestFitness,meanFitness:r.meanFitness,groupCount:r.groupCount,agents:Object.freeze(agents)} as GenerationRecord);
 });
 if(steps<completedAgentSteps||evaluatedEpisodes<completedAgentCount)throw new Error('Evolution totals are below completed generation results');
 const champion=e.champion===undefined?undefined:validateCarSnapshot(e.champion);if((completedGenerations>0)!==!!champion||champion&&(champion.stage!=='evolution'||champion.training.generations!==completedGenerations||champion.training.interactions!==steps))throw new Error('Evolution champion does not match progress');
 return Object.freeze({completedGenerations,evaluatedEpisodes,steps,elapsedMs,records:Object.freeze(records),...(champion?{champion}:{})});
}
function requireStage<T extends {stage:string}>(value:unknown,stage:string,label:string):T{const s=object(value);if(s.stage!==stage)throw new Error(`${label} must use ${stage} snapshot`);return value as T;}
function validatePractice(value:unknown,game:'flappy'):Omit<NonNullable<FlappyLearningState['practice']>,'history'|'scoreHistory'>;
function validatePractice(value:unknown,game:'car'):Omit<NonNullable<CarLearningState['practice']>,'history'|'scores'>;
function validatePractice(value:unknown,game:Game){
 const x=object(value),episodes=count(x.episodes),trained=count(x.trainedEpisodes),steps=count(x.steps),seconds=finite(x.simulatedSeconds),elapsed=finite(x.elapsedMs);
 const snapshot=game==='car'?validateCarSnapshot(x.snapshot):bird(x.snapshot as PolicySnapshot);
 const rlCount=game==='car'?(snapshot as ReturnType<typeof validateCarSnapshot>).training.reinforcementEpisodes:(snapshot as PolicySnapshot).trainingCounts.reinforcementEpisodes;
 if(trained>episodes||steps<episodes||Math.abs(seconds-steps/60)>1e-9||!['imitation','post_rl'].includes(snapshot.stage)||trained>0&&snapshot.stage!=='post_rl'||rlCount<trained)throw new Error('Inconsistent practice counts, duration, or snapshot stage');
 if(x.cumulativeSteps!==undefined&&count(x.cumulativeSteps)<steps||x.cumulativeElapsedMs!==undefined&&finite(x.cumulativeElapsedMs)<elapsed)throw new Error('Cumulative practice totals are below current progress');
 return{episodes,trainedEpisodes:trained,steps,simulatedSeconds:seconds,elapsedMs:elapsed,snapshot};
}
function uniqueEpisodes(values:unknown,game:Game){if(!Array.isArray(values)||values.length>64)throw new Error('At most64 complete example episodes per experiment');if(game==='car'){const split=splitCarEpisodes(values);return Object.freeze([...split.training,...split.control]);}const episodes=values.map(validateEpisode);if(new Set(episodes.map(e=>e.id)).size!==episodes.length||new Set(episodes.map(e=>e.seed)).size!==episodes.length)throw new Error('Duplicate example identity/seed');if(episodes.some(e=>e.seed<1000||e.seed>2099))throw new Error('Invalid example namespace');return Object.freeze(episodes);}
/** Stored practice counters/model are retained; action replays stay in memory only. */
export function canonicalGameState(game:'flappy',value:unknown):FlappyLearningState;
export function canonicalGameState(game:'car',value:unknown):CarLearningState;
export function canonicalGameState(game:Game,value:unknown):FlappyLearningState|CarLearningState{
 const p=object(value);
 if(game==='flappy'){
  let teach:FlappyLearningState['teach'];if(p.teach){const t=object(p.teach);if(typeof t.imitationIsStale!=='boolean')throw new Error('Invalid stale flag');teach={initialSnapshot:bird(requireStage<PolicySnapshot>(t.initialSnapshot,'initial','Initial teacher')),imitationSnapshot:t.imitationSnapshot?bird(requireStage<PolicySnapshot>(t.imitationSnapshot,'imitation','Imitation teacher')):undefined,episodes:uniqueEpisodes(t.episodes,'flappy') as NonNullable<FlappyLearningState['teach']>['episodes'],imitationIsStale:t.imitationIsStale,status:'Hersteld uit lokaal experiment; controleer je voorbeelden.'};}
  const postRl=p.postRl?bird(requireStage(p.postRl,'post_rl','Post-RL')):undefined;
  let practice:FlappyLearningState['practice'];if(p.practice){const x=validatePractice(p.practice,'flappy');practice={...x,stepsPerSecond:finite(object(p.practice).stepsPerSecond),cumulativeSteps:p.practice.cumulativeSteps===undefined?undefined:count(p.practice.cumulativeSteps),cumulativeElapsedMs:p.practice.cumulativeElapsedMs===undefined?undefined:finite(p.practice.cumulativeElapsedMs),history:[],scoreHistory:[]};}
  if(teach?.imitationIsStale&&(practice||postRl))throw new Error('Stale imitation cannot retain practice or post-RL progress');
  return Object.freeze({teach,postRl,practice,human:rows(p.human??[],'flappy'),records:rows(p.records??[],'flappy')});
 }
 const doc=validateCircuit(p.document);buildRoute(doc);const draft=p.draft?validateCircuit(p.draft):undefined;
 let teach:CarLearningState['teach'];if(p.teach){const t=object(p.teach);if(typeof t.stale!=='boolean')throw new Error('Invalid stale flag');teach={episodes:uniqueEpisodes(t.episodes,'car') as NonNullable<CarLearningState['teach']>['episodes'],initial:validateCarSnapshot(requireStage(t.initial,'initial','Initial teacher')),imitation:t.imitation?validateCarSnapshot(requireStage(t.imitation,'imitation','Imitation teacher')):undefined,stale:t.stale};}
 let practice:CarLearningState['practice'];if(p.practice){const x=validatePractice(p.practice,'car');practice={...x,history:[],scores:[]};}
 if(teach?.stale&&practice)throw new Error('Stale imitation cannot retain practice progress');
 return Object.freeze({document:doc,draft,teach,practice,records:rows(p.records??[],'car'),evolution:evolutionProgress(p.evolution)} as CarLearningState);
}
export function validateExperiment(value:unknown,expectedGame?:Game):SavedExperiment{const e=object(value);if(e.kind!=='learning-experiment'||e.version!==1||!['flappy','car'].includes(e.game)||expectedGame&&e.game!==expectedGame||typeof e.savedAt!=='string'||!Number.isFinite(Date.parse(e.savedAt)))throw new Error('Incompatible experiment version/game');const game=e.game as Game;return Object.freeze({kind:'learning-experiment',version:1,game,savedAt:e.savedAt,payload:game==='car'?canonicalGameState('car',e.payload):canonicalGameState('flappy',e.payload)});}
export function createExperiment(game:Game,payload:unknown):SavedExperiment{return validateExperiment({kind:'learning-experiment',version:1,game,savedAt:new Date().toISOString(),payload});}
export function parseExperiment(text:string,expectedGame?:Game){if(new TextEncoder().encode(text).length>MAX_EXPERIMENT_BYTES)throw new Error('Experiment larger than8MiB');return validateExperiment(JSON.parse(text),expectedGame);}
export function serializeExperiment(experiment:SavedExperiment){const text=JSON.stringify(validateExperiment(experiment),null,2);if(new TextEncoder().encode(text).length>MAX_EXPERIMENT_BYTES)throw new Error('Experiment larger than8MiB');return text;}
