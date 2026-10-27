import {CarEnvironment} from '../car/environment.ts';
import {restoreCarSnapshot,validateCarSnapshot,type CarSnapshot} from '../car/policy-adapter.ts';
import type {CircuitDocument} from '../tracks/document.ts';
import {pointAtDistance} from '../tracks/route.ts';
import type {RaceControl} from '../car/race-session.ts';
/** Visible reference drivers are route-following examples, never presented as learned AI. */
export class DemoCarSession {
 readonly model:CarSnapshot;private readonly policy;private readonly envs:CarEnvironment[];
 constructor(document:CircuitDocument,model:CarSnapshot){this.model=validateCarSnapshot(model);this.policy=restoreCarSnapshot(this.model);this.envs=Array.from({length:4},()=>{const env=new CarEnvironment(document,model.worldVersion);env.reset({seed:2005});return env;});}
 get route(){return this.envs[0]!.route;}
 get finished(){return this.envs.every(e=>!!e.completedResult);}
 get participants(){return this.envs.map((env,id)=>({id,world:env.world,result:env.completedResult,score:env.world.progress.bestDistance/env.route.length}));}
 step(humans:readonly boolean[],controls:readonly RaceControl[]){
  if(humans.length!==3||controls.length!==3)throw new Error('Three demo seats required');
  for(let i=0;i<4;i++){const env=this.envs[i]!;if(env.completedResult)continue;
   if(i===3){env.step(this.policy.action(env.getObservation()));continue;}
   if(humans[i]){const c=controls[i]!;env.step(c.action,c);continue;}
   const car=env.world.car,target=pointAtDistance(env.route,env.world.progress.bestDistance+25),error=Math.atan2(Math.sin(Math.atan2(target.y-car.y,target.x-car.x)-car.heading),Math.cos(Math.atan2(target.y-car.y,target.x-car.x)-car.heading));
   env.step(error>.04?2:error<-.04?1:0,{throttle:1,brake:0});
  }
 }
}
