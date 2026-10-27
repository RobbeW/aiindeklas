import test from 'node:test';
import assert from 'node:assert/strict';
import {createInitialLibrary,getTrainingDocuments,validateLibrary} from '../src/tracks/library.ts';
import {validateCarLessonNotes} from '../src/car/lesson-notes.ts';
import {createExperiment,parseExperiment,serializeExperiment} from '../src/storage/experiment-files.ts';
import {runEvolutionJob} from '../src/evolution/generation-job.ts';
import {readRoute,routeUrl} from '../src/app/route-location.ts';
import type {CarLearningState} from '../src/car/learning-view.ts';

test('car phases and circuit step keep Pages paths/history parameters',()=>{
 const u=new URL('https://example.test/aiindeklas/zelflerende-games/?view=car&step=tracks&lesson=after');assert.deepEqual(readRoute(u),{page:'car',step:'tracks',lesson:'after'});
 assert.equal(routeUrl(u,'car','population','experiment'),'/aiindeklas/zelflerende-games/?view=car&step=population&lesson=experiment');
 assert.equal(readRoute(new URL('https://e.test/?view=car&step=teach&lesson=before')).step,'teach');
});
test('car notes are bounded text and freeze without changing Flappy notes',()=>{
 const source={population:{prediction:'Meer verschillende banen?',reflection:'Deze generatie kwam verder.'}};const notes=validateCarLessonNotes(source)!;source.population.prediction='changed';assert.equal(notes.population?.prediction,'Meer verschillende banen?');assert.ok(Object.isFrozen(notes.population));
 assert.throws(()=>validateCarLessonNotes({arena:{prediction:'',reflection:''}}));assert.throws(()=>validateCarLessonNotes({edit:{prediction:'x'.repeat(2001),reflection:''}}));assert.throws(()=>validateCarLessonNotes({edit:{prediction:'',reflection:'',extra:1}}));
});
test('actual multi-circuit generations, sequence and answers survive export/import with partial next generation',async()=>{
 const base=createInitialLibrary(),library=validateLibrary({...base,selectedIds:[base.entries[1]!.id,base.entries[0]!.id]}),documents=getTrainingDocuments(library);
 const evolution=await runEvolutionJob({document:documents[0]!,documents,populationSize:4,generationBudget:2,stepBudget:4*2*1800*2,seed:1701},{yieldControl:async()=>{}});
 assert.equal(evolution.completedGenerations,2);assert.equal(evolution.records[0]!.agents[0]!.perTrack.length,2);
 const state={document:documents[0]!,records:[],library,notes:{tracks:{prediction:'Links en rechts.',reflection:'Een andere bocht.'}},evolution};
 const copy=parseExperiment(serializeExperiment(createExperiment('car',state)),'car').payload as CarLearningState;
 assert.deepEqual(copy.library?.selectedIds,library.selectedIds);assert.deepEqual(copy.evolution?.champion?.parameters,evolution.champion?.parameters);assert.deepEqual(copy.evolution?.milestones?.map(s=>s.training.generations),[1,2]);assert.equal(copy.notes?.tracks?.prediction,'Links en rechts.');assert.equal('liveFrame' in copy.evolution!,false);
 const damaged=JSON.parse(JSON.stringify(state));damaged.evolution.records[0]!.agents[0]!.perTrack.pop();assert.throws(()=>createExperiment('car',damaged),/coverage/);
});
