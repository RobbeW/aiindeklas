import assert from 'node:assert/strict';
import test from 'node:test';
import {createFlappyPadEdges, type FlappyPadProvider} from '../src/input/flappy-gamepad.ts';

function pad(held: boolean, mapping: GamepadMappingType = 'standard') {
  return {connected: true, mapping, buttons: Array.from({length: 10}, (_, i) => ({pressed: i === 0 || i === 9 ? held : false, touched: false, value: held ? 1 : 0}))};
}

test('standard controller emits one edge per press and suppresses held reconnects and resets', () => {
  let pads: ReturnType<typeof pad>[] = [pad(false)];
  const edges = createFlappyPadEdges(0, () => pads);
  edges.reset();
  pads = [pad(true)]; assert.equal(edges.poll(), true); assert.equal(edges.poll(), false);
  edges.reset(); assert.equal(edges.poll(), false);
  pads = [pad(false)]; assert.equal(edges.poll(), false);
  pads = [pad(true)]; assert.equal(edges.poll(), true);
  pads = []; assert.equal(edges.poll(), false);
  pads = [pad(true)]; assert.equal(edges.poll(), false);
  pads = [pad(false)]; edges.poll(); pads = [pad(true)]; assert.equal(edges.poll(), true);
});

test('Start uses its own edge and unavailable or nonstandard providers are safe', () => {
  let fail = true; let pads = [pad(false)];
  const provider: FlappyPadProvider = () => { if (fail) throw Error('unavailable'); return pads; };
  const edges = createFlappyPadEdges(9, provider);
  assert.equal(edges.poll(), false);
  fail = false; edges.poll(); pads = [pad(true)]; assert.equal(edges.poll(), true);
  pads = [pad(false, '')]; assert.equal(edges.poll(), false);
  pads = [pad(true, '')]; assert.equal(edges.poll(), false);
});
