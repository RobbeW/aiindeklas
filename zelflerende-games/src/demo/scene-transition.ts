/** Serial, cancellable preparation and opacity transition. Time advances only through tick. */
export class SceneTransition {
 private generation=0; private phase:'idle'|'prepare'|'out'|'in'='idle'; private elapsed=0;
 private readonly opacity:(oldOpacity:number,newOpacity:number)=>void; private readonly reduced:boolean;
 constructor(opacity:(oldOpacity:number,newOpacity:number)=>void,reduced:boolean){this.opacity=opacity;this.reduced=reduced;}
 get active(){return this.phase!=='idle';}
 cancel(){this.generation++;this.phase='idle';this.elapsed=0;this.opacity(0,1);}
 async start(prepare:()=>Promise<void>,swap:()=>void,finish:()=>void){
  const token=++this.generation;this.phase='prepare';this.elapsed=0;this.opacity(1,0);
  try{await prepare();}catch(error){if(token!==this.generation)return;this.cancel();throw error;}
  if(token!==this.generation)return;
  this.phase='out';
  this.swap=()=>{if(token===this.generation)swap();};this.finish=()=>{if(token===this.generation)finish();};
 }
 private swap=()=>{}; private finish=()=>{};
 tick(delta:number,paused:boolean){
  if(paused||!Number.isFinite(delta)||delta<0)return;
  if(this.reduced&&this.phase==='out'){this.swap();this.phase='idle';this.opacity(0,1);this.finish();return;}
  if(delta===0)return;
  if(this.phase==='out'){this.elapsed+=delta;this.opacity(Math.max(0,1-this.elapsed/180),0);if(this.elapsed>=180){this.swap();this.elapsed=0;this.phase='in';}}
  else if(this.phase==='in'){this.elapsed+=delta;this.opacity(0,Math.min(1,this.elapsed/260));if(this.elapsed>=260){this.phase='idle';this.opacity(0,1);this.finish();}}
 }
}
