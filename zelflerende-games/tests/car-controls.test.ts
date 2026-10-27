import test from 'node:test';
import assert from 'node:assert/strict';
import { CAR_CONFIG } from '../src/car/config.ts';
import { stepCar } from '../src/car/physics.ts';
import { readCarGamepad } from '../src/input/car-gamepad.ts';
import { createCarInput } from '../src/input/car-input.ts';

test('automatic throttle follows the current profile; manual pedals coast, accelerate and stop without reversing',()=>{
  const initial={x:10,y:20,heading:.3,speed:12};
  for(const action of [0,1,2] as const){
    const speed=Math.min(CAR_CONFIG.maxSpeed,initial.speed+CAR_CONFIG.acceleration*CAR_CONFIG.dt);
    const heading=initial.heading+(action===1?-1:action===2?1:0)*CAR_CONFIG.yawRate*CAR_CONFIG.dt;
    assert.deepEqual(stepCar(initial,action),{x:initial.x+Math.cos(heading)*speed*CAR_CONFIG.dt,y:initial.y+Math.sin(heading)*speed*CAR_CONFIG.dt,heading:Math.atan2(Math.sin(heading),Math.cos(heading)),speed});
  }
  assert.equal(stepCar(initial,0,{throttle:0,brake:0}).speed,12);
  assert.ok(stepCar(initial,0,{throttle:1,brake:0}).speed>12);
  let car=initial;for(let i=0;i<120;i++)car=stepCar(car,0,{throttle:0,brake:1});
  assert.equal(car.speed,0);assert.throws(()=>stepCar(initial,0,{throttle:2,brake:0}),/pedals/);
});

test('indexed controllers use stick, D-pad and analog triggers and disconnect neutrally',()=>{
  const buttons=Array.from({length:16},()=>({pressed:false,value:0}));
  buttons[7]={pressed:true,value:.65};buttons[6]={pressed:true,value:.3};
  const pads=[{connected:true,axes:[-.9],buttons},null,{connected:true,axes:[.8],buttons}];
  assert.deepEqual(readCarGamepad(0,()=>pads),{action:1,throttle:.65,brake:.3});
  assert.deepEqual(readCarGamepad(2,()=>pads),{action:2,throttle:.65,brake:.3});
  buttons[14]={pressed:true,value:1};assert.equal(readCarGamepad(2,()=>pads).action,1);
  assert.deepEqual(readCarGamepad(1,()=>pads),{action:0,throttle:0,brake:0});
  assert.deepEqual(readCarGamepad(0,()=>{throw Error();}),{action:0,throttle:0,brake:0});
});

test('keyboard controls respect focus and clear on blur, hiding and disposal',()=>{
  const win=new EventTarget(),doc=Object.assign(new EventTarget(),{defaultView:win,body:{} as Element,activeElement:null as Element|null,hidden:false});
  const canvas=Object.assign(new EventTarget(),{ownerDocument:doc}) as unknown as HTMLCanvasElement;doc.activeElement=doc.body;
  const input=createCarInput({canvas,getPads:()=>[]});
  const key=(type:string,k:string)=>{const e=new Event(type,{cancelable:true});Object.defineProperty(e,'key',{value:k});win.dispatchEvent(e);return e;};
  key('keydown','w');key('keydown','ArrowLeft');assert.deepEqual(input.getControl(),{action:1,throttle:1,brake:0});
  key('keyup','w');key('keydown','s');assert.deepEqual(input.getControl(),{action:1,throttle:0,brake:1});
  win.dispatchEvent(new Event('blur'));assert.deepEqual(input.getControl(),{action:0,throttle:0,brake:0});
  doc.activeElement={} as Element;assert.equal(key('keydown','w').defaultPrevented,false);assert.equal(input.getControl().throttle,0);
  doc.activeElement=canvas;key('keydown','ArrowUp');doc.hidden=true;doc.dispatchEvent(new Event('visibilitychange'));assert.equal(input.getControl().throttle,0);
  key('keydown','d');input.dispose();key('keydown','w');assert.deepEqual(input.getControl(),{action:0,throttle:0,brake:0});
});
