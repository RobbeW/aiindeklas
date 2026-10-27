import type { PopulationFrame } from '../evolution/live-frame.ts';
import { trackIdentity,type CircuitDocument } from '../tracks/document.ts';
import { drawVehicle,drawCollisionFlame,hasCollision,mountVehicleChoice } from './vehicle-art.ts';
import { drawTrack } from '../tracks/renderer.ts';

export function populationLeader(frame:PopulationFrame){
 return [...frame.agents].sort((a,b)=>b.world.progress.laps-a.world.progress.laps||b.world.progress.bestDistance-a.world.progress.bestDistance||a.id.localeCompare(b.id))[0];
}
export function mountLivePopulationView(root:HTMLElement,document:CircuitDocument){
 root.innerHTML='<h3>Live populatie</h3><p class="live-count"></p><canvas aria-label="Alle auto’s van de huidige generatie. De leider heeft een aquakleurige ring."></canvas>';
 const canvas=root.querySelector('canvas')!,count=root.querySelector('.live-count')!;
 canvas.width=document.width*100;canvas.height=document.height*100;
 canvas.style.width=`min(100%, ${70*document.width/document.height}vh, 800px)`;canvas.style.height='auto';
 const ctx=canvas.getContext('2d');if(!ctx)throw new Error('Canvas2D unavailable');
 const id=trackIdentity(document);
 let lastFrame:PopulationFrame|undefined;
 const clear=()=>{drawTrack(ctx,document);count.textContent='Start een populatie om de auto’s te volgen.';};
 const update=(frame:PopulationFrame|undefined)=>{lastFrame=frame;if(!frame){clear();return;}if(frame.trackId!==id){clear();count.textContent='Ander circuit: start hier een nieuwe populatie.';return;}
  drawTrack(ctx,document);const leader=populationLeader(frame),active=frame.agents.filter(a=>!a.done).length;
  for(const a of [...frame.agents.filter(a=>a.id!==leader?.id),...(leader?[leader]:[])]){
   const car=a.world.car;drawVehicle(ctx,car.x,car.y,car.heading,a.done ? .8 : a.id===leader?.id ? 1 : .65);
   if(a.id===leader?.id){ctx.save();ctx.beginPath();ctx.arc(car.x,car.y,19,0,Math.PI*2);ctx.strokeStyle='#160033';ctx.lineWidth=4;ctx.stroke();ctx.strokeStyle='#3DFFD0';ctx.lineWidth=2;ctx.stroke();ctx.restore();}
  }
  for(const a of frame.agents)if(hasCollision(a.result))drawCollisionFlame(ctx,a.world.car.x,a.world.car.y);
  const groups=new Map<string,typeof frame.agents[number][]>();for(const a of frame.agents){const key=`${a.world.car.x.toFixed(1)}:${a.world.car.y.toFixed(1)}`;const group=groups.get(key)??[];group.push(a);groups.set(key,group);}
  for(const group of groups.values())if(group.length>1){const car=group[0]!.world.car;ctx.save();ctx.font='bold 11px sans-serif';ctx.fillStyle='#160033';ctx.fillRect(car.x+10,car.y-23,27,16);ctx.fillStyle='#FFFFFF';ctx.fillText(`×${group.length}`,car.x+13,car.y-11);ctx.restore();}
  count.textContent=`Generatie ${frame.generation+1} · ${active}/${frame.agents.length} rijden · ${frame.agents.filter(a=>a.result?.crashed).length} gecrasht · ${(frame.round/60).toFixed(1)} s gezamenlijke simulatietijd`;
 };
 clear();const choice=mountVehicleChoice(root,()=>update(lastFrame));canvas.before(root.lastElementChild!);
 return{update,clear(){lastFrame=undefined;clear();},dispose(){choice.dispose();root.replaceChildren();}};
}
