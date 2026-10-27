import type { CarEpisodeResult } from './environment.ts';

export const VEHICLE_CHOICES = [
  {id:'race',label:'Raceauto',file:'car.png',keyBlack:false},
  {id:'class',label:'Klasauto'},
  {id:'roomba',label:'Roomba',file:'roomba.png',keyBlack:true},
  {id:'tie',label:'TIE fighter',file:'tie_fighter.png',keyBlack:true},
  {id:'sus',label:'Among Us',file:'sus.png',keyBlack:true},
] as const;
export type VehicleChoice = typeof VEHICLE_CHOICES[number]['id'];
export const vehicleChoice = (value:unknown):VehicleChoice => VEHICLE_CHOICES.some(c=>c.id===value)?value as VehicleChoice:'race';
export const hasCollision = (result:Pick<CarEpisodeResult,'crashed'>|undefined) => result?.crashed === true;
export function keyBlackPixels(data:Uint8ClampedArray){
  for(let i=0;i<data.length;i+=4)if(data[i]===0&&data[i+1]===0&&data[i+2]===0)data[i+3]=0;
}
const storageKey='ai-in-de-klas-car-art';
let selected:VehicleChoice|undefined;
const listeners=new Set<()=>void>();
const images=new Map<VehicleChoice,CanvasImageSource>();
const loading=new Set<VehicleChoice>();
function current(){
  if(selected===undefined){try{selected=vehicleChoice(localStorage.getItem(storageKey));}catch{selected='race';}}
  return selected;
}
function notify(){for(const listener of listeners)listener();}
function load(choice:VehicleChoice){
  const entry=VEHICLE_CHOICES.find(c=>c.id===choice);
  if(!entry||!('file' in entry)||loading.has(choice))return;
  loading.add(choice);
  const image=new Image();
  image.onload=()=>{
    if(entry.keyBlack){
      const canvas=document.createElement('canvas');canvas.width=image.naturalWidth;canvas.height=image.naturalHeight;
      const ctx=canvas.getContext('2d');
      if(ctx){ctx.drawImage(image,0,0);const pixels=ctx.getImageData(0,0,canvas.width,canvas.height);
        keyBlackPixels(pixels.data);ctx.putImageData(pixels,0,0);
        let left=canvas.width,top=canvas.height,right=-1,bottom=-1;
        for(let y=0;y<canvas.height;y++)for(let x=0;x<canvas.width;x++)if(pixels.data[(y*canvas.width+x)*4+3]){left=Math.min(left,x);top=Math.min(top,y);right=Math.max(right,x);bottom=Math.max(bottom,y);}
        if(right>=left){const cropped=document.createElement('canvas');cropped.width=right-left+1;cropped.height=bottom-top+1;cropped.getContext('2d')?.drawImage(canvas,left,top,cropped.width,cropped.height,0,0,cropped.width,cropped.height);images.set(choice,cropped);}else images.set(choice,canvas);
      }
    }else images.set(choice,image);
    notify();
  };
  image.onerror=()=>notify();
  image.src=`${import.meta.env.BASE_URL}assets/car/${entry.file}`;
}
export function drawVehicle(ctx:CanvasRenderingContext2D,x:number,y:number,heading:number,alpha=1){
  const choice=current();load(choice);const image=images.get(choice);
  ctx.save();ctx.translate(x,y);ctx.rotate(heading);ctx.globalAlpha=alpha;
  ctx.beginPath();ctx.ellipse(0,0,17,13,0,0,Math.PI*2);ctx.fillStyle='rgba(255,255,255,.85)';ctx.fill();ctx.strokeStyle='#160033';ctx.lineWidth=1;ctx.stroke();
  if(image){const source=image as HTMLImageElement|HTMLCanvasElement;const width='naturalWidth' in source?source.naturalWidth:source.width;const height='naturalHeight' in source?source.naturalHeight:source.height;const scale=Math.min(30/width,24/height);ctx.drawImage(image,-width*scale/2,-height*scale/2,width*scale,height*scale);}
  else {ctx.fillStyle='#5200FF';ctx.strokeStyle='white';ctx.lineWidth=1;ctx.fillRect(-7,-4,14,8);ctx.strokeRect(-7,-4,14,8);ctx.fillStyle='#E2DDEA';ctx.fillRect(2,-3,3,6);}
  ctx.restore();
}
export function drawCollisionFlame(ctx:CanvasRenderingContext2D,x:number,y:number){
  ctx.save();ctx.translate(x,y);ctx.beginPath();ctx.moveTo(0,10);ctx.bezierCurveTo(-12,7,-10,-3,-5,-8);ctx.lineTo(-4,-2);ctx.bezierCurveTo(-1,-5,0,-10,1,-14);ctx.bezierCurveTo(4,-8,11,-4,9,4);ctx.bezierCurveTo(8,8,4,10,0,10);ctx.fillStyle='#e95300';ctx.strokeStyle='#fff';ctx.lineWidth=2;ctx.stroke();ctx.fill();ctx.beginPath();ctx.moveTo(0,7);ctx.bezierCurveTo(-5,6,-4,1,0,-4);ctx.bezierCurveTo(1,0,5,2,4,5);ctx.bezierCurveTo(3,7,1,8,0,7);ctx.fillStyle='#ffdb36';ctx.fill();ctx.restore();
}
export function mountVehicleChoice(root:HTMLElement,onChange:()=>void){
  const container=document.createElement('div');container.className='toolbar vehicle-choice';
  const label=document.createElement('label');label.textContent='Uiterlijk van de auto';
  const select=document.createElement('select');for(const choice of VEHICLE_CHOICES){const option=document.createElement('option');option.value=choice.id;option.textContent=choice.label;select.append(option);}label.append(select);
  const preview=document.createElement('canvas');preview.width=64;preview.height=44;preview.setAttribute('aria-hidden','true');preview.style.width='64px';preview.style.height='44px';
  container.append(label,preview);root.append(container);
  const refresh=()=>{select.value=current();const ctx=preview.getContext('2d');if(ctx){ctx.clearRect(0,0,64,44);drawVehicle(ctx,32,22,0);}onChange();};
  select.onchange=()=>{selected=vehicleChoice(select.value);try{localStorage.setItem(storageKey,selected);}catch{/* preference is optional */}notify();};
  listeners.add(refresh);refresh();
  return {dispose(){listeners.delete(refresh);container.remove();}};
}
