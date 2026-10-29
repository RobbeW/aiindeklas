import { test } from 'node:test';
import assert from 'node:assert/strict';
import { trainingProjection, trainingViewport } from '../src/demo/car-training-renderer.ts';

const circuits = [{ width: 4, height: 4 }, { width: 7, height: 4 }, { width: 4, height: 7 }];
test('all circuit shapes share world scale and remain centred in a square', () => {
  const viewport = trainingViewport(circuits, 700, 1);
  assert.deepEqual(viewport, { pixels: 700, scale: 1 });
  const projections = circuits.map(c => trainingProjection(c, viewport));
  assert.deepEqual(projections, [{ scale: 1, x: 150, y: 150 }, { scale: 1, x: 0, y: 150 }, { scale: 1, x: 150, y: 0 }]);
  for (let i = 0; i < circuits.length; i++) {
    const c = circuits[i]!, p = projections[i]!;
    assert.equal(p.x + c.width * 50 * p.scale, 350);
    assert.equal(p.y + c.height * 50 * p.scale, 350);
  }
});
test('layout and DPR change backing size while preserving CSS geometry', () => {
  const one = trainingViewport(circuits, 350, 1), two = trainingViewport(circuits, 350, 2);
  assert.equal(one.pixels, 350); assert.equal(two.pixels, 700);
  const p1 = trainingProjection(circuits[1]!, one), p2 = trainingProjection(circuits[1]!, two);
  assert.equal(p1.x, p2.x / 2); assert.equal(p1.y, p2.y / 2); assert.equal(p1.scale, p2.scale / 2);
  assert.equal(trainingViewport(circuits, 420, 1).pixels, 420);
  assert.throws(() => trainingViewport(circuits, 0, 1), RangeError);
});

test('frame changes retain backing dimensions and align cars with their cached circuit', async () => {
  const { createCarTrainingRenderer } = await import('../src/demo/car-training-renderer.ts');
  const { trackIdentity } = await import('../src/tracks/document.ts');
  const docs = circuits.map(c => ({ ...c, version: 'tile-circuit-v1' as const, cells: [] }));
  const calls: unknown[][] = [];
  let writes = 0;
  const makeCanvas = (visible: boolean) => {
    let width = 300, height = 150;
    const canvas = {
      get width() { return width; }, set width(v: number) { width = v; if (visible) writes++; },
      get height() { return height; }, set height(v: number) { height = v; if (visible) writes++; },
      ownerDocument: owner,
      getBoundingClientRect: () => ({ width: 350, height: 350 }),
      getContext: () => new Proxy({ canvas: canvas }, { get(target, key) {
        if (key === 'canvas') return target.canvas;
        return (...args: unknown[]) => { if (visible) calls.push([key, ...args]); };
      }, set() { return true; } }),
    };
    return canvas;
  };
  const owner = { createElement: () => makeCanvas(false), defaultView: { devicePixelRatio: 2, addEventListener() {}, removeEventListener() {} } };
  const previousStorage = globalThis.localStorage;
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: { getItem: () => 'class' } });
  try {
    const canvas = makeCanvas(true);
    const renderer = createCarTrainingRenderer(canvas as unknown as HTMLCanvasElement, docs);
    assert.equal(canvas.width, 700); assert.equal(canvas.height, 700);
    const initialWrites = writes;
    calls.length = 0;
    const frame = { trackId: trackIdentity(docs[1]!), generation: 0, round: 1, agents: [{ id: 'a', world: { car: { x: 100, y: 200, heading: 0 } }, done: false }] };
    renderer.update({ frame: frame as never });
    assert.equal(writes, initialWrites);
    assert.deepEqual(calls.filter(c => c[0] === 'translate').slice(0, 2), [['translate', 0, 150], ['translate', 100, 200]]);
    assert.ok(calls.some(c => c[0] === 'scale' && c[1] === 1 && c[2] === 1));
    renderer.update({});
    assert.equal(writes, initialWrites);
    renderer.resize(350, 2);
    assert.equal(writes, initialWrites);
    renderer.resize(420, 2);
    assert.equal(canvas.width, 840); assert.equal(canvas.height, 840);
    renderer.dispose();
  } finally {
    Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: previousStorage });
  }
});
