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
test('car recorded playback stays distinct from a frozen Test after training',()=>{
 assert.equal(demoPresentation(scene('f-training'),{trainingDone:true}).badge,'Test');
 for(const trainingDone of [false,true])assert.equal(demoPresentation(scene('c-training'),{trainingDone}).badge,'Opgenomen oefenronde');
});
test('imitation source badge does not claim human examples while idle',()=>{
 assert.equal(demoPresentation(scene('f-imitation'),{humanExamples:0}).badge,'Voorbeeldspel');
 assert.equal(demoPresentation(scene('f-imitation'),{humanExamples:3}).badge,'Jullie spel + voorbeeldspel');
 assert.equal(demoPresentation(scene('f-imitation'),{trainingDone:true}).badge,'Voorbeeldspel');
});
test('recorded playback shows track, actual sealed count and speed',()=>{
 assert.equal(demoPresentation(scene('f-training'),{birdAttempts:147}).count,'147 pogingen');
 const p={trackIndex:2,trackCount:3,attemptIndex:3,availableAttempts:4,archiveSealed:true,speed:1};
 assert.equal(demoPresentation(scene('c-training'),{carPlayback:p}).count,'Circuit 2/3 · Poging 3/4 · 1×');
 assert.equal(demoPresentation(scene('c-training'),{carPlayback:{...p,archiveSealed:false}}).count,'Circuit 2/3 · Poging 3/10 · 1×');
 assert.equal(demoPresentation(scene('f-examples'),{humanExamples:1}).count,'1 opname');
});
test('scene countdown is visible only for the two three-minute competitions',()=>{
 assert.deepEqual(DEMO_SCENES.filter(s=>demoPresentation(s).showClock).map(s=>[s.id,s.durationMs]),[['f-match',180000],['c-match',180000]]);
});
