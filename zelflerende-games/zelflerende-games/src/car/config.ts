export const CAR_CONFIG=Object.freeze({version:'car-world-v1',observationVersion:'car-observation-v1',
  dt:1/60,length:14,width:8,acceleration:20,maxSpeed:55,yawRate:1.2,horizon:1800,rayRange:150,
  rayAngles:Object.freeze([-60,-30,0,30,60])} as const);
export type CarAction=0|1|2;
