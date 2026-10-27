import test from 'node:test';import assert from 'node:assert/strict';
import {CarRaceSession,type RaceControl} from '../src/car/race-session.ts';
import {CarRaceInput,type RacePad} from '../src/input/car-race-input.ts';
import {CarPolicy,createCarSnapshot} from '../src/car/policy-adapter.ts';
import {teachingLoop} from './fixtures/circuits.ts';
const model=createCarSnapshot(new CarPolicy(29),'evolution',{generations:10});
const still:RaceControl={action:0,throttle:0,brake:0},go:RaceControl={action:0,throttle:1,brake:0};
test('shared race starts from the identical circuit, clock and position, with a frozen trained model',()=>{
 const race=new CarRaceSession(teachingLoop(),model,3);assert.equal(race.phase,'ready');assert.equal(race.racers.length,4);
 for(const r of race.racers)assert.deepEqual(r.world,race.racers[0]!.world);
 race.step([go,go,go]);assert.equal(race.elapsedSteps,0);race.start();race.step([go,still,{...go,action:1}]);
 assert.equal(race.racers[0]!.world.car.speed>0,true);assert.equal(race.racers[1]!.world.car.speed,0);assert.notEqual(race.racers[0]!.world.car.heading,race.racers[2]!.world.car.heading);
 race.pause();const before=race.racers;race.step([go,go,go]);assert.deepEqual(race.racers,before);race.start();race.step([go,go,go]);assert.equal(race.elapsedSteps,2);
 assert.deepEqual(race.model.parameters,model.parameters);assert.notEqual(race.model.parameters,model.parameters);
 assert.throws(()=>new CarRaceSession(teachingLoop(),createCarSnapshot(new CarPolicy(1),'initial'),1),/Train/);
});
test('human actions cannot change the AI, completed cars stop and ties keep equal ranks',()=>{
 const a=new CarRaceSession(teachingLoop(),model,3),b=new CarRaceSession(teachingLoop(),model,1);a.start();b.start();
 for(let i=0;i<1800;i++){a.step([still,still,go]);b.step([{...go,action:i%2?1:2}]);}
 assert.equal(a.phase,'finished');assert.equal(b.phase,'finished');assert.deepEqual(a.racers[3]!.world,b.racers[1]!.world);assert.deepEqual(a.racers[3]!.result,b.racers[1]!.result);
 assert.equal(a.standings.find(r=>r.id===0)!.rank,a.standings.find(r=>r.id===1)!.rank);
 const before=a.racers;a.step([go,go,go]);assert.deepEqual(a.racers,before);assert.deepEqual(a.model.parameters,model.parameters);
});
const pad=(index:number,pressed=false,id=`pad-${index}`):RacePad=>({index,id,connected:true,mapping:'standard',axes:[.8],buttons:Array.from({length:16},(_,i)=>({pressed:i===0&&pressed,value:i===7?.7:0}))});
test('race keyboard seats are unique and controller A joins only one seat per device',()=>{
 const input=new CarRaceInput(3);assert.equal(input.setKeyboard(1,'arrows'),false);assert.equal(input.setKeyboard(1,'wasd'),true);
 const pads=[pad(0,true)];input.poll(pads,true);assert.equal(input.ready(pads),true);assert.deepEqual(input.bindings[2],{kind:'pad',index:0,id:'pad-0'});
 input.poll(pads,true);assert.equal(input.bindings.filter(b=>b?.kind==='pad').length,1);
 const controls=input.controls(new Set(['arrowup','arrowleft','s','d']),pads);assert.deepEqual(controls[0],{action:1,throttle:1,brake:0});assert.deepEqual(controls[1],{action:2,throttle:0,brake:1});assert.deepEqual(controls[2],{action:2,throttle:.7,brake:0});
 assert.equal(input.ready([]),false);assert.deepEqual(input.controls(new Set(),[])[2],still);
 input.poll([],false);input.poll([pad(0,true,'replacement')],true);assert.equal(input.ready([pad(0,false,'replacement')]),true);
});
test('held join buttons are not recycled and a disconnected controller never drives another seat',()=>{
 const input=new CarRaceInput(1);input.setKeyboard(0,undefined);const p=pad(0,true);input.poll([p],true);assert.equal(input.ready([p]),true);
 input.setKeyboard(0,undefined);input.poll([p],true);assert.equal(input.bindings[0],undefined);input.poll([pad(0,false)],true);input.poll([p],true);assert.equal(input.ready([p]),true);
 assert.equal(input.ready([pad(0,false,'other-device')]),false);assert.deepEqual(input.controls(new Set(),[pad(0,false,'other-device')]),[still]);
 const before=[...input.bindings];input.poll([null,pad(1,true)],false);assert.deepEqual(input.bindings,before);
});
