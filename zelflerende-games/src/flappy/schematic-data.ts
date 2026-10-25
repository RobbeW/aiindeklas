import { FlappyEnvironment } from './environment.ts';
import { PHYSICS } from './physics.ts';
import type { WorldState } from './world.ts';
import type { DemonstrationEpisode,DemonstrationFrame } from '../data/demonstrations.ts';
import { DemonstrationRecorder } from './recorder.ts';
import { generateReferenceDemonstration } from './reference-demonstrations.ts';
import { createSeededRandom } from '../core/random.ts';
import { BernoulliPolicy } from '../learning/policy.ts';
import { createPolicySnapshot,restorePolicySnapshot,type PolicySnapshot } from '../learning/policy-snapshot.ts';
import type { Observation } from '../core/contracts.ts';

export interface RewardMoment {readonly step:number;readonly world:WorldState;readonly reward:number;readonly total:number;readonly score:number;readonly event:'flying'|'opening'|'collision';}
/** One complete ordinary-physics attempt: follow the existing reference rule until one opening, then wait. */
export function createRewardAttempt(){
 const env=new FlappyEnvironment();let observation=env.reset({seed:1000});const frames:RewardMoment[]=[];let passed=false,total=0;
 for(;;){
  const gapCenter=(observation[3]!+observation[4]!)/2;
  const action=(!passed&&observation[0]!>gapCenter+.02&&observation[1]!>=0?1:0) as 0|1;
  const previousScore=env.pipesPassed,t=env.step(action);total+=t.reward;
  const event=t.done&&t.reason!=='time_limit'?'collision':env.pipesPassed>previousScore?'opening':'flying';
  frames.push(Object.freeze({step:env.world.steps,world:env.world,reward:t.reward,total,score:env.pipesPassed,event}));
  passed=env.pipesPassed>0;observation=t.observation;if(t.done)break;
 }
 const opening=frames.findIndex(f=>f.event==='opening'),collision=frames.findIndex(f=>f.event==='collision');
 if(opening<0||collision<0)throw new Error('Reward explanation needs an opening and a collision.');
 return Object.freeze({frames:Object.freeze(frames),moments:Object.freeze([frames[0]!,frames[opening]!,frames[collision]!])});
}
export const coverageKinds=['high','low','rising','falling','near'] as const;
export type CoverageKind=typeof coverageKinds[number];
export const coverageNames:Record<CoverageKind,string>={high:'Hoog',low:'Laag',rising:'Stijgend',falling:'Dalend',near:'Dicht bij een opening'};
export function coveredKinds(frame:DemonstrationFrame):readonly CoverageKind[]{
 const o=frame.observation,y=(o[0]!+1)*PHYSICS.groundY/2,distance=o[2]!*PHYSICS.worldWidth;
 return coverageKinds.filter(k=>k==='high'?y<PHYSICS.groundY/3:k==='low'?y>2*PHYSICS.groundY/3:k==='rising'?o[1]!<0:k==='falling'?o[1]!>0:distance>=0&&distance<=120);
}
export function summarizeCoverage(episodes:readonly DemonstrationEpisode[]){
 const frames=episodes.flatMap(e=>e.frames),counts=Object.fromEntries(coverageKinds.map(k=>[k,0])) as Record<CoverageKind,number>,examples:Partial<Record<CoverageKind,DemonstrationFrame>>={};
 for(const frame of frames)for(const kind of coveredKinds(frame)){counts[kind]++;examples[kind]??=frame;}
 return{total:frames.length,episodes:episodes.length,counts,examples};
}
export function createCoverageCollections(){
 const recorder=new DemonstrationRecorder();recorder.start('synthetic-waiting',1000,'synthetic_reference');while(!recorder.step(0).done){}
 return{waiting:summarizeCoverage([recorder.completedEpisode!]),varied:summarizeCoverage([1000,1007,1031].map(seed=>generateReferenceDemonstration(seed)))};
}
export type DataRole='training'|'control'|'test';
export const dataRoles:Record<DataRole,{name:string;changes:boolean;action:string;copy:string}>={
 training:{name:'Training',changes:true,action:'Oefenen',copy:'Het AI-model oefent met jouw voorbeelden: wanneer flap je en wanneer wacht je? Door te oefenen kan het beter worden.'},
 control:{name:'Controle',changes:false,action:'Nakijken',copy:'Jouw acties uit een aparte opname vormen de correctiesleutel: flappen of wachten. We vergelijken de antwoorden van het AI-model met die voorbeelden, zonder het verder te trainen.'},
 test:{name:'Test',changes:false,action:'Examen afleggen',copy:'De test is als een examen. Het AI-model speelt zelf en we bekijken de score. Mens en AI-modellen krijgen dezelfde drie reeksen, zodat je hun prestaties kunt vergelijken.'},
};
/** Twelve independent action draws, from exactly one frozen model and the same observation each round. */
export class FrozenChoiceExample {
 readonly snapshot:PolicySnapshot;
 private readonly policy:BernoulliPolicy;
 private streams=Array.from({length:12},(_,i)=>createSeededRandom(8000+i));
 constructor(snapshot?:PolicySnapshot){this.snapshot=snapshot??createPolicySnapshot(new BernoulliPolicy(1222),{stage:'initial'});this.policy=restorePolicySnapshot(this.snapshot);this.snapshot=createPolicySnapshot(this.policy,this.snapshot);}
 choose(observation:Observation){const probability=this.policy.probability(observation);return{probability,actions:Object.freeze(this.streams.map(random=>this.policy.sampleAction(observation,random)))};}
 reset(){this.streams=Array.from({length:12},(_,i)=>createSeededRandom(8000+i));}
}
