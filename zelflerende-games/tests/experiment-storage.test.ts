import assert from 'node:assert/strict';
import test from 'node:test';
import { createExperimentStore,experimentKey,type StoragePort } from '../src/storage/database.ts';
import { createExperiment,parseExperiment,serializeExperiment } from '../src/storage/experiment-files.ts';
import type { FlappyLearningState } from '../src/flappy/learning-view.ts';
import type { CarLearningState } from '../src/car/learning-view.ts';
import { BernoulliPolicy } from '../src/learning/policy.ts';
import { createPolicySnapshot,restorePolicySnapshot } from '../src/learning/policy-snapshot.ts';
import { CarPolicy,createCarSnapshot,restoreCarSnapshot } from '../src/car/policy-adapter.ts';
import { teachingLoop } from './fixtures/circuits.ts';
import { trackIdentity } from '../src/tracks/document.ts';
import { DemonstrationRecorder } from '../src/flappy/recorder.ts';
import { CarEpisodeRecorder } from '../src/car/recorder.ts';

class MemoryStorage implements StoragePort {
 readonly values=new Map<string,string>();failSet=false;failRemove=false;
 getItem(k:string){return this.values.get(k)??null;}
 setItem(k:string,v:string){if(this.failSet)throw new Error('quota');this.values.set(k,v);}
 removeItem(k:string){if(this.failRemove)throw new Error('denied');this.values.delete(k);}
}
const birdSnapshot=createPolicySnapshot(new BernoulliPolicy(17),{stage:'imitation',supervisedOptimizer:'adam',trainingSeeds:[1001],datasetProvenance:['episode-a'],trainingCounts:{supervisedUpdates:4,reinforcementEpisodes:0}});
const record={schemaVersion:1 as const,game:'flappy' as const,controller:'imitation' as const,modelId:'bird-model',sequenceId:'sequence-a',seed:3001,attempt:1,mode:'final' as const,configVersion:birdSnapshot.worldConfigVersion,observationVersion:birdSnapshot.observationVersion,budget:{demonstrationSeconds:2,supervisedUpdates:4,trainingEpisodes:8,interactions:120,wallTimeMs:300},result:{survivalSteps:90,totalReward:1,terminationReason:'pipe_collision',pipesPassed:2}};
const carDoc=teachingLoop();
function birdEpisode(id:string,seed:number){const r=new DemonstrationRecorder();r.start(id,seed);while(!r.step(0).done){}return r.completedEpisode!;}
function carEpisode(id:string,seed:number){const r=new CarEpisodeRecorder(carDoc);r.start(id,seed);for(let i=0;i<1800&&!r.completedEpisode;i++)r.step(0);return r.completedEpisode!;}
const birdExample=birdEpisode('bird-example',1001),carExample=carEpisode('car-example',1001);
const carSnapshot=createCarSnapshot(new CarPolicy(23), 'imitation',{supervisedUpdates:7,interactions:80,trackIds:[trackIdentity(carDoc)],supervisedOptimizer:'adam'});
const carRecord={schemaVersion:1 as const,game:'car' as const,controller:'imitation' as const,modelId:'car-model',sequenceId:'track-run',seed:3001,attempt:1,mode:'final' as const,configVersion:'car-world-v1',observationVersion:'car-observation-v1',budget:{demonstrationSeconds:1,supervisedUpdates:7,trainingEpisodes:2,interactions:80,wallTimeMs:90},result:{survivalSteps:60,totalReward:.4,terminationReason:'collision',laps:0,progress:.25,crashed:true}};
const evo={completedGenerations:1,evaluatedEpisodes:4,steps:240,elapsedMs:45,champion:createCarSnapshot(new CarPolicy(31),'evolution',{generations:1,interactions:240,trackIds:[trackIdentity(carDoc)]}),records:[{generation:0,bestFitness:.2,meanFitness:.2,groupCount:2,agents:[0,1,2,3].map(i=>({id:`g0-a${i}`,fitness:.2,result:{survivalSteps:60,totalReward:.4,terminationReason:'collision',laps:0,crashed:true,progressDistance:10,routeLength:40,progressFraction:.25,elapsedSimulatedSeconds:1}})),failureReplay:{seed:1000,actions:[0,1],result:{}}}]};

test('both games round-trip complete examples, snapshots, budgets, results and map identities',()=>{
 const birdPostRl=createPolicySnapshot(new BernoulliPolicy(19),{stage:'post_rl',trainingCounts:{supervisedUpdates:4,reinforcementEpisodes:2}});
 const flappy=createExperiment('flappy',{teach:{initialSnapshot:createPolicySnapshot(new BernoulliPolicy(17),{stage:'initial'}),imitationSnapshot:birdSnapshot,episodes:[birdExample],imitationIsStale:false,status:'active'},practice:{episodes:4,trainedEpisodes:2,steps:120,simulatedSeconds:2,elapsedMs:300,stepsPerSecond:400,cumulativeSteps:200,cumulativeElapsedMs:500,snapshot:birdPostRl,history:[],scoreHistory:[]},human:[record]});
 const restoredBird=parseExperiment(serializeExperiment(flappy),'flappy').payload as FlappyLearningState;
 assert.equal(restorePolicySnapshot(restoredBird.teach!.imitationSnapshot!).probability([0,0,0,0,0]),restorePolicySnapshot(birdSnapshot).probability([0,0,0,0,0]));assert.equal(restoredBird.teach?.episodes[0]?.frames.length,birdExample.frames.length);assert.equal(restoredBird.practice?.cumulativeSteps,200);assert.deepEqual(restoredBird.human[0]?.budget,record.budget);
 const carInitial=createCarSnapshot(new CarPolicy(22),'initial'),carImitation=createCarSnapshot(new CarPolicy(23),'imitation',{supervisedUpdates:7,interactions:80,trackIds:[trackIdentity(carDoc)],supervisedOptimizer:'adam'}),carPostRl=createCarSnapshot(new CarPolicy(24),'post_rl',{supervisedUpdates:7,reinforcementEpisodes:2,interactions:80,trackIds:[trackIdentity(carDoc)],supervisedOptimizer:'adam'});
 const car=createExperiment('car',{document:carDoc,draft:carDoc,teach:{episodes:[carExample],initial:carInitial,imitation:carImitation,stale:false},practice:{episodes:3,trainedEpisodes:2,steps:80,elapsedMs:90,simulatedSeconds:80/60,snapshot:carPostRl,history:[],scores:[]},records:[carRecord],evolution:evo} as never);
 const restoredCar=parseExperiment(serializeExperiment(car),'car').payload as CarLearningState & {evolution:typeof evo};
 assert.equal(restoreCarSnapshot(restoredCar.teach!.imitation!).action([0,0,0,0,0,0]),restoreCarSnapshot(carImitation).action([0,0,0,0,0,0]));assert.equal(restoredCar.teach?.episodes[0]?.frames.length,carExample.frames.length);assert.equal(trackIdentity(restoredCar.document),trackIdentity(carDoc));assert.deepEqual(restoredCar.records[0]?.budget,carRecord.budget);assert.equal(restoredCar.evolution.completedGenerations,1);assert.deepEqual(restoredCar.evolution.champion?.parameters,evo.champion.parameters);assert.equal('failureReplay' in (restoredCar.evolution.records[0] as object),false);
});

test('wrong-game, corrupt, incompatible and oversized imports preserve current state and source keys',()=>{
 const storage=new MemoryStorage(),store=createExperimentStore(storage),saved=createExperiment('flappy',{human:[]});store.save(saved);const original=storage.getItem(experimentKey('flappy'));
 assert.throws(()=>parseExperiment(serializeExperiment(createExperiment('car',{document:carDoc,records:[]})),'flappy'));
 assert.throws(()=>parseExperiment('{bad json'));assert.throws(()=>parseExperiment(JSON.stringify({...saved,version:2}),'flappy'));assert.throws(()=>parseExperiment(' '.repeat(32*1024*1024+1)));
 assert.equal(storage.getItem(experimentKey('flappy')),original);assert.equal(store.read('flappy')?.payload, saved.payload);
});

test('data-size assessments and parallel training comparisons survive export with bounded settings',()=>{
 const assessments=[{sessions:1,actions:90,score:0,survivalSteps:41},{sessions:3,actions:300,score:1,survivalSteps:250}];
 const trainingRuns=[{rounds:16,agents:12,speed:64,elapsedMs:1234,attempts:192,meanScore:1.25}];
 const payload={teach:{initialSnapshot:createPolicySnapshot(new BernoulliPolicy(17),{stage:'initial'}),imitationSnapshot:birdSnapshot,episodes:[birdExample],imitationIsStale:false,assessments},practice:{episodes:192,trainedEpisodes:192,steps:12000,simulatedSeconds:200,elapsedMs:1234,stepsPerSecond:9724,snapshot:createPolicySnapshot(new BernoulliPolicy(19),{stage:'post_rl',trainingCounts:{supervisedUpdates:4,reinforcementEpisodes:192}}),history:[],scoreHistory:[],trainingRuns},human:[]};
 const restored=parseExperiment(serializeExperiment(createExperiment('flappy',payload)),'flappy').payload as FlappyLearningState;
 assert.deepEqual(restored.teach?.assessments,assessments);assert.deepEqual(restored.practice?.trainingRuns,trainingRuns);
 for(const bad of [{...trainingRuns[0],agents:7},{...trainingRuns[0],rounds:1025},{...trainingRuns[0],elapsedMs:-1}])assert.throws(()=>createExperiment('flappy',{...payload,practice:{...payload.practice,trainingRuns:[bad]}}));
 assert.throws(()=>createExperiment('flappy',{...payload,teach:{...payload.teach,assessments:[{...assessments[0],sessions:-1}]}}));
});

test('long fast-training summaries roundtrip with requested budget and actual stop reason',()=>{
 const run={rounds:1024,requestedRounds:1024,agents:12,speed:16,mode:'fast',elapsedMs:20000,attempts:12288,meanScore:0,reason:'round_budget'};
 const progress={episodes:12288,trainedEpisodes:12288,steps:491520,simulatedSeconds:8192,elapsedMs:20000,stepsPerSecond:24576,snapshot:createPolicySnapshot(new BernoulliPolicy(19),{stage:'post_rl',trainingCounts:{supervisedUpdates:250,reinforcementEpisodes:12288}}),history:[],scoreHistory:[],trainingRuns:[run]};
 const restored=parseExperiment(serializeExperiment(createExperiment('flappy',{human:[],practice:progress})),'flappy').payload as FlappyLearningState;
 assert.deepEqual(restored.practice?.trainingRuns,[run]);
 const interrupted={...run,rounds:81,reason:'time_budget'};
 const partial=parseExperiment(serializeExperiment(createExperiment('flappy',{human:[],practice:{...progress,trainingRuns:[interrupted]}})),'flappy').payload as FlappyLearningState;
 assert.deepEqual(partial.practice?.trainingRuns,[interrupted]);
 for(const invalid of [{...run,requestedRounds:64},{...run,mode:'live'},{...run,reason:'pretend_complete'},{...run,rounds:1025,requestedRounds:1025}])assert.throws(()=>createExperiment('flappy',{human:[],practice:{...progress,trainingRuns:[invalid]}}));
});

test('rejects inconsistent snapshot stages, practice progress and evolution summaries',()=>{
 const birdInitial=createPolicySnapshot(new BernoulliPolicy(1),{stage:'initial'}),birdImitation=createPolicySnapshot(new BernoulliPolicy(2),{stage:'imitation'}),birdPost=createPolicySnapshot(new BernoulliPolicy(3),{stage:'post_rl',trainingCounts:{supervisedUpdates:0,reinforcementEpisodes:1}});
 const birdState={teach:{initialSnapshot:birdInitial,imitationSnapshot:birdImitation,episodes:[],imitationIsStale:false},practice:{episodes:1,trainedEpisodes:1,steps:60,simulatedSeconds:1,elapsedMs:5,stepsPerSecond:12000,snapshot:birdPost,history:[],scoreHistory:[]},human:[]};
 assert.throws(()=>createExperiment('flappy',{...birdState,teach:{...birdState.teach,initialSnapshot:birdImitation}}),/Initial teacher/);
 assert.throws(()=>createExperiment('flappy',{...birdState,practice:{...birdState.practice,trainedEpisodes:2}}),/Inconsistent practice/);
 assert.throws(()=>createExperiment('flappy',{...birdState,practice:{...birdState.practice,simulatedSeconds:2}}),/Inconsistent practice/);
 assert.throws(()=>createExperiment('flappy',{...birdState,teach:{...birdState.teach,imitationIsStale:true}}),/Stale imitation/);
 const initial=createCarSnapshot(new CarPolicy(10),'initial'),imitation=createCarSnapshot(new CarPolicy(11),'imitation'),post=createCarSnapshot(new CarPolicy(12),'post_rl',{reinforcementEpisodes:1});
 const carState={document:carDoc,teach:{episodes:[],initial,imitation,stale:false},practice:{episodes:1,trainedEpisodes:1,steps:60,elapsedMs:5,simulatedSeconds:1,snapshot:post,history:[],scores:[]},records:[]};
 assert.throws(()=>createExperiment('car',{...carState,teach:{...carState.teach,initial:imitation}}),/Initial teacher/);
 const brokenEvolution={...evo,records:[{...evo.records[0]!,bestFitness:99}]};assert.throws(()=>createExperiment('car',{...carState,practice:undefined,evolution:brokenEvolution} as never),/summary does not match/);
});

test('quota or unavailable storage falls back to memory and deletion is game-scoped',()=>{
 const storage=new MemoryStorage(),store=createExperimentStore(storage),bird=createExperiment('flappy',{human:[]}),car=createExperiment('car',{document:carDoc,records:[]});store.save(bird);store.save(car);storage.failSet=true;assert.equal(store.save(createExperiment('flappy',{human:[record]})),false);assert.equal(store.mode,'memory');assert.equal((store.read('flappy')?.payload as FlappyLearningState).human.length,1);storage.failSet=false;assert.equal(store.remove('flappy'),true);assert.equal(storage.getItem(experimentKey('car'))!==null,true);assert.equal(store.read('car')?.version,1);
 const unavailable=createExperimentStore(null);assert.equal(unavailable.save(bird),false);assert.equal(unavailable.read('flappy')?.version,1);
 const denied=new MemoryStorage(),deniedStore=createExperimentStore(denied);deniedStore.save(bird);denied.failRemove=true;assert.equal(deniedStore.remove('flappy'),false);assert.equal(deniedStore.read('flappy')?.payload,bird.payload);assert.ok(denied.values.has(experimentKey('flappy')));
 const corrupt=new MemoryStorage();corrupt.values.set(experimentKey('flappy'),'{"kind":"learning-experiment","version":77}');const corruptOriginal=corrupt.getItem(experimentKey('flappy')),corruptStore=createExperimentStore(corrupt);assert.equal(corruptStore.read('flappy'),undefined);assert.equal(corruptStore.save(bird),false);assert.equal(corrupt.getItem(experimentKey('flappy')),corruptOriginal);assert.equal(corruptStore.mode,'memory');
});

class DurableFixture {
 readonly values=new Map<string,string|null>();fail=false;gate:Promise<void>|undefined;
 async get(game:'flappy'|'car'){return this.values.get(game);}
 async put(game:'flappy'|'car',value:string|null){if(this.gate)await this.gate;if(this.fail)throw new Error('QuotaExceededError');this.values.set(game,value);}
}
const tick=()=>new Promise<void>(resolve=>setImmediate(resolve));
async function settled(store:{pending:boolean}){while(store.pending)await tick();}

test('database migrates both games, preserves invalid originals and commits ordered writes and deletions',async()=>{
 const {createDurableExperimentStore}=await import('../src/storage/database.ts');
 const local=new MemoryStorage(),db=new DurableFixture(),bird=createExperiment('flappy',{human:[]}),car=createExperiment('car',{document:carDoc,records:[]});
 local.setItem(experimentKey('flappy'),serializeExperiment(bird));local.setItem(experimentKey('car'),serializeExperiment(car));
 const store=await createDurableExperimentStore(db,local);assert.equal(store.read('flappy')?.game,'flappy');assert.equal(store.read('car')?.game,'car');assert.ok(local.getItem(experimentKey('car')));assert.ok(db.values.get('flappy'));assert.ok(db.values.get('car'));
 let release!:()=>void;db.gate=new Promise<void>(r=>{release=r;});let notices=0;store.subscribe(()=>notices++);store.save(bird);const removal=store.remove('flappy');assert.equal(store.pending,true);assert.equal(store.read('flappy')?.game,'flappy');release();assert.equal(await removal,true);await settled(store);assert.equal(local.getItem(experimentKey('flappy')),null);assert.equal(db.values.get('flappy'),null);assert.ok(notices>=3);
 const reload=await createDurableExperimentStore(db,local);assert.equal(reload.read('flappy'),undefined);assert.equal(reload.read('car')?.game,'car');
 const invalid=new MemoryStorage(),db2=new DurableFixture();invalid.setItem(experimentKey('flappy'),'{invalid');const bad=await createDurableExperimentStore(db2,invalid);assert.match(bad.error,/origineel blijft bewaard/);bad.save(bird);await settled(bad);assert.equal(invalid.getItem(experimentKey('flappy')),'{invalid');
 const db3=new DurableFixture();db3.values.set('flappy','{invalid');const badDb=await createDurableExperimentStore(db3,null);badDb.save(bird);await settled(badDb);assert.equal(db3.values.get('flappy'),'{invalid');assert.ok(badDb.error);
});

test('database quota failure retains exportable latest state and retry survives reload',async()=>{
 const {createDurableExperimentStore}=await import('../src/storage/database.ts');const db=new DurableFixture();const store=await createDurableExperimentStore(db,null);const bird=createExperiment('flappy',{human:[record]});db.fail=true;store.save(bird);await settled(store);assert.match(store.error,/QuotaExceededError/);assert.equal(parseExperiment(serializeExperiment(store.read('flappy')!)).game,'flappy');db.fail=false;store.retry();assert.equal(store.pending,true);await settled(store);assert.equal(store.error,'');assert.equal((await createDurableExperimentStore(db,null)).read('flappy')?.game,'flappy');
});

test('bounded 100-generation, 32-car, 8-track experiment fits compact export',async()=>{
 const {scoreCarResult}=await import('../src/evolution/population-evaluation.ts');
 const ids=Array.from({length:8},(_,i)=>`track-${i}`);const result={survivalSteps:60,totalReward:.4,terminationReason:'collision' as const,laps:0 as const,crashed:true,progressDistance:10,routeLength:40,progressFraction:.25,elapsedSimulatedSeconds:1};const fitness=scoreCarResult(result);
 const records=Array.from({length:100},(_,generation)=>({generation,bestFitness:fitness,meanFitness:fitness,groupCount:32,agents:Array.from({length:32},(_,i)=>({id:`g${generation}-a${i}`,fitness,result,perTrack:ids.map(trackId=>({trackId,result,fitness}))}))}));
 const steps=100*32*8*60;const evolution={completedGenerations:100,evaluatedEpisodes:100*32*8,steps,elapsedMs:100,trainingTrackIds:ids,records,champion:createCarSnapshot(new CarPolicy(31),'evolution',{generations:100,interactions:steps,trackIds:ids})};
 const saved=createExperiment('car',{document:carDoc,records:[],evolution});const compact=serializeExperiment(saved),formatted=JSON.stringify(saved,null,2);console.log(`bounded fixture: compact ${Buffer.byteLength(compact)} bytes/${compact.length} chars; formatted ${Buffer.byteLength(formatted)} bytes/${formatted.length} chars`);assert.ok(Buffer.byteLength(compact)<32*1024*1024);assert.equal((parseExperiment(compact,'car').payload as CarLearningState).evolution?.records.length,100);
 const quota=5*1024*1024;assert.throws(()=>{if(formatted.length*2>quota)throw new Error('QuotaExceededError');},/QuotaExceededError/);
});

test('one game success does not erase another game error and fallback avoids stale legacy after database use',async()=>{
 const {createDurableExperimentStore,createFallbackExperimentStore}=await import('../src/storage/database.ts');const db=new DurableFixture(),store=await createDurableExperimentStore(db,null),bird=createExperiment('flappy',{human:[]}),car=createExperiment('car',{document:carDoc,records:[]});db.fail=true;store.save(bird);await settled(store);db.fail=false;store.save(car);await settled(store);assert.match(store.error,/QuotaExceededError/);store.retry();await settled(store);assert.equal(store.error,'');
 const local=new MemoryStorage();local.setItem(experimentKey('flappy'),serializeExperiment(bird));local.setItem('ai-in-de-klas:v1:database','1');const fallback=createFallbackExperimentStore(local);assert.equal(fallback.read('flappy'),undefined);assert.equal(fallback.save(bird),false);assert.match(fallback.error,/Opslaan mislukt/);assert.ok(local.getItem(experimentKey('flappy')));
});


test('failed deletion retains exportable work, repeated delete removes durable and migrated copies only after commit',async()=>{
 const {createDurableExperimentStore}=await import('../src/storage/database.ts');const db=new DurableFixture(),local=new MemoryStorage(),bird=createExperiment('flappy',{human:[]}),car=createExperiment('car',{document:carDoc,records:[]});
 local.setItem(experimentKey('flappy'),serializeExperiment(bird));local.setItem(experimentKey('car'),serializeExperiment(car));const store=await createDurableExperimentStore(db,local);db.fail=true;assert.equal(await store.remove('flappy'),false);assert.equal(store.read('flappy')?.game,'flappy');assert.ok(db.values.get('flappy'));assert.ok(local.getItem(experimentKey('flappy')));
 db.fail=false;assert.equal(await store.remove('flappy'),true);await settled(store);assert.equal(store.read('flappy'),undefined);assert.equal(db.values.get('flappy'),null);assert.equal(local.getItem(experimentKey('flappy')),null);assert.ok(local.getItem(experimentKey('car')));
 const bad=new DurableFixture();bad.values.set('flappy','{invalid');const corrupt=await createDurableExperimentStore(bad,null);assert.equal(await corrupt.remove('flappy'),true);corrupt.save(bird);await settled(corrupt);assert.equal(corrupt.error,'');assert.ok(bad.values.get('flappy'));
});

test('a save queued after deletion remains newest; cleanup failure is explicit and exportable',async()=>{
 const {createDurableExperimentStore}=await import('../src/storage/database.ts');const db=new DurableFixture(),local=new MemoryStorage(),old=createExperiment('flappy',{human:[]}),newer=createExperiment('flappy',{human:[record]});const store=await createDurableExperimentStore(db,local);store.save(old);await settled(store);
 let release!:()=>void;db.gate=new Promise<void>(r=>release=r);const deletion=store.remove('flappy');store.save(newer);release();assert.equal(await deletion,false);await settled(store);assert.equal((store.read('flappy')!.payload as FlappyLearningState).human.length,1);assert.equal((parseExperiment(db.values.get('flappy')!).payload as FlappyLearningState).human.length,1);
 local.setItem(experimentKey('flappy'),serializeExperiment(newer));local.failRemove=true;assert.equal(await store.remove('flappy'),false);assert.match(store.error,/Wissen mislukt/);assert.equal(store.read('flappy')?.game,'flappy');store.retry();await settled(store);assert.equal(store.read('flappy')?.game,'flappy');local.failRemove=false;assert.equal(await store.remove('flappy'),true);assert.equal(local.getItem(experimentKey('flappy')),null);
});
