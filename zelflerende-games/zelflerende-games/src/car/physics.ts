import { CAR_CONFIG,type CarAction } from './config.ts';
export interface CarState {readonly x:number;readonly y:number;readonly heading:number;readonly speed:number;}
export function stepCar(state:CarState,action:CarAction):CarState {
  if(![0,1,2].includes(action)||[state.x,state.y,state.heading,state.speed].some(n=>!Number.isFinite(n))||state.speed<0||state.speed>CAR_CONFIG.maxSpeed)throw new Error('Invalid car state/action');
  const speed=Math.min(CAR_CONFIG.maxSpeed,state.speed+CAR_CONFIG.acceleration*CAR_CONFIG.dt);
  const heading=state.heading+(action===1?-1:action===2?1:0)*CAR_CONFIG.yawRate*CAR_CONFIG.dt;
  return Object.freeze({x:state.x+Math.cos(heading)*speed*CAR_CONFIG.dt,y:state.y+Math.sin(heading)*speed*CAR_CONFIG.dt,heading:Math.atan2(Math.sin(heading),Math.cos(heading)),speed});
}
