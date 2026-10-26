import test from 'node:test';
import assert from 'node:assert/strict';
import { BernoulliPolicy } from '../src/learning/policy.ts';
import { createPolicySnapshot } from '../src/learning/policy-snapshot.ts';
import { comparePracticeModels, validatePracticeModelCheck, PRACTICE_CHECK_SEEDS } from '../src/learning/practice-check.ts';
import { evaluateFlappy } from '../src/evaluation/runner.ts';
import { createExperiment, parseExperiment, serializeExperiment } from '../src/storage/experiment-files.ts';

test('practice checks compare fixed policies on the same five separate sequences without training',()=>{
  const before=createPolicySnapshot(new BernoulliPolicy(2),{stage:'imitation'});
  const p=new BernoulliPolicy(3);p.setParameters({...p.parameters,outputBias:10});
  const after=createPolicySnapshot(p,{stage:'post_rl'}),original=JSON.stringify([before,after]);
  const result=comparePracticeModels(before,after);
  const expected=evaluateFlappy(after,PRACTICE_CHECK_SEEDS);
  assert.deepEqual(result.seeds,[2080,2081,2082,2083,2084]);
  assert.equal(result.before.meanSurvivalSteps,40);
  assert.equal(result.after.meanSurvivalSteps,expected.reduce((sum,r)=>sum+r.result.survivalSteps,0)/5);
  assert.equal(result.after.meanScore,expected.reduce((sum,r)=>sum+r.result.pipesPassed!,0)/5);
  assert.equal(JSON.stringify([before,after]),original);
  assert.deepEqual(comparePracticeModels(before,after),result);
});

test('before/after checks survive file roundtrip; legacy summaries still import and invalid checks fail',()=>{
  const before=createPolicySnapshot(new BernoulliPolicy(2),{stage:'imitation'});
  const after=createPolicySnapshot(new BernoulliPolicy(3),{stage:'post_rl',trainingCounts:{supervisedUpdates:0,reinforcementEpisodes:6}});
  const modelCheck=comparePracticeModels(before,after);
  const run={rounds:1,requestedRounds:16,agents:6,speed:16,elapsedMs:100,attempts:6,meanScore:0,modelCheck};
  const progress={episodes:6,trainedEpisodes:6,steps:240,simulatedSeconds:4,elapsedMs:100,stepsPerSecond:2400,snapshot:after,history:[],scoreHistory:[],modelCheck,trainingRuns:[run]};
  const saved=createExperiment('flappy',{human:[],practice:progress});
  const restored=parseExperiment(serializeExperiment(saved),'flappy').payload as typeof saved.payload & {practice:typeof progress};
  assert.deepEqual(restored.practice.modelCheck,modelCheck);
  assert.deepEqual(restored.practice.trainingRuns[0]!.modelCheck,modelCheck);
  assert.doesNotThrow(()=>createExperiment('flappy',{human:[],practice:{...progress,modelCheck:undefined,trainingRuns:[{...run,modelCheck:undefined}]}}));
  for(const bad of [{...modelCheck,seeds:[1000]}, {...modelCheck,after:{...modelCheck.after,meanScore:NaN}}, {...modelCheck,before:{...modelCheck.before,meanSurvivalSteps:1801}}]) {
    assert.throws(()=>validatePracticeModelCheck(bad));
    assert.throws(()=>createExperiment('flappy',{human:[],practice:{...progress,modelCheck:bad}}));
    assert.throws(()=>createExperiment('flappy',{human:[],practice:{...progress,trainingRuns:[{...run,modelCheck:bad}]}}));
  }
});
