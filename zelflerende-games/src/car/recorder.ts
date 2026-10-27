import { CAR_CONFIG, type CarWorldVersion, type CarAction } from './config.ts';
import { CarEnvironment, type CarEpisodeResult } from './environment.ts';
import { validateCircuit, trackIdentity, type CircuitDocument } from '../tracks/document.ts';
import { assertTrainingTrack } from '../tracks/catalog.ts';
import { pointAtDistance } from '../tracks/route.ts';
import type { EnvironmentStep } from '../core/contracts.ts';

export const CAR_EPISODE_VERSION = 'car-episode-v1' as const;
export type CarEpisodeSource = 'human' | 'synthetic_reference';
export interface CarEpisodeFrame { readonly step:number; readonly observation:readonly number[]; readonly action:CarAction; }
export interface CarEpisode {
  readonly version:typeof CAR_EPISODE_VERSION; readonly game:'car'; readonly id:string; readonly seed:number;
  readonly worldVersion:CarWorldVersion; readonly observationVersion:typeof CAR_CONFIG.observationVersion;
  readonly trackId:string; readonly trackIdentity:string; readonly circuit:CircuitDocument;
  readonly source:CarEpisodeSource; readonly frames:readonly CarEpisodeFrame[];
  readonly durationSeconds:number; readonly result:CarEpisodeResult;
}
const finite=(n:unknown):n is number=>typeof n==='number'&&Number.isFinite(n);
export function validateCarEpisode(value:unknown):CarEpisode {
  if(!value||typeof value!=='object')throw new Error('Car episode required');
  const e=value as CarEpisode;
  if(e.game!=='car'||e.version!==CAR_EPISODE_VERSION||!['car-world-v1','car-world-v2'].includes(e.worldVersion)||e.observationVersion!==CAR_CONFIG.observationVersion)throw new Error('Incompatible car episode or bird data');
  if(typeof e.id!=='string'||!e.id.trim()||!Number.isSafeInteger(e.seed))throw new Error('Invalid episode identity or seed');
  if(e.source!=='human'&&e.source!=='synthetic_reference')throw new Error('Invalid car episode source');
  const circuit=validateCircuit(e.circuit), identity=trackIdentity(circuit);
  if(e.trackIdentity!==identity||e.trackId!==identity)throw new Error('Car episode track identity mismatch');
  if(!Array.isArray(e.frames)||!e.frames.length||e.frames.length>1800)throw new Error('Car episode must contain complete episode frames');
  for(let i=0;i<e.frames.length;i++){
    const f=e.frames[i]!;
    if(f.step!==i||!Array.isArray(f.observation)||f.observation.length!==6||!f.observation.every((v:unknown)=>finite(v)&&v>=0&&v<=1)||![0,1,2].includes(f.action))throw new Error('Invalid car frame dimensions, values, or action');
  }
  const r=e.result;
  if(!r||!['collision','lap_complete','time_limit'].includes(r.terminationReason)||!Number.isSafeInteger(r.survivalSteps)||r.survivalSteps!==e.frames.length||!finite(r.totalReward)||!finite(r.progressDistance)||!finite(r.routeLength)||!finite(r.progressFraction)||!finite(r.elapsedSimulatedSeconds)||r.laps!==(r.terminationReason==='lap_complete'?1:0)||r.crashed!==(r.terminationReason==='collision'))throw new Error('Car episode is not a complete valid result');
  if(!finite(e.durationSeconds)||Math.abs(e.durationSeconds-e.frames.length*CAR_CONFIG.dt)>1e-9)throw new Error('Invalid or mutable car episode duration/result');
  if(e.seed>=1000&&e.seed<=1999)assertTrainingTrack(circuit);
  if(r.routeLength<=0||r.progressDistance<0||r.progressDistance>r.routeLength+1e-7||r.progressFraction<0||r.progressFraction>1+1e-7||Math.abs(r.progressFraction-r.progressDistance/r.routeLength)>1e-8||Math.abs(r.elapsedSimulatedSeconds-e.durationSeconds)>1e-9)throw new Error('Invalid car result ranges');
  return Object.freeze({...e,circuit,frames:Object.freeze(e.frames.map(f=>Object.freeze({...f,observation:Object.freeze([...f.observation])}))),result:Object.freeze({...r})});
}
export function splitCarEpisodes(episodes:readonly CarEpisode[]):{readonly training:readonly CarEpisode[];readonly control:readonly CarEpisode[]} {
  const ids=new Set<string>(),seeds=new Set<number>(),training:CarEpisode[]=[],control:CarEpisode[]=[];
  for(const raw of episodes){const e=validateCarEpisode(raw);if(ids.has(e.id)||seeds.has(e.seed))throw new Error('Episode ids and seeds must be distinct');ids.add(e.id);seeds.add(e.seed);
    if(e.seed>=1000&&e.seed<=1999){assertTrainingTrack(e.circuit);training.push(e);}else if(e.seed>=2000&&e.seed<=2099)control.push(e);else throw new Error('Car episode seed must be in training 1000–1999 or control 2000–2099 namespace');}
  return Object.freeze({training:Object.freeze(training),control:Object.freeze(control)});
}

/** Records the observation before each action. Call step only on simulation steps; starting again discards partial data. */
export class CarEpisodeRecorder {
  readonly environment:CarEnvironment; readonly circuit:CircuitDocument; readonly trackIdentity:string;
  private frames:CarEpisodeFrame[]=[]; private metadata:{id:string;seed:number;source:CarEpisodeSource}|undefined; private saved:CarEpisode|undefined;
  constructor(document:CircuitDocument,worldVersion?:CarWorldVersion){this.circuit=validateCircuit(document);this.trackIdentity=trackIdentity(this.circuit);this.environment=new CarEnvironment(this.circuit,worldVersion);}
  start(id:string,seed:number,source:CarEpisodeSource='human'){
    if(!id.trim()||!Number.isSafeInteger(seed)||!['human','synthetic_reference'].includes(source))throw new Error('Invalid car episode identity/source');
    this.environment.reset({seed});this.metadata={id,seed,source};this.frames=[];this.saved=undefined;
  }
  step(action:CarAction):EnvironmentStep<CarEpisodeResult>{
    if(!this.metadata||this.saved)throw new Error('Start a new car recording episode');
    if(![0,1,2].includes(action))throw new Error('Invalid car action');
    const frame=Object.freeze({step:this.frames.length,observation:Object.freeze([...this.environment.getObservation()]),action});
    const transition=this.environment.step(action);this.frames.push(frame);
    if(transition.done&&transition.result){const meta=this.metadata;this.saved=Object.freeze({version:CAR_EPISODE_VERSION,game:'car',...meta,worldVersion:this.environment.config.version,observationVersion:CAR_CONFIG.observationVersion,trackId:this.trackIdentity,trackIdentity:this.trackIdentity,circuit:this.circuit,frames:Object.freeze([...this.frames]),durationSeconds:this.frames.length*CAR_CONFIG.dt,result:transition.result});validateCarEpisode(this.saved);}
    return transition;
  }
  get completedEpisode(){return this.saved;}
}

/** Privileged route-following worked example. Labels are provenance, never learned-policy output. */
export function generateCarReferenceEpisode(document:CircuitDocument,seed:number,source:CarEpisodeSource='synthetic_reference',worldVersion?:CarWorldVersion):CarEpisode {
  if(source!=='synthetic_reference')throw new Error('Reference episodes must be labelled synthetic_reference');
  const rec=new CarEpisodeRecorder(document,worldVersion);rec.start(`car-reference-${seed}-${rec.trackIdentity}`,seed,source);
  for(let i=0;i<1800;i++){const env=rec.environment, target=pointAtDistance(env.route,env.world.progress.bestDistance+25),car=env.world.car;
    const error=Math.atan2(Math.sin(Math.atan2(target.y-car.y,target.x-car.x)-car.heading),Math.cos(Math.atan2(target.y-car.y,target.x-car.x)-car.heading));
    const action:CarAction=error>.04?2:error<-.04?1:0;if(rec.step(action).done)break;
  }
  const episode=rec.completedEpisode;if(!episode)throw new Error('Reference route did not produce a complete episode');return episode;
}
