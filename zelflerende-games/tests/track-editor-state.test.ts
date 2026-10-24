import test from 'node:test';import assert from 'node:assert/strict';
import { TrackEditorState } from '../src/tracks/editor-state.ts';
import { TRACK_VERSION,validateCircuit,trackIdentity } from '../src/tracks/document.ts';
test('mixed place/rotate/erase undo redo restores exact documents and editing after undo branches safely',()=>{
  const empty=validateCircuit({version:TRACK_VERSION,width:3,height:3,cells:[]});const e=new TrackEditorState(empty);
  e.edit({type:'place',tile:{x:1,y:1,kind:'straight',rotation:0}});const placed=e.document;
  e.edit({type:'rotate',x:1,y:1});e.edit({type:'erase',x:1,y:1});
  e.undo();e.undo();assert.deepEqual(e.document,placed);e.undo();assert.equal(trackIdentity(e.document),trackIdentity(empty));
  e.redo();assert.deepEqual(e.document,placed);e.edit({type:'start',start:{x:1,y:1,direction:'N'}});assert.equal(e.canRedo,false);
  const before=e.document;assert.throws(()=>e.edit({type:'place',tile:{x:10,y:0,kind:'turn',rotation:0}}),/coordinate/);assert.equal(e.document,before);
});
