import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { VEHICLE_CHOICES,hasCollision,keyBlackPixels,vehicleChoice } from '../src/car/vehicle-art.ts';

test('vehicle choice defaults safely and retains every requested artwork',()=>{
  assert.equal(vehicleChoice(null),'race');
  assert.equal(vehicleChoice('unexpected'),'race');
  assert.deepEqual(VEHICLE_CHOICES.map(c=>vehicleChoice(c.id)),['race','class','roomba','tie','sus']);
});
test('only a collision result requests a flame',()=>{
  assert.equal(hasCollision(undefined),false);
  assert.equal(hasCollision({crashed:false}),false);
  assert.equal(hasCollision({crashed:true}),true);
});
test('legacy black key preserves coloured and transparent pixels',()=>{
  const pixels=new Uint8ClampedArray([0,0,0,255, 1,0,0,255, 255,0,1,0]);
  keyBlackPixels(pixels);
  assert.deepEqual([...pixels],[0,0,0,0, 1,0,0,255, 255,0,1,0]);
});

test('native fallback draws at the exact world position and heading',async()=>{
  const {drawVehicle}=await import('../src/car/vehicle-art.ts');
  Object.defineProperty(globalThis,'localStorage',{value:{getItem:()=> 'class'},configurable:true});
  const calls:unknown[][]=[];
  const context={save(){},restore(){},translate(...args:number[]){calls.push(['translate',...args]);},rotate(angle:number){calls.push(['rotate',angle]);},beginPath(){},ellipse(){},fill(){},stroke(){},fillRect(...args:number[]){calls.push(['fillRect',...args]);},strokeRect(){}} as unknown as CanvasRenderingContext2D;
  drawVehicle(context,120,240,Math.PI/2);
  assert.deepEqual(calls[0],['translate',120,240]);
  assert.deepEqual(calls[1],['rotate',Math.PI/2]);
  assert.ok(calls.some(c=>c[0]==='fillRect'&&c[1]===-7&&c[2]===-4&&c[3]===14&&c[4]===8));
  delete (globalThis as {localStorage?:unknown}).localStorage;
});
