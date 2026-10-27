import { CarEnvironment,type CarWorld,type CarEpisodeResult } from './environment.ts';
import { restoreCarSnapshot,validateCarSnapshot,type CarSnapshot } from './policy-adapter.ts';
import type { CircuitDocument } from '../tracks/document.ts';
import type { CarAction } from './config.ts';

export interface RaceControl {readonly action:CarAction;readonly throttle:number;readonly brake:number;}
export type CarRacePhase='ready'|'running'|'paused'|'finished';
export interface CarRaceRacer {readonly id:number;readonly ai:boolean;readonly world:CarWorld;readonly result:CarEpisodeResult|undefined;}
/** One clock and circuit, independent ghost worlds. Racing never trains the opponent. */
export class CarRaceSession {
 readonly model:CarSnapshot;readonly humans:1|3;
 private readonly policy;
 private readonly environments:CarEnvironment[];
 private phaseValue:CarRacePhase='ready';
 private ticks=0;
 constructor(document:CircuitDocument,model:CarSnapshot,humans:1|3){
  this.humans=humans;
  if(humans!==1&&humans!==3)throw new Error('Choose one or three human racers');
  this.model=validateCarSnapshot(model);
  if(this.model.stage==='initial')throw new Error('Train an AI model before racing');
  this.policy=restoreCarSnapshot(this.model);
  this.environments=Array.from({length:humans+1},()=>{const env=new CarEnvironment(document);env.reset({seed:2005});return env;});
 }
 get phase(){return this.phaseValue;}
 get elapsedSteps(){return this.ticks;}
 get route(){return this.environments[0]!.route;}
 get racers():readonly CarRaceRacer[]{return Object.freeze(this.environments.map((env,id)=>Object.freeze({id,ai:id===this.humans,world:env.world,result:env.completedResult})));}
 start(){if(this.phaseValue==='ready'||this.phaseValue==='paused')this.phaseValue='running';}
 pause(){if(this.phaseValue==='running')this.phaseValue='paused';}
 step(controls:readonly RaceControl[]){
  if(this.phaseValue!=='running')return;
  if(controls.length!==this.humans||controls.some(c=>![0,1,2].includes(c.action)||![c.throttle,c.brake].every(n=>Number.isFinite(n)&&n>=0&&n<=1)))throw new Error('Invalid human race controls');
  for(let id=0;id<this.environments.length;id++){
   const env=this.environments[id]!;if(env.completedResult)continue;
   if(id===this.humans)env.step(this.policy.action(env.getObservation()));
   else {const c=controls[id]!;env.step(c.action,{throttle:c.throttle,brake:c.brake});}
  }
  this.ticks++;
  if(this.environments.every(e=>e.completedResult))this.phaseValue='finished';
 }
 /** Equal ranks stay equal; no winner is manufactured from array order. */
 get standings(){
  const value=(r:CarRaceRacer)=>({lap:r.result?.laps??0,progress:r.world.progress.bestDistance,time:r.result?.elapsedSimulatedSeconds??Infinity});
  const compare=(a:CarRaceRacer,b:CarRaceRacer)=>{const x=value(a),y=value(b);return y.lap-x.lap||(x.lap?x.time-y.time:y.progress-x.progress);};
  const ordered=[...this.racers].sort(compare);
  return Object.freeze(ordered.map((r,i)=>Object.freeze({...r,rank:1+ordered.filter(other=>compare(other,r)<0).length})));
 }
}
