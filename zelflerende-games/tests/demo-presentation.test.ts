import {test} from 'node:test';
import {strict as assert} from 'node:assert';
import {demoPresentation} from '../src/demo/presentation.ts';
import {DEMO_SCENES} from '../src/demo/timeline.ts';
const scene=(id:string)=>DEMO_SCENES.find(s=>s.id===id)!;
test('only playable scenes offer game controls; explanations can reserve competition seats',()=>{
 for(const s of DEMO_SCENES){const copy=demoPresentation(s);
  if(copy.action==='flappy')assert.ok(['f-untrained','f-examples','f-match'].includes(s.id));
  if(copy.action==='car')assert.ok(['c-drive','c-match'].includes(s.id));
  if(copy.action==='reserve')assert.ok(s.id.endsWith('match-info'));
 }
 assert.equal(demoPresentation(scene('f-training')).action,'later');
 assert.equal(demoPresentation(scene('c-training'),{trainingDone:true}).action,'later');
});
test('frozen playback switches from learning to Test without implying more updates',()=>{
 for(const id of ['f-training','c-training']){
  const training=demoPresentation(scene(id)),playback=demoPresentation(scene(id),{trainingDone:true});
  assert.notEqual(training.badge,'Test');assert.equal(playback.badge,'Test');assert.notEqual(training.title,playback.title);
 }
});
test('imitation source badge does not claim human examples while idle',()=>{
 assert.equal(demoPresentation(scene('f-imitation'),{humanExamples:0}).badge,'Voorbeeldspel');
 assert.equal(demoPresentation(scene('f-imitation'),{humanExamples:3}).badge,'Jullie spel + voorbeeldspel');
 assert.equal(demoPresentation(scene('f-imitation'),{trainingDone:true}).badge,'Voorbeeldspel');
});
test('one counter uses actual attempts or bounded live/completed generation counts',()=>{
 assert.equal(demoPresentation(scene('f-training'),{birdAttempts:147}).count,'147 pogingen');
 assert.equal(demoPresentation(scene('c-training'),{carGenerations:30}).count,'Generatie 30');
 assert.equal(demoPresentation(scene('c-training'),{trainingDone:true,carGenerations:30}).count,'30 generaties');
 assert.equal(demoPresentation(scene('f-examples'),{humanExamples:3}).count,'3 opnamen');
 assert.equal(demoPresentation(scene('c-training'),{trainingDone:true,carGenerations:1}).count,'1 generatie');
 assert.equal(demoPresentation(scene('f-examples'),{humanExamples:1}).count,'1 opname');
});
test('scene countdown is visible only for the two three-minute competitions',()=>{
 assert.deepEqual(DEMO_SCENES.filter(s=>demoPresentation(s).showClock).map(s=>[s.id,s.durationMs]),[['f-match',180000],['c-match',180000]]);
});
