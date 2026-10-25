import { FlappyEnvironment,type FlappyEpisodeResult } from './environment.ts';
import type { WorldState } from './world.ts';
import { restorePolicySnapshot,createPolicySnapshot,type PolicySnapshot } from '../learning/policy-snapshot.ts';
import { createSeededRandom } from '../core/random.ts';
export interface FlockBird {readonly id:number;readonly world:WorldState;readonly done:boolean;readonly pipesPassed:number;readonly result?:FlappyEpisodeResult;}
/** Live, frozen-policy inference. Common openings; independent action RNG per bird. No training. */
export class FlappyFlock {
 readonly snapshot:PolicySnapshot;readonly environmentSeed:number;
 private readonly policy:ReturnType<typeof restorePolicySnapshot>;
 private readonly members:{id:number;env:FlappyEnvironment;random:()=>number}[];
 private rounds=0;
 constructor(snapshot:PolicySnapshot,count=12,environmentSeed=2005,actionSeed=5000){
  if(!Number.isInteger(count)||count<2||count>32||!Number.isSafeInteger(environmentSeed)||environmentSeed<2000||environmentSeed>2099||!Number.isSafeInteger(actionSeed)||actionSeed>Number.MAX_SAFE_INTEGER-count)throw new Error('Invalid finite flock size or control seeds');
  this.snapshot=createPolicySnapshot(restorePolicySnapshot(snapshot),snapshot);this.policy=restorePolicySnapshot(this.snapshot);this.environmentSeed=environmentSeed;
  this.members=Array.from({length:count},(_,id)=>{const env=new FlappyEnvironment();env.reset({seed:environmentSeed});return{id,env,random:createSeededRandom(actionSeed+id)};});
 }
 get birds():readonly FlockBird[]{return Object.freeze(this.members.map(m=>Object.freeze({id:m.id,world:m.env.world,pipesPassed:m.env.pipesPassed,done:!!m.env.completedResult,...(m.env.completedResult?{result:m.env.completedResult}:{})})));}
 get done(){return this.members.every(m=>!!m.env.completedResult);}
 get steps(){return this.rounds;}
 step(){if(this.done)return;for(const m of this.members)if(!m.env.completedResult)m.env.step(this.policy.sampleAction(m.env.getObservation(),m.random));this.rounds++;}
}
/** Fixed60Hz simulation; wall speed never alters dt or policy. Hidden/stalled time is bounded. */
export function advanceVisualClock(deltaMs:number,accumulatorMs:number,speed:number){
 if(!Number.isFinite(deltaMs)||!Number.isFinite(accumulatorMs)||accumulatorMs<0||!Number.isFinite(speed)||speed<.5||speed>8)throw new Error('Invalid visual clock');
 const total=accumulatorMs+Math.max(0,Math.min(100,deltaMs))*speed,dt=1000/60,steps=Math.floor((total+1e-9)/dt);return{steps,accumulatorMs:Math.max(0,total-steps*dt)};
}

export function flockLeader(birds:readonly FlockBird[]){return [...birds].sort((a,b)=>b.pipesPassed-a.pipesPassed||b.world.steps-a.world.steps||a.id-b.id)[0];}
