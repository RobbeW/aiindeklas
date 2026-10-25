import { validateCircuit,DIRECTIONS,tilePorts,type CircuitDocument,type Tile,type Direction } from './document.ts';
import { validateConnections } from './connectivity.ts';
export const TILE_SIZE=100,ROAD_WIDTH=52,CENTER_RADIUS=50;
export interface Point {readonly x:number;readonly y:number;}
export function rotatePoint(point:Point,turns:number):Point {
  let {x,y}=point;for(let i=0;i<(turns%4+4)%4;i++){const next=100-y;y=x;x=next;}return Object.freeze({x,y});
}
export const directionVector=(d:Direction):Point=>({x:d==='E'?1:d==='W'?-1:0,y:d==='S'?1:d==='N'?-1:0});
export const edgePoint=(d:Direction):Point=>({x:d==='E'?100:d==='W'?0:50,y:d==='S'?100:d==='N'?0:50});
export function pointOnTile(tile:Tile,point:Point):boolean {
  const local=rotatePoint({x:point.x-tile.x*100,y:point.y-tile.y*100},-tile.rotation);
  if(local.x< -1e-9||local.y< -1e-9||local.x>100+1e-9||local.y>100+1e-9)return false;
  const r=tile.kind==='straight'?Math.abs(local.x-50):Math.abs(Math.hypot(local.x-100,local.y)-50);
  return r<=ROAD_WIDTH/2+1e-9;
}
export function tileCenterline(tile:Tile,entry:Direction):readonly Point[] {
  const ports=tilePorts(tile);if(!ports.includes(entry))throw new Error('Entry is not a tile port');
  const exit=ports.find(p=>p!==entry)!;
  if(tile.kind==='straight'){
    const a=edgePoint(entry),b=edgePoint(exit);
    return Object.freeze(Array.from({length:21},(_,i)=>Object.freeze({x:tile.x*100+a.x+(b.x-a.x)*i/20,y:tile.y*100+a.y+(b.y-a.y)*i/20})));
  }
  const baseEntry=DIRECTIONS[(DIRECTIONS.indexOf(entry)-tile.rotation+4)%4]!;
  return Object.freeze(Array.from({length:21},(_,i)=>{
    const angle=baseEntry==='N'?Math.PI-i*Math.PI/40:Math.PI/2+i*Math.PI/40;
    const p=rotatePoint({x:100+50*Math.cos(angle),y:50*Math.sin(angle)},tile.rotation);
    return Object.freeze({x:tile.x*100+p.x,y:tile.y*100+p.y});
  }));
}
export interface RoadGeometry {readonly document:CircuitDocument;contains(point:Point):boolean;rayDistance(origin:Point,angle:number,maxRange?:number):number;}
export function createRoadGeometry(value:CircuitDocument,requireClosed=true):RoadGeometry {
  const document=validateCircuit(value);if(requireClosed&&!validateConnections(document).valid)throw new Error('A closed connected circuit is required');
  const map=new Map(document.cells.map(t=>[`${t.x},${t.y}`,t]));
  const contains=(p:Point)=>{
    if(!Number.isFinite(p.x)||!Number.isFinite(p.y))return false;
    const x=Math.floor(p.x/100),y=Math.floor(p.y/100);
    for(const dx of [0,-1])for(const dy of [0,-1]){const t=map.get(`${x+dx},${y+dy}`);if(t&&pointOnTile(t,p))return true;}
    return false;
  };
  const linesX=new Set<number>(),linesY=new Set<number>();const circles:{x:number;y:number;r:number}[]=[];
  for(const t of document.cells){
    linesX.add(t.x*100);linesX.add((t.x+1)*100);linesY.add(t.y*100);linesY.add((t.y+1)*100);
    if(t.kind==='straight'){const lines=t.rotation%2===0?linesX:linesY,base=(t.rotation%2===0?t.x:t.y)*100;lines.add(base+24);lines.add(base+76);}
    else {const c=rotatePoint({x:100,y:0},t.rotation);for(const r of [24,76])circles.push({x:t.x*100+c.x,y:t.y*100+c.y,r});}
  }
  function rayDistance(origin:Point,angle:number,maxRange=150):number {
    if(!Number.isFinite(angle)||!Number.isFinite(maxRange)||maxRange<=0||maxRange>10000)throw new Error('Invalid ray range/angle');
    if(!contains(origin))return 0;
    const dx=Math.cos(angle),dy=Math.sin(angle);const candidates=[0,maxRange];
    const add=(t:number)=>{if(Number.isFinite(t)&&t>0&&t<maxRange)candidates.push(t);};
    if(Math.abs(dx)>1e-12)for(const x of linesX)add((x-origin.x)/dx);
    if(Math.abs(dy)>1e-12)for(const y of linesY)add((y-origin.y)/dy);
    for(const c of circles){const x=origin.x-c.x,y=origin.y-c.y,b=2*(x*dx+y*dy),disc=b*b-4*(x*x+y*y-c.r*c.r);if(disc>=0){const s=Math.sqrt(disc);add((-b-s)/2);add((-b+s)/2);}}
    candidates.sort((a,b)=>a-b);
    for(let i=1;i<candidates.length;i++){
      const a=candidates[i-1]!,b=candidates[i]!;if(b-a<1e-9)continue;
      const middle=(a+b)/2;if(!contains({x:origin.x+dx*middle,y:origin.y+dy*middle}))return a;
    }
    return maxRange;
  }
  return Object.freeze({document,contains,rayDistance});
}
