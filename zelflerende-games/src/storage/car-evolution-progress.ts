import { validateCarSnapshot,type CarSnapshot } from '../car/policy-adapter.ts';
import type { CarEpisodeResult } from '../car/environment.ts';
import type { EvolutionProgress,GenerationRecord,TrackEvaluation } from '../evolution/generation-job.ts';
import { scoreCarResult } from '../evolution/population-evaluation.ts';
import { stableIdentity } from '../core/identity.ts';
const object=(v:unknown):Record<string,any>=>{if(!v||typeof v!=='object'||Array.isArray(v))throw new Error('Invalid evolution object');return v as Record<string,any>;};
const count=(v:unknown)=>{if(!Number.isSafeInteger(v)||Number(v)<0)throw new Error('Invalid evolution count');return v as number;};
function result(value:unknown):CarEpisodeResult{
 const r=object(value);
 if(!Number.isSafeInteger(r.survivalSteps)||r.survivalSteps<1||r.survivalSteps>1800||!Number.isFinite(r.totalReward)||!['collision','lap_complete','time_limit'].includes(r.terminationReason)||![0,1].includes(r.laps)||typeof r.crashed!=='boolean'||r.crashed!==(r.terminationReason==='collision')||r.laps!==(r.terminationReason==='lap_complete'?1:0)||![r.progressDistance,r.routeLength,r.progressFraction,r.elapsedSimulatedSeconds].every(n=>typeof n==='number'&&Number.isFinite(n)&&n>=0)||r.routeLength<=0||r.progressDistance>r.routeLength+1e-7||r.progressFraction>1+1e-7||Math.abs(r.progressFraction-r.progressDistance/r.routeLength)>1e-8||Math.abs(r.elapsedSimulatedSeconds-r.survivalSteps/60)>1e-9||r.terminationReason==='time_limit'&&r.survivalSteps!==1800)throw new Error('Invalid evolution agent result');
 return Object.freeze({survivalSteps:r.survivalSteps,totalReward:r.totalReward,terminationReason:r.terminationReason,laps:r.laps,crashed:r.crashed,progressDistance:r.progressDistance,routeLength:r.routeLength,progressFraction:r.progressFraction,elapsedSimulatedSeconds:r.elapsedSimulatedSeconds});
}
/** Canonical durable results only; live frames and action replays are deliberately transient. */
export function validateCarEvolutionProgress(value:unknown,legacyTrackId:string):EvolutionProgress|undefined{
 if(value===undefined)return undefined;const e=object(value),completedGenerations=count(e.completedGenerations),evaluatedEpisodes=count(e.evaluatedEpisodes),steps=count(e.steps);
 if(!Number.isFinite(e.elapsedMs)||e.elapsedMs<0||steps>50_000_000||!Array.isArray(e.records)||e.records.length>100||e.records.length!==completedGenerations)throw new Error('Invalid evolution progress/records');
 const rawIds=e.trainingTrackIds??e.champion?.training?.trackIds??[legacyTrackId];
 if(!Array.isArray(rawIds)||rawIds.length<1||rawIds.length>8||new Set(rawIds).size!==rawIds.length||rawIds.some(id=>typeof id!=='string'||!id.trim()||id.length>64))throw new Error('Invalid evolution circuit sequence');
 const trainingTrackIds=Object.freeze([...rawIds]) as readonly string[];let completeSteps=0,completeEpisodes=0;
 const totals:number[]=[];
 const records=e.records.map((raw,index)=>{
  const r=object(raw);if(r.generation!==index||!Number.isFinite(r.bestFitness)||!Number.isFinite(r.meanFitness)||!Number.isSafeInteger(r.groupCount)||r.groupCount<1||r.groupCount>32||!Array.isArray(r.agents)||r.agents.length<4||r.agents.length>32)throw new Error('Invalid evolution generation record');
  const seen=new Set<string>();
  const agents=r.agents.map((rawAgent:unknown)=>{const a=object(rawAgent);if(typeof a.id!=='string'||!a.id.trim()||a.id.length>100||seen.has(a.id)||!Number.isFinite(a.fitness))throw new Error('Invalid evolution agent');seen.add(a.id);
   const first=result(a.result),rawTracks=a.perTrack??(trainingTrackIds.length===1?[{trackId:trainingTrackIds[0],result:first,fitness:a.fitness}]:undefined);
   if(!Array.isArray(rawTracks)||rawTracks.length!==trainingTrackIds.length)throw new Error('Incomplete evolution circuit coverage');
   const perTrack:readonly TrackEvaluation[]=Object.freeze(rawTracks.map((value,i)=>{const t=object(value),r=result(t.result);if(t.trackId!==trainingTrackIds[i]||!Number.isFinite(t.fitness)||Math.abs(t.fitness-scoreCarResult(r))>1e-9)throw new Error('Invalid evolution circuit result');completeSteps+=r.survivalSteps;completeEpisodes++;return Object.freeze({trackId:t.trackId as string,result:r,fitness:t.fitness as number});}));
   if(stableIdentity(first)!==stableIdentity(perTrack[0]!.result)||Math.abs(a.fitness-perTrack.reduce((n,t)=>n+t.fitness,0)/perTrack.length)>1e-9)throw new Error('Evolution aggregate does not match circuit results');
   return Object.freeze({id:a.id,fitness:a.fitness,result:first,perTrack});
  });
  const best=Math.max(...agents.map(a=>a.fitness)),mean=agents.reduce((n,a)=>n+a.fitness,0)/agents.length;
  if(Math.abs(best-r.bestFitness)>1e-9||Math.abs(mean-r.meanFitness)>1e-9)throw new Error('Evolution summary does not match agent fitness values');totals.push(completeSteps);
  return Object.freeze({generation:index,bestFitness:best,meanFitness:mean,groupCount:r.groupCount,agents:Object.freeze(agents)} as GenerationRecord);
 });
 if(steps<completeSteps||evaluatedEpisodes<completeEpisodes||evaluatedEpisodes>(completedGenerations+1)*32*trainingTrackIds.length)throw new Error('Evolution totals do not match completed results');
 const validSnapshot=(value:unknown):CarSnapshot=>{const s=validateCarSnapshot(value);if(s.stage!=='evolution'||!s.training.generations||s.training.generations>completedGenerations||s.training.interactions>steps||s.training.interactions<(totals[s.training.generations-1]??0)||stableIdentity(s.training.trackIds)!==stableIdentity(trainingTrackIds))throw new Error('Evolution snapshot does not match progress');return s;};
 const champion=e.champion===undefined?undefined:validSnapshot(e.champion);
 if((completedGenerations>0)!==!!champion||champion?.training.generations!==undefined&&champion.training.generations!==completedGenerations)throw new Error('Evolution champion does not match progress');
 let milestones:readonly CarSnapshot[]|undefined;
 if(e.milestones!==undefined){if(!Array.isArray(e.milestones)||e.milestones.length>3)throw new Error('Invalid evolution milestones');const seen=new Set<number>();milestones=Object.freeze(e.milestones.map((value:unknown)=>{const s=validSnapshot(value),g=s.training.generations!;if(![1,10,completedGenerations].includes(g)||seen.has(g))throw new Error('Invalid evolution checkpoint generation');seen.add(g);return s;}));}
 return Object.freeze({completedGenerations,evaluatedEpisodes,steps,elapsedMs:e.elapsedMs,trainingTrackIds,records:Object.freeze(records),...(champion?{champion}:{}),...(milestones?{milestones}:{})});
}
