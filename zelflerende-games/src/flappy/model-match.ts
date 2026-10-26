import { FlappyEnvironment, FLAPPY_OBSERVATION_VERSION, FLAPPY_SEQUENCE_VERSION, FLAPPY_WORLD_CONFIG_VERSION, type FlappyEpisodeResult } from './environment.ts';
import { restorePolicySnapshot, type PolicySnapshot } from '../learning/policy-snapshot.ts';
import type { EvaluationRecord } from '../evaluation/records.ts';
import { validateEvaluationRecord } from '../evaluation/records.ts';
import { stableIdentity } from '../evaluation/records.ts';
import { flattenPolicyParameters } from '../learning/policy.ts';
import type { WorldState } from './world.ts';

export const MODEL_MATCH_SEEDS = Object.freeze([2030, 2031, 2032] as const);
export type MatchPlayerId = 'A' | 'B' | 'C' | 'D';
export type MatchPhase = 'ready' | 'running' | 'paused' | 'completed';
export interface MatchModel { readonly id: 'A' | 'B' | 'C'; readonly snapshot?: PolicySnapshot; readonly available: boolean; }
export interface MatchPlayerSnapshot {
  readonly id: MatchPlayerId; readonly available: boolean; readonly world: WorldState;
  readonly score: number; readonly result?: Readonly<FlappyEpisodeResult>;
}
export interface ModelMatchSnapshot { readonly phase: MatchPhase; readonly test: number; readonly seed: number; readonly players: readonly MatchPlayerSnapshot[]; }
type Participant = { id: MatchPlayerId; environment: FlappyEnvironment; score: number; result?: Readonly<FlappyEpisodeResult>; policy?: ReturnType<typeof restorePolicySnapshot>; model?: PolicySnapshot };

const ids: readonly MatchPlayerId[] = Object.freeze(['A', 'B', 'C', 'D']);
export function modelMatchAvailable(models: readonly MatchModel[]): boolean {
  return models.length === 3 && models[0]?.available === true && models[1]?.available === true && models[2]?.available === true;
}

/** One synchronized attempt. Model snapshots are only ever read; D has independent human input. */
export class ModelMatchSession {
  private phaseValue: MatchPhase = 'ready';
  private participants: Participant[] = [];
  private testValue = 0;
  readonly models: readonly MatchModel[];
  private readonly budget: Readonly<{ demonstrationSeconds: number; practiceSteps: number; practiceElapsedMs: number }>;
  constructor(models: readonly MatchModel[], budget: Readonly<{ demonstrationSeconds: number; practiceSteps: number; practiceElapsedMs: number }>) {
    this.models = Object.freeze(models.map(model => Object.freeze({ ...model })));
    this.budget = Object.freeze({ ...budget });
    if (!modelMatchAvailable(this.models)) throw new Error('All three frozen models are required');
    if (this.models[0]!.snapshot!.stage !== 'initial' || this.models[1]!.snapshot!.stage !== 'imitation' || this.models[2]!.snapshot!.stage !== 'post_rl') throw new Error('Model stages do not match A/B/C');
    this.reset(0);
  }
  private reset(test: number) {
    if (!Number.isInteger(test) || test < 0 || test >= MODEL_MATCH_SEEDS.length) throw new RangeError('test must be 0, 1, or 2');
    this.testValue = test; const seed = MODEL_MATCH_SEEDS[test]!;
    this.participants = ids.map(id => {
      const environment = new FlappyEnvironment(); environment.reset({ seed });
      const model = id === 'D' ? undefined : this.models.find(item => item.id === id)!.snapshot!;
      return { id, environment, score: 0, ...(model === undefined ? {} : { model, policy: restorePolicySnapshot(model) }) };
    }); this.phaseValue = 'ready';
  }
  get snapshot(): ModelMatchSnapshot {
    return Object.freeze({ phase: this.phaseValue, test: this.testValue, seed: MODEL_MATCH_SEEDS[this.testValue]!, players: Object.freeze(this.participants.map(p => Object.freeze({ id: p.id, available: true, world: p.environment.world, score: p.score, ...(p.result ? { result: p.result } : {}) }))) });
  }
  start(): ModelMatchSnapshot { if (this.phaseValue !== 'ready') throw new Error('match can only start from ready'); this.phaseValue = 'running'; return this.snapshot; }
  pause(): ModelMatchSnapshot { if (this.phaseValue !== 'running') throw new Error('match can only pause while running'); this.phaseValue = 'paused'; return this.snapshot; }
  resume(): ModelMatchSnapshot { if (this.phaseValue !== 'paused') throw new Error('match can only resume while paused'); this.phaseValue = 'running'; return this.snapshot; }
  step(humanAction: 0 | 1): ModelMatchSnapshot {
    if (humanAction !== 0 && humanAction !== 1) throw new RangeError('human action must be 0 or 1');
    if (this.phaseValue !== 'running') return this.snapshot;
    for (const p of this.participants) {
      if (p.result) continue;
      const action = p.id === 'D' ? humanAction : p.policy!.deterministicAction(p.environment.getObservation());
      const transition = p.environment.step(action); p.score = p.environment.pipesPassed;
      if (transition.done && transition.result) p.result = transition.result;
    }
    if (this.participants.every(p => p.result)) this.phaseValue = 'completed';
    return this.snapshot;
  }
  nextTest(): ModelMatchSnapshot { if (this.phaseValue !== 'completed' || this.testValue >= 2) throw new Error('no next test available'); this.reset(this.testValue + 1); return this.snapshot; }
  restart(): ModelMatchSnapshot { if (this.phaseValue !== 'completed') throw new Error('match can only restart after completion'); this.reset(0); return this.snapshot; }
  recordsForCompletedTest(attempt = this.testValue + 1): readonly EvaluationRecord[] {
    if (this.phaseValue !== 'completed') return Object.freeze([]);
    return Object.freeze(this.participants.map(p => {
      const result = p.result!; const model = p.model;
      const budget = model ? { demonstrationSeconds: model.stage === 'initial' ? 0 : this.budget.demonstrationSeconds, supervisedUpdates: model.trainingCounts.supervisedUpdates, trainingEpisodes: model.trainingCounts.reinforcementEpisodes, interactions: model.stage === 'post_rl' ? this.budget.practiceSteps : 0, wallTimeMs: model.stage === 'post_rl' ? this.budget.practiceElapsedMs : 0 } : { demonstrationSeconds: 0, supervisedUpdates: 0, trainingEpisodes: 0, interactions: 0, wallTimeMs: 0 };
      const modelId = model ? stableIdentity({ stage: model.stage, parameters: flattenPolicyParameters(model.parameters) }) : 'human-no-identity';
      return validateEvaluationRecord({ schemaVersion: 1, game: 'flappy', controller: model?.stage ?? 'human', modelId, sequenceId: `${FLAPPY_SEQUENCE_VERSION}:${MODEL_MATCH_SEEDS[this.testValue]}`, seed: MODEL_MATCH_SEEDS[this.testValue], attempt, mode: 'validation', configVersion: FLAPPY_WORLD_CONFIG_VERSION, observationVersion: FLAPPY_OBSERVATION_VERSION, budget, result });
    }));
  }
}
