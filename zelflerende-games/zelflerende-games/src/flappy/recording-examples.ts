import type { DemonstrationEpisode,DemonstrationFrame } from '../data/demonstrations.ts';
import { FlappyEnvironment } from './environment.ts';
import type { WorldState } from './world.ts';
import { generateReferenceDemonstration } from './reference-demonstrations.ts';
export type RecordingRole='training'|'validation';
export interface RecordingExample {readonly frame:DemonstrationFrame;readonly world:WorldState;}
export function recordingRole(episode:DemonstrationEpisode):RecordingRole|undefined{
 if(episode.seed>=1000&&episode.seed<=1999)return'training';
 if(episode.seed>=2000&&episode.seed<=2099&&episode.seed!==2005)return'validation';
 return undefined;
}
/** Inspect four adjacent moments, including a flap with an opening on screen where possible. Never changes the episode. */
export function inspectRecording(episode:DemonstrationEpisode):readonly RecordingExample[]{
 if(!episode.frames.length)throw new Error('Deze opname bevat geen spelmomenten.');
 const visibleFlap=episode.frames.findIndex(f=>f.step>=80&&f.action===1),firstFlap=visibleFlap>=0?visibleFlap:episode.frames.findIndex(f=>f.action===1),start=Math.max(0,Math.min(firstFlap<0?0:firstFlap-1,episode.frames.length-4));
 const env=new FlappyEnvironment();env.reset({seed:episode.seed});const result:RecordingExample[]=[];
 for(const frame of episode.frames){
  if(frame.step>=start&&result.length<4){
   const actual=env.getObservation();
   if(actual.some((v,i)=>Math.abs(v-frame.observation[i]!)>1e-9))throw new Error('De opname past niet bij deze spelversie.');
   result.push(Object.freeze({frame,world:env.world}));
  }
  if(result.length===Math.min(4,episode.frames.length))break;
  env.step(frame.action);
 }
 return Object.freeze(result);
}
export function chooseRecording(episodes:readonly DemonstrationEpisode[],role:RecordingRole){
 const supplied=episodes.find(e=>recordingRole(e)===role&&e.source==='human')??episodes.find(e=>recordingRole(e)===role);
 if(supplied){try{return{episode:supplied,examples:inspectRecording(supplied),fallback:false};}catch{/* Explicitly labelled reference fallback below; saved data is untouched. */}}
 const episode=generateReferenceDemonstration(role==='training'?1000:2000);
 return{episode,examples:inspectRecording(episode),fallback:!!supplied};
}
