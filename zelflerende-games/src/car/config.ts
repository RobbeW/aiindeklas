export type CarWorldVersion='car-world-v1'|'car-world-v2';
const shared={observationVersion:'car-observation-v1',dt:1/60,length:14,width:8,horizon:1800,rayRange:150,rayAngles:Object.freeze([-60,-30,0,30,60])} as const;
const legacy=Object.freeze({...shared,version:'car-world-v1',acceleration:20,maxSpeed:55,yawRate:1.2} as const);
export const CAR_CONFIG=Object.freeze({...shared,version:'car-world-v2',acceleration:60,maxSpeed:90,yawRate:2} as const);
export type CarConfig=typeof legacy|typeof CAR_CONFIG;
export function getCarConfig(version:CarWorldVersion=CAR_CONFIG.version):CarConfig {
  if(version==='car-world-v1')return legacy;
  if(version==='car-world-v2')return CAR_CONFIG;
  throw new Error('Unknown car world version');
}
export type CarAction=0|1|2;
