import type {DemoScene} from './timeline.ts';

export interface DemoPresentationState {
 readonly trainingDone?:boolean;
 readonly humanExamples?:number;
 readonly birdAttempts?:number;
 readonly carGenerations?:number;
 readonly waiting?:boolean;
 readonly carPlayback?:{trackIndex:number;trackCount:number;attemptIndex:number;availableAttempts:number;archiveSealed:boolean;speed:number};
}
/** Visitor copy follows the actual learning/play state; diagnostic detail stays in Bediening. */
export function demoPresentation(scene:DemoScene,state:DemoPresentationState={}){
 let title=scene.title,body=scene.body,badge='',count='';
 let action:'flappy'|'car'|'reserve'|'later'|null=null;
 const amount=(n:number|undefined)=>Number.isFinite(n)?Math.max(0,Math.floor(n!)):0;
 const quantity=(n:number|undefined,one:string,many:string)=>`${amount(n)} ${amount(n)===1?one:many}`;
 if(['f-untrained','f-examples','f-match'].includes(scene.id))action='flappy';
 if(['c-drive','c-match'].includes(scene.id))action='car';
 if(scene.id.endsWith('match-info'))action='reserve';
 if(scene.id==='f-examples')count=quantity(state.humanExamples,'opname','opnamen');
 if(scene.id==='f-imitation'){
  badge=amount(state.humanExamples)>0?'Jullie spel + voorbeeldspel':'Voorbeeldspel';
  if(state.trainingDone)title='De computer heeft geoefend.';
 }
 if(scene.id==='f-training'){
  action='later';
  count=quantity(state.birdAttempts,'poging','pogingen');
  if(state.trainingDone){title='Zo speelt de computer nu.';badge='Test';}
 }
 if(scene.id==='c-training'){
  action='later';badge='Opgenomen oefenronde';
  const p=state.carPlayback;if(p && p.availableAttempts)count=`Circuit ${p.trackIndex}/${p.trackCount} · Poging ${p.attemptIndex}/${p.archiveSealed?p.availableAttempts:10} · ${p.speed}×`;
 }
 if(state.waiting)action='later';
 return {title,body,badge,count,action,showClock:scene.id==='f-match'||scene.id==='c-match'} as const;
}
