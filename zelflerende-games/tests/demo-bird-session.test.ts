import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { DemoBirdSession } from '../src/demo/bird-session.ts';
import { BernoulliPolicy } from '../src/learning/policy.ts';
import { createPolicySnapshot } from '../src/learning/policy-snapshot.ts';

const snapshot = createPolicySnapshot(new BernoulliPolicy(7), { stage: 'post_rl' });
test('contest uses shared opening and synchronized takeover, finished birds freeze', () => {
  const session = new DemoBirdSession({ mode: 'match', snapshot, seed: 42 });
  assert.deepEqual(session.participants[0]!.world.pipes, session.participants[3]!.world.pipes);
  for (let i = 0; i < 10; i++) session.step([0, 0, 0]);
  session.setHuman(0, true);
  const state = session.step([1, 0, 0]);
  assert.deepEqual(state.participants.map((seat) => seat.world.steps), [1, 1, 1, 1]);
  assert.equal(state.participants[0]!.source, 'human');
  for (let i = 0; i < 5000 && !session.finished; i++) session.step([0, 0, 0]);
  assert.equal(session.finished, true);
  const frozen = session.participants.map((seat) => seat.world.steps);
  session.step([1, 1, 1]);
  assert.deepEqual(session.participants.map((seat) => seat.world.steps), frozen);
});
test('examples retain complete separate provenance and discard partial takeover', () => {
  const session = new DemoBirdSession({ mode: 'examples' });
  for (let i = 0; i < 5; i++) session.step([0, 0, 0]);
  session.setHuman(0, true);
  for (let i = 0; i < 5000 && !session.finished; i++) session.step([0, 0, 0]);
  const examples = session.takeExamples();
  assert.equal(examples.length, 3);
  assert.equal(examples.filter((episode) => episode.source === 'human').length, 1);
  assert.equal(new Set(examples.map((episode) => episode.seed)).size, 3);
  assert.ok(examples.every((episode) => episode.seed >= 1000 && episode.seed <= 1999 && episode.frames.length === episode.result.survivalSteps));
  assert.equal(session.examples.length, 0);
});
test('requires actual compatible snapshots and validates input', () => {
  assert.throws(() => new DemoBirdSession({ mode: 'trained' }));
  assert.throws(() => new DemoBirdSession({ mode: 'match', snapshot: createPolicySnapshot(new BernoulliPolicy(1), { stage: 'initial' }) }));
  const original = JSON.stringify(snapshot);
  const session = new DemoBirdSession({ mode: 'trained', snapshot });
  session.step([0, 0, 0]);
  assert.equal(JSON.stringify(snapshot), original);
  assert.throws(() => session.setHuman(3, true));
});

test('untrained demonstration uses the exact supplied initial policy without substituting its seed',async()=>{
 const {FlappyEnvironment}=await import('../src/flappy/environment.ts');const {createSeededRandom}=await import('../src/core/random.ts');
 const policy=new BernoulliPolicy(1222);policy.setParameters({...policy.parameters,outputBias:0});const initial=createPolicySnapshot(policy,{stage:'initial'}),session=new DemoBirdSession({mode:'untrained',snapshot:initial,seed:4000}),env=new FlappyEnvironment();env.reset({seed:4000});const random=createSeededRandom(4000);
 for(let i=0;i<40&&!env.completedResult;i++){env.step(policy.sampleAction(env.getObservation(),random));session.step([0,0,0]);assert.deepEqual(session.participants[3]!.world,env.world);}
 assert.deepEqual(initial.parameters,policy.parameters);assert.throws(()=>new DemoBirdSession({mode:'untrained',snapshot,seed:4000}),/initial/);
});

test('demo references cannot collide with human-example seeds and retain separate training provenance',async()=>{
 const {demoExamples,demoInitial}=await import('../src/demo/training.ts');const {generateReferenceDemonstration}=await import('../src/flappy/reference-demonstrations.ts');const {runImitationJob}=await import('../src/learning/imitation-job.ts');
 // Owned synthetic test fixture representing an existing human record in the reserved range.
 const human={...generateReferenceDemonstration(1999,'owned-human-fixture'),source:'human' as const};const examples=demoExamples([human]);assert.equal(new Set(examples.map(e=>e.seed)).size,3);assert.equal(examples.filter(e=>e.source==='synthetic_reference').length,2);
 const result=await runImitationJob({initialSnapshot:demoInitial(),episodes:examples,validationEpisodeIds:[],allowTrainingOnly:true,updateBudget:1,optimizer:'adam',trainingSeed:1701},{yieldControl:async()=>{}});assert.equal(result.snapshot.trainingCounts.supervisedUpdates,1);assert.ok(result.snapshot.datasetProvenance.some(p=>p.includes('human:owned-human-fixture')));assert.equal(result.snapshot.datasetProvenance.filter(p=>p.includes('synthetic_reference')).length,2);
});
