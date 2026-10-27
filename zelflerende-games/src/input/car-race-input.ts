import { readCarGamepad } from './car-gamepad.ts';
import type { RaceControl } from '../car/race-session.ts';
export type RaceBinding={kind:'arrows'|'wasd'}|{kind:'pad';index:number;id:string};
export interface RacePad {index:number;id:string;connected:boolean;mapping:string;buttons:readonly {pressed:boolean;value:number}[];axes:readonly number[];}
export const neutralRaceControl:RaceControl=Object.freeze({action:0,throttle:0,brake:0});
/** No device identifiers enter saved experiments. Each device belongs to one seat. */
export class CarRaceInput {
 readonly bindings:(RaceBinding|undefined)[];readonly humans:1|3;
 private previous=new Set<number>();
 constructor(humans:1|3){this.humans=humans;this.bindings=Array.from({length:humans},(_,i)=>i===0?{kind:'arrows'}:undefined);}
 setKeyboard(seat:number,kind:'arrows'|'wasd'|undefined){
  if(seat<0||seat>=this.humans)throw new Error('Invalid race seat');
  if(kind&&this.bindings.some((b,i)=>i!==seat&&b?.kind===kind))return false;
  this.bindings[seat]=kind?{kind}:undefined;return true;
 }
 connected(seat:number,pads:readonly (RacePad|null)[]){const b=this.bindings[seat];return !!b&&(b.kind!=='pad'||pads.some(p=>p?.connected&&p.index===b.index&&p.id===b.id));}
 ready(pads:readonly (RacePad|null)[]){return this.bindings.every((_,i)=>this.connected(i,pads));}
 poll(pads:readonly (RacePad|null)[],join:boolean){
  const pressed=new Set<number>();let pause=false;
  for(const p of pads){if(!p?.connected)continue;
   if(p.buttons[0]?.pressed){pressed.add(p.index);if(join&&!this.previous.has(p.index)&&p.mapping==='standard'&&!this.bindings.some((b,i)=>b?.kind==='pad'&&b.index===p.index&&this.connected(i,pads))){
    const seat=this.bindings.findIndex((b,i)=>!b||!this.connected(i,pads));if(seat>=0)this.bindings[seat]={kind:'pad',index:p.index,id:p.id};
   }}
   if(p.buttons[9]?.pressed){pressed.add(p.index+10000);if(!this.previous.has(p.index+10000)&&this.bindings.some(b=>b?.kind==='pad'&&b.index===p.index))pause=true;}
  }
  this.previous=pressed;return {pause};
 }
 controls(keys:ReadonlySet<string>,pads:readonly (RacePad|null)[]):readonly RaceControl[]{
  return this.bindings.map((b,i)=>{
   if(!b||!this.connected(i,pads))return neutralRaceControl;
   if(b.kind==='pad')return readCarGamepad(b.index,()=>pads);
   const [left,right,gas,brake]=b.kind==='arrows'?['arrowleft','arrowright','arrowup','arrowdown']:['a','d','w','s'];
   const l=keys.has(left!),r=keys.has(right!);return {action:l===r?0:l?1:2,throttle:keys.has(gas!)?1:0,brake:keys.has(brake!)?1:0};
  });
 }
}
