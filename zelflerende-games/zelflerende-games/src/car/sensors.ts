import { CAR_CONFIG } from './config.ts';import type { CarState } from './physics.ts';import type { RoadGeometry } from '../tracks/geometry.ts';
export const carSensors=(road:RoadGeometry,car:CarState):readonly number[]=>Object.freeze(CAR_CONFIG.rayAngles.map(a=>road.rayDistance(car,car.heading+a*Math.PI/180,CAR_CONFIG.rayRange)));
export function carObservation(road:RoadGeometry,car:CarState):readonly number[] {
  const obs=[...carSensors(road,car).map(d=>Math.max(0,Math.min(1,d/CAR_CONFIG.rayRange))),car.speed/CAR_CONFIG.maxSpeed];
  if(obs.some(v=>!Number.isFinite(v)||v<0||v>1))throw new Error('Invalid normalized car observation');return Object.freeze(obs);
}
