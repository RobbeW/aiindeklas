import test from 'node:test';import assert from 'node:assert/strict';
import { validateCircuit,TRACK_VERSION,trackIdentity,type CircuitDocument } from '../src/tracks/document.ts';
import { validateConnections } from '../src/tracks/connectivity.ts';
export function tinyLoop():CircuitDocument{return validateCircuit({version:TRACK_VERSION,width:3,height:3,cells:[
  {x:0,y:0,kind:'turn',rotation:1},{x:1,y:0,kind:'straight',rotation:1},{x:2,y:0,kind:'turn',rotation:2},
  {x:0,y:1,kind:'straight',rotation:0},{x:2,y:1,kind:'straight',rotation:0},
  {x:0,y:2,kind:'turn',rotation:0},{x:1,y:2,kind:'straight',rotation:1},{x:2,y:2,kind:'turn',rotation:3}],start:{x:1,y:0,direction:'E'}});}
test('tile document roundtrip, stable identity and strict shapes/versions',()=>{
  const loop=tinyLoop();assert.deepEqual(validateCircuit(JSON.parse(JSON.stringify(loop))),loop);
  assert.equal(trackIdentity({...loop,cells:[...loop.cells].reverse()}),trackIdentity(loop));
  assert.throws(()=>validateCircuit({...loop,version:'other'}),/version/);
  assert.throws(()=>validateCircuit({...loop,cells:[...loop.cells,loop.cells[0]]}),/Duplicate/);
  assert.throws(()=>validateCircuit({...loop,start:{x:0,y:0,direction:'E'}}),/straight/);
  assert.throws(()=>validateCircuit({...loop,width:100}),/dimensions/);
});
test('reciprocal loop validation reports open cells, wrong rotations and disconnected loops',()=>{
  const loop=tinyLoop();assert.equal(validateConnections(loop).valid,true);
  assert.equal(validateConnections({...loop,cells:loop.cells.slice(1)}).valid,false);
  assert.equal(validateConnections({...loop,cells:loop.cells.map((c,i)=>i===0?{...c,rotation:0}:c)}).valid,false);
  const two=validateCircuit({...loop,width:7,cells:[...loop.cells,...loop.cells.map(c=>({...c,x:c.x+4}))]});
  assert.ok(validateConnections(two).issues.some(i=>i.message.includes('los circuit')));
});
