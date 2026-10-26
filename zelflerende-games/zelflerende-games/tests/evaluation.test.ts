import test from 'node:test';import assert from 'node:assert/strict';
import { evaluateFlappy } from '../src/evaluation/runner.ts';
import { validateEvaluationRecord,summarizeEvaluations } from '../src/evaluation/records.ts';
import { BernoulliPolicy } from '../src/learning/policy.ts';
import { createPolicySnapshot } from '../src/learning/policy-snapshot.ts';
test('same reserved sequences and immutable models produce independently retained per-attempt records',()=>{
  const initial=createPolicySnapshot(new BernoulliPolicy(1),{stage:'initial'});
  const imitation=createPolicySnapshot(new BernoulliPolicy(2),{stage:'imitation',trainingCounts:{supervisedUpdates:250,reinforcementEpisodes:0}});
  const before=JSON.stringify(initial);const seeds=[2000,2001,2002];
  const a=evaluateFlappy(initial,seeds),b=evaluateFlappy(imitation,seeds);
  assert.equal(JSON.stringify(initial),before);assert.deepEqual(a.map(r=>r.sequenceId),b.map(r=>r.sequenceId));
  assert.equal(a[0]!.controller,'initial');assert.equal(b[0]!.budget.supervisedUpdates,250);
  assert.deepEqual(summarizeEvaluations(a),{attempts:3,mean:0,min:0,max:0,meanSurvivalSteps:40});
  assert.ok(Object.isFrozen(a[0]?.result));
  assert.throws(()=>evaluateFlappy(initial,[3000]),/namespace/);
  assert.throws(()=>evaluateFlappy(initial,[3000],{mode:'final'}),/explicit/);
});
test('corrupt versions, nonfinite metrics/budgets and missing game metrics fail without coercion',()=>{
  const row=evaluateFlappy(createPolicySnapshot(new BernoulliPolicy(1),{stage:'initial'}),[2000])[0]!;
  assert.throws(()=>validateEvaluationRecord({...row,schemaVersion:2}),/version/);
  assert.throws(()=>validateEvaluationRecord({...row,result:{...row.result,totalReward:NaN}}),/result/);
  assert.throws(()=>validateEvaluationRecord({...row,budget:{...row.budget,wallTimeMs:-1}}),/budget/);
  assert.throws(()=>validateEvaluationRecord({...row,game:'car'}),/lap/);
  assert.deepEqual(summarizeEvaluations([]).mean,null);
});
