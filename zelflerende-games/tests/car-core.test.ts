import test from 'node:test';import assert from 'node:assert/strict';
import { buildRoute,advanceRoute,initialProgress } from '../src/tracks/route.ts';
import { teachingLoop,fixtureCircuit } from './fixtures/circuits.ts';
import { stepCar } from '../src/car/physics.ts';
import { carCollides,sweptCarCollision } from '../src/car/collision.ts';
import { carObservation } from '../src/car/sensors.ts';
test('all supplied routes validate ordered start/spawn in both directions',()=>{
  for(const name of ['teaching-loop','long-loop','unseen-bends']){
    const doc=fixtureCircuit(name);
    for(const direction of ['E','W'] as const){const route=buildRoute({...doc,start:{...doc.start!,direction}});assert.ok(route.length>0);assert.equal(route.gates.length,doc.cells.length+1);
      assert.equal(carCollides(route.road,{...route.spawn,heading:route.heading,speed:0}),false);
    }
  }
});
test('ordered forward gates complete one lap; reverse finish and skipped route do not',()=>{
  const r=buildRoute(teachingLoop());let state=initialProgress();
  const finish=r.gates.at(-1)!;
  const before={x:finish.x-finish.forward.x,y:finish.y-finish.forward.y},after={x:finish.x+finish.forward.x,y:finish.y+finish.forward.y};
  assert.equal(advanceRoute(r,state,before,after).laps,0);
  for(const gate of r.gates){const a={x:gate.x-gate.forward.x,y:gate.y-gate.forward.y},b={x:gate.x+gate.forward.x,y:gate.y+gate.forward.y};
    if(gate===finish){assert.equal(advanceRoute(r,state,b,a).laps,0);}
    state=advanceRoute(r,state,a,b);
  }
  assert.equal(state.laps,1);assert.equal(state.bestDistance,r.length);
  const same=advanceRoute(r,initialProgress(),r.spawn,r.spawn);assert.equal(advanceRoute(r,same,r.spawn,r.spawn).bestDistance,same.bestDistance);
});
test('fixed-step car motion, speed/yaw limits and render scheduling are controller independent',()=>{
  const initial={x:0,y:0,heading:0,speed:0};let car=initial;
  for(let i=0;i<300;i++)car=stepCar(car,0);
  assert.equal(car.speed,55);assert.equal(car.heading,0);
  const traces=[30,60,120].map(rate=>{let s=initial,acc=0,steps=0;for(let frame=0;frame<rate*2;frame++){acc+=60/rate;while(acc>=1){s=stepCar(s,steps<60?0:2);steps++;acc--;}}return s;});
  assert.deepEqual(traces[0],traces[1]);assert.deepEqual(traces[1],traces[2]);
  assert.throws(()=>stepCar(initial,3 as 0),/action/);
});
test('normalized six sensors and high-speed swept collision use analytic road geometry',()=>{
  const r=buildRoute(teachingLoop()),car={...r.spawn,heading:r.heading,speed:55};const obs=carObservation(r.road,car);
  assert.equal(obs.length,6);assert.equal(obs[5],1);assert.ok(obs.every(v=>v>=0&&v<=1));
  assert.equal(carCollides(r.road,car),false);
  const near={x:150,y:71.8,heading:Math.PI/2,speed:55};const next=stepCar(near,0);
  assert.equal(sweptCarCollision(r.road,near,next),true);
});
