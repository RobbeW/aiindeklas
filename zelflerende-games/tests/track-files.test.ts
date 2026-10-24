import test from 'node:test';import assert from 'node:assert/strict';import { teachingLoop } from './fixtures/circuits.ts';
import { parseCircuitFile,serializeCircuit } from '../src/tracks/track-files.ts';
test('bounded validated circuit files roundtrip; corruption cannot replace a valid document',()=>{
  const original=teachingLoop();assert.deepEqual(parseCircuitFile(serializeCircuit(original)),original);
  for(const text of ['{bad',JSON.stringify({...original,version:'bad'}),' '.repeat(256001),JSON.stringify({...original,cells:original.cells.slice(1)})])assert.throws(()=>parseCircuitFile(text));
  const file=JSON.parse(serializeCircuit(original));file.trackId='forged';assert.throws(()=>parseCircuitFile(JSON.stringify(file)),/identity/);
  assert.equal(original.cells.length,8);
});
