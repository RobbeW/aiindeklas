import { stableIdentity } from '../core/identity.ts';
export const TRACK_VERSION='tile-circuit-v1' as const;
export const DIRECTIONS=['N','E','S','W'] as const;
export type Direction=typeof DIRECTIONS[number];
export interface Tile {readonly x:number;readonly y:number;readonly kind:'straight'|'turn';readonly rotation:0|1|2|3;}
export interface TrackStart {readonly x:number;readonly y:number;readonly direction:Direction;}
export interface CircuitDocument {readonly version:typeof TRACK_VERSION;readonly width:number;readonly height:number;readonly cells:readonly Tile[];readonly start?:TrackStart;}
export const cellKey=(x:number,y:number)=>`${x},${y}`;
export const opposite=(d:Direction):Direction=>DIRECTIONS[(DIRECTIONS.indexOf(d)+2)%4]!;
export const neighbor=(x:number,y:number,d:Direction)=>({x:x+(d==='E'?1:d==='W'?-1:0),y:y+(d==='S'?1:d==='N'?-1:0)});
export function tilePorts(tile:Tile):readonly Direction[] {
  const base=tile.kind==='straight'?[0,2]:[0,1];
  return Object.freeze(base.map(n=>DIRECTIONS[(n+tile.rotation)%4]!));
}
export function validateCircuit(value:unknown):CircuitDocument {
  if(!value||typeof value!=='object')throw new Error('Circuit document required');
  const d=value as CircuitDocument;
  if(d.version!==TRACK_VERSION)throw new Error('Unsupported circuit version');
  if(!Number.isInteger(d.width)||!Number.isInteger(d.height)||d.width<3||d.height<3||d.width>32||d.height>32)throw new Error('Grid dimensions must be 3..32');
  if(!Array.isArray(d.cells)||d.cells.length>d.width*d.height)throw new Error('Invalid circuit cells');
  const seen=new Set<string>();const cells:Tile[]=[];
  for(const c of d.cells){
    if(!c||!Number.isInteger(c.x)||!Number.isInteger(c.y)||c.x<0||c.y<0||c.x>=d.width||c.y>=d.height||
      !['straight','turn'].includes(c.kind)||![0,1,2,3].includes(c.rotation))throw new Error('Invalid tile coordinate/shape/rotation');
    const key=cellKey(c.x,c.y);if(seen.has(key))throw new Error(`Duplicate occupied cell ${key}`);seen.add(key);
    cells.push(Object.freeze({x:c.x,y:c.y,kind:c.kind,rotation:c.rotation}));
  }
  cells.sort((a,b)=>a.y-b.y||a.x-b.x);
  let start:TrackStart|undefined;
  if(d.start){
    const t=cells.find(c=>c.x===d.start?.x&&c.y===d.start?.y);
    if(!t||t.kind!=='straight'||!DIRECTIONS.includes(d.start.direction)||!tilePorts(t).includes(d.start.direction))throw new Error('Start must point along a placed straight');
    start=Object.freeze({x:t.x,y:t.y,direction:d.start.direction});
  }
  return Object.freeze({version:TRACK_VERSION,width:d.width,height:d.height,cells:Object.freeze(cells),...(start?{start}:{})});
}
export const trackIdentity=(track:CircuitDocument)=>stableIdentity(validateCircuit(track));
