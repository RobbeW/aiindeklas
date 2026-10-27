import type { EnvironmentStep,EpisodeResult } from '../core/contracts.ts';
import type { CircuitDocument } from '../tracks/document.ts';
import { buildRoute,advanceRoute,initialProgress,type RouteProgress } from '../tracks/route.ts';
import { CAR_CONFIG,type CarAction } from './config.ts';
import { stepCar,type CarState,type CarPedals } from './physics.ts';
import { sweptCarCollision } from './collision.ts';
import { carObservation } from './sensors.ts';
export interface CarEpisodeResult extends EpisodeResult {readonly laps:0|1;readonly crashed:boolean;readonly progressDistance:number;readonly routeLength:number;readonly progressFraction:number;readonly elapsedSimulatedSeconds:number;}
export interface CarWorld {readonly car:CarState;readonly steps:number;readonly progress:RouteProgress;}
export class CarEnvironment {
  readonly route:ReturnType<typeof buildRoute>;
  private current:CarWorld|undefined;private finished:CarEpisodeResult|undefined;private reward=0;
  constructor(document:CircuitDocument){this.route=buildRoute(document);}
  get world(){if(!this.current)throw new Error('Reset car environment first');return this.current;}
  get completedResult(){return this.finished;}
  getObservation(){return carObservation(this.route.road,this.world.car);}
  reset({seed}:{seed:number}){
    if(!Number.isSafeInteger(seed))throw new Error('Car seed must be a safe integer');
    this.current=Object.freeze({car:Object.freeze({...this.route.spawn,heading:this.route.heading,speed:0}),steps:0,progress:initialProgress()});
    this.finished=undefined;this.reward=0;return this.getObservation();
  }
  step(action:CarAction,pedals?:CarPedals):EnvironmentStep<CarEpisodeResult>{
    if(this.finished)throw new Error('Car episode terminal; reset before stepping');
    const before=this.world,car=stepCar(before.car,action,pedals),steps=before.steps+1;
    const collision=sweptCarCollision(this.route.road,before.car,car);
    const progress=collision?before.progress:advanceRoute(this.route,before.progress,before.car,car);
    let reward=collision?-1:.001+(progress.bestDistance-before.progress.bestDistance)/100+(progress.laps?5:0);
    const reason=collision?'collision':progress.laps?'lap_complete':steps>=CAR_CONFIG.horizon?'time_limit':undefined;
    this.reward+=reward;this.current=Object.freeze({car,steps,progress});
    if(reason)this.finished=Object.freeze({survivalSteps:steps,totalReward:this.reward,terminationReason:reason,laps:progress.laps,crashed:collision,
      progressDistance:progress.bestDistance,routeLength:this.route.length,progressFraction:progress.bestDistance/this.route.length,elapsedSimulatedSeconds:steps*CAR_CONFIG.dt});
    return Object.freeze({observation:this.getObservation(),reward,done:!!reason,...(reason?{reason,result:this.finished!}:{})});
  }
}
