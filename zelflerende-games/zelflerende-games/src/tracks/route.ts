import { validateCircuit,trackIdentity,neighbor,opposite,tilePorts,cellKey,type CircuitDocument,type Direction } from './document.ts';
import { createRoadGeometry,tileCenterline,directionVector,type Point,type RoadGeometry } from './geometry.ts';
import { CAR_CONFIG } from '../car/config.ts';
export interface RoutePoint extends Point {readonly distance:number;}
export interface RouteGate extends RoutePoint {readonly forward:Point;}
export interface TrackRoute {readonly document:CircuitDocument;readonly id:string;readonly road:RoadGeometry;readonly points:readonly RoutePoint[];readonly gates:readonly RouteGate[];readonly length:number;readonly spawn:Point;readonly heading:number;}
export function buildRoute(value:CircuitDocument):TrackRoute {
  const doc=validateCircuit(value),road=createRoadGeometry(doc);if(!doc.start)throw new Error('Choose start/finish on a straight');
  const map=new Map(doc.cells.map(t=>[cellKey(t.x,t.y),t]));const first=map.get(cellKey(doc.start.x,doc.start.y))!;
  const points:RoutePoint[]=[],gates:RouteGate[]=[];
  const append=(part:readonly Point[])=>{for(const p of part){const previous=points.at(-1),step=previous?Math.hypot(p.x-previous.x,p.y-previous.y):0;if(previous&&step<1e-9)continue;points.push(Object.freeze({...p,distance:(previous?.distance??0)+step}));}};
  const gate=(direction:Direction)=>{const p=points.at(-1)!;gates.push(Object.freeze({...p,forward:Object.freeze(directionVector(direction))}));};
  let exit=doc.start.direction;
  append(tileCenterline(first,opposite(exit)).slice(10));gate(exit);
  let current=neighbor(first.x,first.y,exit);const seen=new Set([cellKey(first.x,first.y)]);
  while(current.x!==first.x||current.y!==first.y){
    const key=cellKey(current.x,current.y),tile=map.get(key);if(!tile||seen.has(key))throw new Error('Route does not form one ordered loop');seen.add(key);
    const entry=opposite(exit);append(tileCenterline(tile,entry));exit=tilePorts(tile).find(p=>p!==entry)!;gate(exit);current=neighbor(tile.x,tile.y,exit);
  }
  if(seen.size!==doc.cells.length)throw new Error('Route excludes tiles');
  append(tileCenterline(first,opposite(exit)).slice(0,11));gate(doc.start.direction);
  const spawn=points[0]!,v=directionVector(doc.start.direction),heading=Math.atan2(v.y,v.x);
  for(const longitudinal of [-CAR_CONFIG.length/2,0,CAR_CONFIG.length/2])for(const lateral of [-CAR_CONFIG.width/2,0,CAR_CONFIG.width/2]){
    if(!road.contains({x:spawn.x+v.x*longitudinal-v.y*lateral,y:spawn.y+v.y*longitudinal+v.x*lateral}))throw new Error('Spawn footprint is outside road');
  }
  return Object.freeze({document:doc,id:trackIdentity(doc),road,points:Object.freeze(points),gates:Object.freeze(gates),length:points.at(-1)!.distance,spawn:Object.freeze({x:spawn.x,y:spawn.y}),heading});
}
export interface RouteProgress {readonly nextGate:number;readonly bestDistance:number;readonly laps:0|1;}
export const initialProgress=():RouteProgress=>Object.freeze({nextGate:0,bestDistance:0,laps:0});
const dot=(a:Point,b:Point)=>a.x*b.x+a.y*b.y;
export function projectRoute(route:TrackRoute,point:Point,low=0,high=route.length):number {
  let closest=Infinity,best=low;
  for(let i=1;i<route.points.length;i++){
    const a=route.points[i-1]!,b=route.points[i]!;if(b.distance<low||a.distance>high)continue;
    const dx=b.x-a.x,dy=b.y-a.y,length2=dx*dx+dy*dy;
    let t=Math.max(0,Math.min(1,((point.x-a.x)*dx+(point.y-a.y)*dy)/length2));
    t=Math.max(t,(low-a.distance)/(b.distance-a.distance));t=Math.min(t,(high-a.distance)/(b.distance-a.distance));t=Math.max(0,Math.min(1,t));
    const distance=Math.hypot(point.x-a.x-dx*t,point.y-a.y-dy*t);
    if(distance<closest){closest=distance;best=a.distance+(b.distance-a.distance)*t;}
  }
  return Math.max(low,Math.min(high,best));
}
export function advanceRoute(route:TrackRoute,state:RouteProgress,previous:Point,current:Point):RouteProgress {
  if(state.laps)return state;let nextGate=state.nextGate;const gate=route.gates[nextGate]!;
  const before={x:previous.x-gate.x,y:previous.y-gate.y},after={x:current.x-gate.x,y:current.y-gate.y};
  const a=dot(before,gate.forward),b=dot(after,gate.forward);
  if(a<0&&b>=0){const t=-a/(b-a);const cross={x:before.x+(after.x-before.x)*t,y:before.y+(after.y-before.y)*t};
    const lateral=Math.abs(cross.x*(-gate.forward.y)+cross.y*gate.forward.x);
    if(lateral<=26-CAR_CONFIG.width/2)nextGate++;
  }
  if(nextGate===route.gates.length)return Object.freeze({nextGate,bestDistance:route.length,laps:1});
  const low=nextGate?route.gates[nextGate-1]!.distance:0,high=route.gates[nextGate]!.distance;
  return Object.freeze({nextGate,bestDistance:Math.max(state.bestDistance,projectRoute(route,current,low,high)),laps:0});
}
export function pointAtDistance(route:TrackRoute,distance:number):Point {
  const d=Math.max(0,Math.min(route.length,distance));
  for(let i=1;i<route.points.length;i++){const a=route.points[i-1]!,b=route.points[i]!;if(b.distance>=d){const t=(d-a.distance)/(b.distance-a.distance);return{x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t};}}
  return route.points.at(-1)!;
}
