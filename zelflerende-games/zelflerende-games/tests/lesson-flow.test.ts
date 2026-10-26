import test from 'node:test';
import assert from 'node:assert/strict';
import { validateLessonNotes,MAX_ANSWER_LENGTH } from '../src/flappy/lesson-notes.ts';
import { tourCardPosition } from '../src/ui/tour-position.ts';
import { createExperiment,parseExperiment,serializeExperiment } from '../src/storage/experiment-files.ts';
import { readRoute,routeUrl } from '../src/app/route-location.ts';

test('lesson answers survive local experiment export/import; previous version-1 files still work',()=>{
 const notes={play:{prediction:'Ik kijk naar de opening.',goal:'Verder vliegen.',avoid:'Botsen.',reflection:'Mijn timing was laat.',nextTry:'Eerder flappen.'},teach:{prediction:'Ook wachten voordoen.',reflection:'Er ontbreken lage situaties.',nextTry:'Een ander voorbeeld.'}};
 const file=createExperiment('flappy',{human:[],notes});
 assert.deepEqual((parseExperiment(serializeExperiment(file),'flappy').payload as {notes:unknown}).notes,notes);
 assert.equal('notes' in createExperiment('flappy',{human:[]}).payload,false);
 assert.equal(validateLessonNotes(undefined),undefined);
});
test('malformed, excessive or unrecognised answers reject the imported file',()=>{
 for(const notes of [null,[],{car:{prediction:'',reflection:'',nextTry:''}},{play:{prediction:'',reflection:''}},{play:{prediction:'',reflection:4,nextTry:''}},{play:{prediction:'x'.repeat(MAX_ANSWER_LENGTH+1),reflection:'',nextTry:''}}])assert.throws(()=>createExperiment('flappy',{human:[],notes}));
 const answer='<script>do not run</script>';
 assert.equal(validateLessonNotes({play:{prediction:answer,reflection:'',nextTry:''}})?.play?.prediction,answer);
});
test('lesson subpages restore through deep links and are cleared when leaving Flappy',()=>{
 assert.deepEqual(readRoute(new URL('https://example.test/tool/?view=flappy&step=teach&lesson=after')),{page:'flappy',step:'teach',lesson:'after'});
 assert.deepEqual(readRoute(new URL('https://example.test/tool/?view=flappy&step=play&lesson=unknown')),{page:'flappy',step:'play'});
 assert.deepEqual(readRoute(new URL('https://example.test/tool/?view=car&step=play&lesson=after')),{page:'car',step:'play'});
 const current=new URL('https://example.test/aiindeklas/zelflerende-games/?view=flappy&step=teach&lesson=after&theme=test');
 assert.equal(routeUrl(current,'flappy','practice','experiment'),'/aiindeklas/zelflerende-games/?view=flappy&step=practice&lesson=experiment&theme=test');
 assert.equal(routeUrl(current,'car','play'),'/aiindeklas/zelflerende-games/?view=car&step=play&theme=test');
 assert.equal(routeUrl(current,'home'),'/aiindeklas/zelflerende-games/?theme=test');
});
test('tour explanation remains within desktop and narrow viewport edges',()=>{
 for(const viewport of [{width:1280,height:720},{width:390,height:844},{width:390,height:420}]){
  const card={width:Math.min(380,viewport.width-32),height:Math.min(300,viewport.height-32)};
  for(const target of [{left:0,top:0,width:40,height:44},{left:viewport.width-50,top:viewport.height-50,width:44,height:44},{left:20,top:100,width:viewport.width-40,height:200}]){
   const pos=tourCardPosition(target,viewport,card);assert.ok(pos.left>=16&&pos.top>=16);assert.ok(pos.left+card.width<=viewport.width-16);assert.ok(pos.top+card.height<=viewport.height-16);
  }
 }
});
