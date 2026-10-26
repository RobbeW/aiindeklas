import { ROAD_WIDTH,rotatePoint,type RoadGeometry } from './geometry.ts';
import type { CircuitDocument,Tile } from './document.ts';
export const tileSvgPath=(kind:Tile['kind'])=>kind==='straight'?'M50 0 V100':'M50 0 A50 50 0 0 0 100 50';
const startRotation=(direction:'N'|'E'|'S'|'W')=>({N:0,E:1,S:2,W:3}[direction]);
const checkerRects=(x:number,y:number)=>Array.from({length:16},(_,i)=>{
  const col=i%8,row=Math.floor(i/8);
  return `<rect x="${x+col*6}" y="${y+row*6}" width="6" height="6" fill="${(col+row)%2===0?'#171717':'#FFFDF5'}"/>`;
}).join('');
export function startFinishSvg(direction:'N'|'E'|'S'|'W') {
  return `<g transform="rotate(${startRotation(direction)*90} 50 50)" aria-hidden="true">${checkerRects(26,44)}<path d="M50 27 43 39h14z" fill="#5200FF"/></g>`;
}
export function drawTrack(context:CanvasRenderingContext2D,document:CircuitDocument) {
  const {width,height}=context.canvas;context.clearRect(0,0,width,height);context.fillStyle='#F8F7F3';context.fillRect(0,0,width,height);
  const scale=Math.min(width/(document.width*100),height/(document.height*100));context.save();context.scale(scale,scale);
  context.strokeStyle='#E2DDEA';context.lineWidth=1;
  for(let x=0;x<=document.width;x++){context.beginPath();context.moveTo(x*100,0);context.lineTo(x*100,document.height*100);context.stroke();}
  for(let y=0;y<=document.height;y++){context.beginPath();context.moveTo(0,y*100);context.lineTo(document.width*100,y*100);context.stroke();}
  for(const t of document.cells){context.save();context.translate(t.x*100+50,t.y*100+50);context.rotate(t.rotation*Math.PI/2);context.translate(-50,-50);
    for(const width of [ROAD_WIDTH,2]){context.beginPath();context.lineWidth=width;context.strokeStyle=width===2?'#3DFFD0':'#625B70';context.setLineDash(width===2?[7,7]:[]);
      if(t.kind==='straight'){context.moveTo(50,0);context.lineTo(50,100);}else context.arc(100,0,50,Math.PI,Math.PI/2,true);context.stroke();}
    context.restore();
  }
  if(document.start){const s=document.start;context.save();context.translate(s.x*100+50,s.y*100+50);context.rotate(startRotation(s.direction)*Math.PI/2);
    for(let row=0;row<2;row++)for(let col=0;col<8;col++){context.fillStyle=(row+col)%2===0?'#171717':'#FFFDF5';context.fillRect(-24+col*6,-6+row*6,6,6);}
    context.fillStyle='#5200FF';context.beginPath();context.moveTo(0,-24);context.lineTo(-7,-12);context.lineTo(7,-12);context.closePath();context.fill();context.restore();}
  context.restore();
}
export const curveCorner=(tile:Tile)=>{const p=rotatePoint({x:100,y:0},tile.rotation);return{x:tile.x*100+p.x,y:tile.y*100+p.y};};
export const renderRoad=(canvas:HTMLCanvasElement,road:RoadGeometry)=>drawTrack(canvas.getContext('2d')!,road.document);
