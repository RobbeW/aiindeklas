import test from 'node:test';import assert from 'node:assert/strict';
import {DemoInputs,advanceDemoInputs} from '../src/demo/inputs.ts';import type {RacePad} from '../src/input/car-race-input.ts';
import {DemoCarSession} from '../src/demo/car-session.ts';import {CarPolicy,createCarSnapshot} from '../src/car/policy-adapter.ts';import {teachingLoop} from './fixtures/circuits.ts';
const pad=(index:number,a:boolean,id=`pad-${index}`):RacePad=>({index,id,mapping:'standard',connected:true,axes:[0],buttons:Array.from({length:16},(_,i)=>({pressed:i===0&&a,value:i===7?1:0}))});
test('visitors join independently; join/held A never becomes a flap and disconnect leaves only that seat',()=>{
 const input=new DemoInputs();assert.deepEqual(input.poll([pad(0,true)]).joined,[0]);assert.deepEqual(input.consume(),[0,0,0]);input.poll([pad(0,true)]);assert.deepEqual(input.consume(),[0,0,0]);input.poll([pad(0,false)]);input.poll([pad(0,true)]);assert.deepEqual(input.consume(),[1,0,0]);
 input.poll([pad(0,false),pad(1,true)]);assert.deepEqual(input.humans,[true,true,false]);assert.deepEqual(input.poll([null,pad(1,false)]).left,[0]);assert.deepEqual(input.humans,[false,true,false]);input.poll([pad(0,true,'replacement'),pad(1,false)]);assert.deepEqual(input.humans,[true,true,false]);
 input.barrier([pad(0,true,'replacement')]);input.poll([pad(0,true,'replacement')]);assert.deepEqual(input.consume(),[0,0,0]);
});
test('explicit keyboard trial and indexed car controls remain isolated',()=>{const input=new DemoInputs();input.keyboard();input.tapKey('j');assert.deepEqual(input.consume(),[0,1,0]);const c=input.carControls(new Set(['arrowup','a','s','l','i']),[]);assert.deepEqual(c,[{action:0,throttle:1,brake:0},{action:1,throttle:0,brake:1},{action:2,throttle:1,brake:0}]);});
test('car demo freezes supplied model and reference drivers cannot change AI trajectory',()=>{const model=createCarSnapshot(new CarPolicy(23),'initial'),a=new DemoCarSession(teachingLoop(),model),b=new DemoCarSession(teachingLoop(),model);for(let i=0;i<400;i++){a.step([false,false,false],Array(3).fill({action:0,throttle:0,brake:0}));b.step([true,true,true],Array(3).fill({action:2,throttle:1,brake:0}));}assert.deepEqual(a.participants[3],b.participants[3]);assert.deepEqual(a.model,model);assert.ok(a.participants[0]!.score>0);});

test('144Hz frames retain taps until an actual60Hz simulation step; barriers clear countdown taps',()=>{
 const inputs=new DemoInputs();inputs.keyboard();inputs.tapKey('f');const actions:unknown[]=[];let accumulator=0;
 for(let i=0;i<2;i++){const tick=advanceDemoInputs(inputs,1000/144,accumulator,a=>actions.push([...a]));accumulator=tick.accumulatorMs;}
 assert.equal(actions.length,0);let tick=advanceDemoInputs(inputs,1000/144,accumulator,a=>actions.push([...a]));accumulator=tick.accumulatorMs;assert.deepEqual(actions,[[1,0,0]]);
 advanceDemoInputs(inputs,50,accumulator,a=>actions.push([...a]));assert.ok(actions.slice(1).every(a=>JSON.stringify(a)==='[0,0,0]'));
 inputs.tapKey('j');inputs.barrier([]);assert.deepEqual(inputs.consume(),[0,0,0]);
});
