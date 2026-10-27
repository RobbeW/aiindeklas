import { getCarConfig,type CarWorldVersion,type CarAction } from './config.ts';
export interface CarState {readonly x:number;readonly y:number;readonly heading:number;readonly speed:number;}
export interface CarPedals {readonly throttle:number;readonly brake:number;}
export interface CarControl extends CarPedals {readonly action:CarAction;}
export function stepCar(state:CarState,action:CarAction,pedals?:CarPedals,worldVersion?:CarWorldVersion):CarState {
  const config=getCarConfig(worldVersion);
  if(![0,1,2].includes(action)||[state.x,state.y,state.heading,state.speed].some(n=>!Number.isFinite(n))||state.speed<0||state.speed>config.maxSpeed)throw new Error('Invalid car state/action');
  if(pedals&&[pedals.throttle,pedals.brake].some(n=>!Number.isFinite(n)||n<0||n>1))throw new Error('Invalid car pedals');
  const speed=pedals
    ?Math.max(0,Math.min(config.maxSpeed,state.speed+(pedals.throttle*config.acceleration-pedals.brake*config.acceleration*2)*config.dt))
    :Math.min(config.maxSpeed,state.speed+config.acceleration*config.dt);
  const heading=state.heading+(action===1?-1:action===2?1:0)*config.yawRate*config.dt;
  return Object.freeze({x:state.x+Math.cos(heading)*speed*config.dt,y:state.y+Math.sin(heading)*speed*config.dt,heading:Math.atan2(Math.sin(heading),Math.cos(heading)),speed});
}
