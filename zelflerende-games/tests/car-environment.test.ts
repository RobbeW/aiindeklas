import test from 'node:test';import assert from 'node:assert/strict';
import { CarEnvironment } from '../src/car/environment.ts';import { teachingLoop } from './fixtures/circuits.ts';
import { pointAtDistance } from '../src/tracks/route.ts';
test('route-following reference completes a real lap and immutable result is preserved across resets',()=>{
  const env=new CarEnvironment(teachingLoop());env.reset({seed:1000});let summed=0;
  for(let i=0;i<1800;i++){
    const target=pointAtDistance(env.route,env.world.progress.bestDistance+25),car=env.world.car;
    const error=Math.atan2(Math.sin(Math.atan2(target.y-car.y,target.x-car.x)-car.heading),Math.cos(Math.atan2(target.y-car.y,target.x-car.x)-car.heading));
    const t=env.step(error>.04?2:error<-.04?1:0);summed+=t.reward;if(t.done)break;
  }
  const saved=env.completedResult!;assert.ok(saved);assert.equal(saved.laps,1);assert.equal(saved.terminationReason,'lap_complete');assert.ok(Object.isFrozen(saved));
  assert.ok(Math.abs(saved.totalReward-summed)<1e-9);assert.equal(saved.progressFraction,1);assert.throws(()=>env.step(0),/terminal/);
  env.reset({seed:1001});assert.equal(env.completedResult,undefined);assert.equal(saved.laps,1);
});
test('straight-only driving collides; reward never re-adds cumulative distance each frame',()=>{
  const env=new CarEnvironment(teachingLoop());env.reset({seed:1000});let positive=0;
  for(let i=0;i<1800;i++){const t=env.step(0);if(t.reward>0)positive+=t.reward-.001;if(t.done){assert.equal(t.reward,-1);break;}}
  assert.equal(env.completedResult?.crashed,true);assert.equal(env.completedResult?.laps,0);
  assert.ok(positive<=env.route.length/100+1e-9);
});
