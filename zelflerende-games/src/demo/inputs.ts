import {advanceFixedFrame} from '../core/fixed-step.ts';
import {readCarGamepad} from '../input/car-gamepad.ts';
import type {RacePad} from '../input/car-race-input.ts';
export interface DemoSeat {readonly kind:'pad'|'keyboard';readonly index:number;readonly id:string;readonly connected:boolean;}
/** Session-only seats; no controller identifier is written to experiment storage. */
export class DemoInputs {
 private members:(DemoSeat|undefined)[]=[undefined,undefined,undefined];private previous=new Set<string>();private taps:[0|1,0|1,0|1]=[0,0,0];
 get seats(){return this.members.map(s=>s&&({...s}));}
 get humans(){return this.members.map(s=>!!s?.connected) as [boolean,boolean,boolean];}
 poll(pads:readonly (RacePad|null)[]){
  const joined:number[]=[],left:number[]=[];
  this.members=this.members.map((s,i)=>{if(s?.kind!=='pad')return s;const connected=s.connected&&pads.some(p=>p?.connected&&p.index===s.index&&p.id===s.id);if(s.connected&&!connected)left.push(i);return{...s,connected};});
  const next=new Set<string>();
  for(const p of pads){if(!p?.connected||p.mapping!=='standard')continue;const key=`${p.index}:${p.id}`;if(!p.buttons[0]?.pressed)continue;next.add(key);if(this.previous.has(key))continue;
   const seat=this.members.findIndex(s=>s?.kind==='pad'&&s.index===p.index&&s.id===p.id&&s.connected);
   if(seat>=0){this.taps[seat]=1;continue;}
   const empty=this.members.findIndex(s=>!s?.connected);if(empty>=0){this.members[empty]={kind:'pad',index:p.index,id:p.id,connected:true};joined.push(empty);}
  }
  this.previous=next;return{joined,left};
 }
 keyboard(){this.members=this.members.map((s,i)=>s?.connected?s:{kind:'keyboard',index:i,id:`demo-key-${i}`,connected:true});}
 tapKey(key:string){const i=['f','j','l'].indexOf(key.toLowerCase());if(i>=0&&this.members[i]?.kind==='keyboard')this.taps[i]=1;}
 consume():readonly[0|1,0|1,0|1]{const taps=this.taps;this.taps=[0,0,0];return taps;}
 barrier(pads:readonly (RacePad|null)[]){this.taps=[0,0,0];this.previous=new Set(pads.filter(p=>p?.connected&&p.buttons[0]?.pressed).map(p=>`${p!.index}:${p!.id}`));}
 carControls(keys:ReadonlySet<string>,pads:readonly (RacePad|null)[]){return this.members.map((s,i)=>{
  if(!s?.connected)return{action:0 as const,throttle:0,brake:0};if(s.kind==='pad')return readCarGamepad(s.index,()=>pads);
  const [left,right,gas,brake]=[['arrowleft','arrowright','arrowup','arrowdown'],['a','d','w','s'],['j','l','i','k']][i]!;const l=keys.has(left!),r=keys.has(right!);return{action:(l===r?0:l?1:2) as 0|1|2,throttle:keys.has(gas!)?1:0,brake:keys.has(brake!)?1:0};
 });}
 reset(pads:readonly (RacePad|null)[]){this.members=[undefined,undefined,undefined];this.barrier(pads);}
}

/** Consume action edges only on actual60Hz steps, including on120/144Hz displays. */
export function advanceDemoInputs(inputs:DemoInputs,deltaMs:number,accumulatorMs:number,step:(actions:readonly[0|1,0|1,0|1])=>void){
 return advanceFixedFrame(deltaMs,accumulatorMs,()=>inputs.consume(),step);
}
