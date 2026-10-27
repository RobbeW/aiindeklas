import { drawTrack } from '../tracks/renderer.ts';import type { TrackRoute } from '../tracks/route.ts';import type { CarWorld } from './environment.ts';
import { drawVehicle,drawCollisionFlame,hasCollision } from './vehicle-art.ts';import type { CarEpisodeResult } from './environment.ts';
import { CAR_CONFIG } from './config.ts';import { carSensors } from './sensors.ts';
export function createCarRenderer(canvas:HTMLCanvasElement,route:TrackRoute){
  canvas.width=route.document.width*100;canvas.height=route.document.height*100;const ctx=canvas.getContext('2d');if(!ctx)throw new Error('Canvas2D is unavailable');
  return{render(world:CarWorld,sensors=true,result?:CarEpisodeResult){drawTrack(ctx,route.document);const car=world.car;
    if(sensors){const distances=carSensors(route.road,car);ctx.lineWidth=1.5;ctx.strokeStyle='#3DFFD0';distances.forEach((d,i)=>{const a=car.heading+CAR_CONFIG.rayAngles[i]!*Math.PI/180;ctx.beginPath();ctx.moveTo(car.x,car.y);ctx.lineTo(car.x+Math.cos(a)*d,car.y+Math.sin(a)*d);ctx.stroke();});}
    drawVehicle(ctx,car.x,car.y,car.heading);if(hasCollision(result))drawCollisionFlame(ctx,car.x,car.y);},dispose(){ctx.clearRect(0,0,canvas.width,canvas.height);}};
}
