import test from 'node:test';
import assert from 'node:assert/strict';
import { startTrainingGym,updateTrainingGym } from '../src/ui/training-gym-state.ts';

test('all updates can finish before a saved training result exists',()=>{
 let state=startTrainingGym(250);
 assert.equal(state.completed,0);
 state=updateTrainingGym(state,{type:'progress',completed:25});assert.equal(state.completed,25);
 state=updateTrainingGym(state,{type:'progress',completed:250});assert.equal(state.status,'running');assert.match(state.message,/afgerond/);
 state=updateTrainingGym(state,{type:'complete',completed:250});assert.equal(state.status,'complete');assert.equal(state.completed,250);
 assert.equal(updateTrainingGym(state,{type:'progress',completed:1}),state);
});
test('cancel/error keep actual progress and never turn into completion',()=>{
 let state=updateTrainingGym(startTrainingGym(250),{type:'progress',completed:40});
 state=updateTrainingGym(state,{type:'stop'});assert.equal(state.status,'stopping');
 assert.equal(updateTrainingGym(state,{type:'complete',completed:250}),state);
 assert.equal(updateTrainingGym(state,{type:'progress',completed:99}),state);
 state=updateTrainingGym(state,{type:'cancelled',message:'Vorig model behouden.'});assert.equal(state.completed,40);assert.equal(state.status,'cancelled');
 assert.equal(updateTrainingGym(state,{type:'complete',completed:250}),state);
 const error=updateTrainingGym(startTrainingGym(250),{type:'error',message:'Voorbeelden ontbreken.'});assert.equal(error.completed,0);assert.equal(error.status,'error');
 assert.equal(updateTrainingGym(error,{type:'progress',completed:250}),error);
});
test('retry starts empty and rejects invalid or backwards progress',()=>{
 for(const budget of [0,-1,NaN,1.5])assert.throws(()=>startTrainingGym(budget));
 let state=updateTrainingGym(startTrainingGym(250),{type:'progress',completed:40});
 for(const completed of [-1,39,251,NaN,40.5])assert.equal(updateTrainingGym(state,{type:'progress',completed}),state);
 state=updateTrainingGym(state,{type:'complete',completed:100});assert.equal(state.status,'error');assert.equal(state.completed,40);
 const retry=startTrainingGym(250);assert.equal(retry.completed,0);assert.equal(retry.status,'running');
});
