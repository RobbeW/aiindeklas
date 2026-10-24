import { CAR_CONFIG } from './config.ts';import type { CarState } from './physics.ts';import { rotatePoint,type RoadGeometry,type Point } from '../tracks/geometry.ts';
export function carFootprint(car:CarState):readonly Point[] {
  const c=Math.cos(car.heading),s=Math.sin(car.heading);const points:Point[]=[];
  for(const a of [-CAR_CONFIG.length/2,0,CAR_CONFIG.length/2])for(const b of [-CAR_CONFIG.width/2,0,CAR_CONFIG.width/2])points.push(Object.freeze({x:car.x+c*a-s*b,y:car.y+s*a+c*b}));
  return Object.freeze(points);
}
export function carCollides(road:RoadGeometry,car:CarState):boolean {
  const footprint=carFootprint(car);if(footprint.some(p=>!road.contains(p)))return true;
  const corners=[footprint[0]!,footprint[2]!,footprint[8]!,footprint[6]!];
  const x=Math.floor(car.x/100),y=Math.floor(car.y/100);
  if(corners.every(p=>Math.floor(p.x/100)===x&&Math.floor(p.y/100)===y)){
    const tile=road.document.cells.find(t=>t.x===x&&t.y===y)!;
    if(tile.kind==='straight')return false;
    const corner=rotatePoint({x:100,y:0},tile.rotation),dx=x*100+corner.x-car.x,dy=y*100+corner.y-car.y;
    const c=Math.cos(car.heading),s=Math.sin(car.heading),a=dx*c+dy*s,b=-dx*s+dy*c;
    const nearest=Math.hypot(a-Math.max(-7,Math.min(7,a)),b-Math.max(-4,Math.min(4,b)));
    return nearest<24-1e-9;
  }
  // Across seams, use analytic ray exits along every rectangle edge, avoiding corner-only misses.
  for(let i=0;i<4;i++){const a=corners[i]!,b=corners[(i+1)%4]!,length=Math.hypot(b.x-a.x,b.y-a.y);
    if(road.rayDistance(a,Math.atan2(b.y-a.y,b.x-a.x),length)<length-1e-8)return true;}
  return false;
}
/** Two swept substeps also cover the bounded heading/movement between fixed steps. */
export function sweptCarCollision(road:RoadGeometry,before:CarState,after:CarState):boolean {
  const turn=Math.atan2(Math.sin(after.heading-before.heading),Math.cos(after.heading-before.heading));
  for(const t of [.5,1])if(carCollides(road,{x:before.x+(after.x-before.x)*t,y:before.y+(after.y-before.y)*t,heading:before.heading+turn*t,speed:after.speed}))return true;
  return false;
}
