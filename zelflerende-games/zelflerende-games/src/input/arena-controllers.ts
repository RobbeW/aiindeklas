/** Session-local controller assignment. Device IDs are never saved or exported. */
export interface ArenaPad { readonly index:number; readonly id:string; readonly connected:boolean; readonly mapping:string; readonly buttons:readonly {readonly pressed:boolean}[]; }
export interface ArenaSeat { readonly index:number; readonly id:string; readonly button:number; readonly standard:boolean; readonly ready:boolean; readonly connected:boolean; }
export type ArenaInputMode='lobby'|'game'|'paused'|'countdown'|'finished';
export class ArenaControllers {
 private assignments:(ArenaSeat|undefined)[]=[undefined,undefined,undefined];
 private previous=new Map<string,boolean>();
 private pending:[0|1,0|1,0|1]=[0,0,0];
 get seats():readonly (ArenaSeat|undefined)[]{return Object.freeze([...this.assignments]);}
 get allConnected(){return this.assignments.every(s=>s?.connected);}
 get allReady(){return this.assignments.every(s=>s?.ready&&s.connected);}
 poll(pads:readonly (ArenaPad|null)[],mode:ArenaInputMode){
  const available=pads.filter((p):p is ArenaPad=>!!p?.connected);
  this.assignments=this.assignments.map(s=>s&&({...s,connected:s.connected&&available.some(p=>p.index===s.index&&p.id===s.id)}));
  const joined:number[]=[],readied:number[]=[];
  const fresh=(p:ArenaPad,b:number)=>!!p.buttons[b]?.pressed&&!this.previous.get(`${p.index}:${b}`);
  for(const pad of available){
   const assigned=this.assignments.findIndex(s=>s?.connected&&s.index===pad.index);
   if(assigned>=0){
    const seat=this.assignments[assigned]!;
    if(fresh(pad,seat.button)){
     if(mode==='lobby'&&!seat.ready){this.assignments[assigned]={...seat,ready:true};readied.push(assigned);}
     if(mode==='game')this.pending[assigned]=1;
    }
   }else if(mode==='lobby'||mode==='paused'){
    const button=pad.mapping==='standard'?(fresh(pad,0)?0:-1):pad.buttons.findIndex((_,i)=>fresh(pad,i));
    const seat=mode==='paused'?this.assignments.findIndex(s=>!!s&&!s.connected):this.assignments.findIndex(s=>!s||!s.connected);
    if(button>=0&&seat>=0){this.assignments[seat]={index:pad.index,id:pad.id,button,standard:pad.mapping==='standard',ready:mode==='paused',connected:true};joined.push(seat);}
   }
  }
  this.previous.clear();for(const p of available)p.buttons.forEach((b,i)=>this.previous.set(`${p.index}:${i}`,b.pressed));
  if(mode!=='game'||!this.allConnected)this.pending=[0,0,0];
  return{joined,readied,missing:this.assignments.flatMap((s,i)=>s&&!s.connected?[i]:[])};
 }
 consume():readonly [0|1,0|1,0|1]{const actions=this.pending;this.pending=[0,0,0];return actions;}
 /** Require release after joins, countdown, pause or replacement of players. */
 barrier(pads:readonly (ArenaPad|null)[]){this.pending=[0,0,0];this.previous.clear();for(const p of pads)if(p?.connected)p.buttons.forEach((b,i)=>this.previous.set(`${p.index}:${i}`,b.pressed));}
 reset(pads:readonly (ArenaPad|null)[]){this.assignments=[undefined,undefined,undefined];this.barrier(pads);}
}
