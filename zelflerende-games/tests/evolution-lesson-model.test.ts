import test from 'node:test';
import assert from 'node:assert/strict';
import {evolutionDiagramWeights as weights,EXAMPLE_PARENTS,EXAMPLE_ELITE} from '../src/car/evolution-lesson-model.ts';

test('explanatory cars have distinct weights on one unchanged topology; the elite is preserved',()=>{
 const models=Array.from({length:6},(_,i)=>weights(i));
 assert.equal(new Set(models.map(m=>JSON.stringify(m))).size,6);
 assert.ok(models.every(m=>m.length===24&&m.every(Number.isFinite)));
 const original=JSON.stringify(models);
 for(let i=0;i<9;i++)weights(i);
 assert.equal(JSON.stringify(models),original);
 assert.strictEqual(weights(EXAMPLE_ELITE),models[1]);
 assert.ok(Object.isFrozen(weights(EXAMPLE_ELITE)));
 assert.throws(()=>weights(9),/Unknown/);
});
test('each new variant mixes both selected parents and has one small change',()=>{
 const [a,b]=EXAMPLE_PARENTS.map(weights),children=[6,7,8].map(weights);
 assert.equal(new Set(children.map(c=>JSON.stringify(c))).size,3);
 for(const child of children){
  assert.notDeepEqual(child,a);assert.notDeepEqual(child,b);
  assert.ok(child.some((v,i)=>v===a![i]&&v!==b![i]));
  assert.ok(child.some((v,i)=>v===b![i]&&v!==a![i]));
  assert.equal(child.filter((v,i)=>v!==a![i]&&v!==b![i]).length,1);
 }
});
