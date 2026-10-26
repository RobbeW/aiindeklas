import test from 'node:test';import assert from 'node:assert/strict';import { mapGamepadAxis,readGamepad } from '../src/input/gamepad.ts';
test('controller deadzone, disconnect and unavailable providers preserve keyboard fallback',()=>{
  assert.equal(mapGamepadAxis(-.8),1);assert.equal(mapGamepadAxis(.8),2);assert.equal(mapGamepadAxis(.1),0);
  let connected=true;const provider=()=>connected?[{connected:true,axes:[-.9]}]:[];
  assert.deepEqual(readGamepad(provider),{status:'connected',action:1});connected=false;assert.deepEqual(readGamepad(provider),{status:'disconnected',action:0});
  assert.deepEqual(readGamepad(()=>{throw new Error('blocked');}),{status:'unsupported',action:0});
  assert.throws(()=>mapGamepadAxis(NaN),/axis/);
});
