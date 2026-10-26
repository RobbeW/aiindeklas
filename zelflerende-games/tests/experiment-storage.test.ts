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
const evo={completedGenerations:1,evaluatedEpisodes:4,steps:240,elapsedMs:45,champion:createCarSnapshot(new CarPolicy(31),'evolution',{generations:1,interactions:240,trackIds:[trackIdentity(carDoc)]}),records:[{generation:0,bestFitness:3,meanFitness:1.5,groupCount:2,agents:[0,1,2,3].map(i=>({id:`g0-a${i}`,fitness:i===0?3:1,result:{survivalSteps:60,totalReward:.4,terminationReason:'collision',laps:0,crashed:true,progressDistance:10,routeLength:40,progressFraction:.25,elapsedSimulatedSeconds:1}})),failureReplay:{seed:1000,actions:[0,1],result:{}}}]};

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
 assert.throws(()=>parseExperiment('{bad json'));assert.throws(()=>parseExperiment(JSON.stringify({...saved,version:2}),'flappy'));assert.throws(()=>parseExperiment(' '.repeat(8*1024*1024+1)));
 assert.equal(storage.getItem(experimentKey('flappy')),original);assert.equal(store.read('flappy')?.payload, saved.payload);
});

test('data-size assessments and parallel training comparisons survive export with bounded settings',()=>{
 const assessments=[{sessions:1,actions:90,score:0,survivalSteps:41},{sessions:3,actions:300,score:1,survivalSteps:250}];
 const trainingRuns=[{rounds:16,agents:12,speed:64,elapsedMs:1234,attempts:192,meanScore:1.25}];
 const payload={teach:{initialSnapshot:createPolicySnapshot(new BernoulliPolicy(17),{stage:'initial'}),imitationSnapshot:birdSnapshot,episodes:[birdExample],imitationIsStale:false,assessments},practice:{episodes:192,trainedEpisodes:192,steps:12000,simulatedSeconds:200,elapsedMs:1234,stepsPerSecond:9724,snapshot:createPolicySnapshot(new BernoulliPolicy(19),{stage:'post_rl',trainingCounts:{supervisedUpdates:4,reinforcementEpisodes:192}}),history:[],scoreHistory:[],trainingRuns},human:[]};
 const restored=parseExperiment(serializeExperiment(createExperiment('flappy',payload)),'flappy').payload as FlappyLearningState;
 assert.deepEqual(restored.teach?.assessments,assessments);assert.deepEqual(restored.practice?.trainingRuns,trainingRuns);
 for(const bad of [{...trainingRuns[0],agents:7},{...trainingRuns[0],rounds:65},{...trainingRuns[0],elapsedMs:-1}])assert.throws(()=>createExperiment('flappy',{...payload,practice:{...payload.practice,trainingRuns:[bad]}}));
 assert.throws(()=>createExperiment('flappy',{...payload,teach:{...payload.teach,assessments:[{...assessments[0],sessions:-1}]}}));
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
