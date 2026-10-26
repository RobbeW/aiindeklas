import { WORKLOADS } from '../config/workload-presets.ts';
import type { DemonstrationEpisode } from '../data/demonstrations.ts';
import { classBalance, validateEpisode } from '../data/dataset.ts';
import { createInitialPolicyParameters, BernoulliPolicy } from '../learning/policy.ts';
import { createPolicySnapshot, restorePolicySnapshot, type PolicySnapshot } from '../learning/policy-snapshot.ts';
import { runImitationJob, type ImitationJobInput, type ImitationJobResult, type ImitationProgress } from '../learning/imitation-job.ts';
import { WorkerJobClient, WorkerJobCancelledError } from '../core/worker-client.ts';
import type { WorkerPort } from '../core/worker-protocol.ts';
import { FlappyEnvironment } from './environment.ts';
import { PHYSICS } from './physics.ts';

export const TEACH_INITIALIZATION_SEED = 1222;
export const TEACH_CLONE_TEST_SEED = 2005;
export const TEACH_UPDATE_BUDGET = WORKLOADS.supervisedUpdates;
export const TEACH_LEARNING_RATE = 0.01;

function createInitialSnapshot(): PolicySnapshot {
  return createPolicySnapshot(new BernoulliPolicy(TEACH_INITIALIZATION_SEED, createInitialPolicyParameters(TEACH_INITIALIZATION_SEED)), { stage: 'initial' });
}

/** A deterministic controller restored from an immutable snapshot. It selects from each new observation. */
export class FrozenCloneController {
  readonly snapshot: PolicySnapshot;
  private readonly policy: BernoulliPolicy;

  constructor(snapshot: PolicySnapshot) {
    this.snapshot = createPolicySnapshot(restorePolicySnapshot(snapshot), snapshot);
    this.policy = restorePolicySnapshot(this.snapshot);
  }

  selectAction(observation: readonly number[]): 0 | 1 {
    return this.policy.deterministicAction(observation);
  }
}

export interface CloneResult {
  readonly seed: number;
  readonly pipesPassed: number;
  readonly survivalSteps: number;
  readonly reason: string;
}

/** Deterministic, frozen evaluation helper for tests and compact state consumers. */
export function evaluateFrozenClone(snapshot: PolicySnapshot, seed = TEACH_CLONE_TEST_SEED): CloneResult {
  if (seed < 2000 || seed > 2099 || !Number.isSafeInteger(seed)) throw new RangeError('clone evaluation requires a validation seed 2000..2099');
  const environment = new FlappyEnvironment();
  environment.reset({ seed });
  const controller = new FrozenCloneController(snapshot);
  while (true) {
    const result = environment.step(controller.selectAction(environment.getObservation()));
    if (result.done) return Object.freeze({ seed, pipesPassed: result.result?.pipesPassed ?? 0, survivalSteps: result.result?.survivalSteps ?? environment.world.steps, reason: result.reason ?? 'unknown' });
  }
}

export interface ImitationControllerOptions {
  readonly allowTrainingOnly?:boolean;
  readonly initialSnapshot?:PolicySnapshot;
  readonly imitationSnapshot?:PolicySnapshot;
  readonly createWorker?: () => WorkerPort;
  readonly onStateChange?: () => void;
}

export interface ImitationController {
  readonly initialSnapshot: PolicySnapshot;
  getImitationSnapshot(): PolicySnapshot | undefined;
  train(episodes: readonly DemonstrationEpisode[], onProgress?: (progress: ImitationProgress) => void): Promise<ImitationJobResult>;
  cancel(): void;
  dispose(): void;
}

function browserWorker(): WorkerPort {
  return new Worker(new URL('../workers/imitation.worker.ts', import.meta.url), { type: 'module' }) as unknown as WorkerPort;
}

/** Owns separate frozen initial/trained snapshots and one explicit supervised worker job. */
export function createImitationController(options: ImitationControllerOptions = {}): ImitationController {
  const initialSnapshot = options.initialSnapshot?createPolicySnapshot(restorePolicySnapshot(options.initialSnapshot),options.initialSnapshot):createInitialSnapshot();
  let imitationSnapshot: PolicySnapshot | undefined=options.imitationSnapshot?createPolicySnapshot(restorePolicySnapshot(options.imitationSnapshot),options.imitationSnapshot):undefined;
  let disposed = false;
  let epoch=0;
  const workerJobs = new WorkerJobClient<ImitationJobInput, ImitationProgress, ImitationJobResult>(options.createWorker ?? browserWorker);
  return {
    initialSnapshot,
    getImitationSnapshot: () => imitationSnapshot,
    async train(episodes, onProgress) {
      const token=++epoch;
      if (disposed) throw new Error('imitation controller is disposed');
      if (episodes.length < (options.allowTrainingOnly?1:2)) throw new Error('Neem eerst een volledige poging op.');
      const checked = episodes.map(validateEpisode);
      const training = checked.filter((episode) => episode.seed >= 1000 && episode.seed <= 1999);
      const validation = checked.filter((episode) => episode.seed >= 2000 && episode.seed <= 2099);
      if (training.length === 0 || (!options.allowTrainingOnly&&validation.length === 0)) throw new Error('Verzamel een trainingsaflevering (1000–1999) én een validatieaflevering (2000–2099).');
      const trainingBalance = classBalance(training.flatMap((episode) => episode.frames));
      const validationBalance = classBalance(validation.flatMap((episode) => episode.frames));
      if (!options.allowTrainingOnly&&(trainingBalance.flaps === 0 || trainingBalance.waits === 0 || validationBalance.flaps === 0 || validationBalance.waits === 0)) {
        throw new Error('Elke trainings- en validatiesplit heeft zowel flaps als wachten nodig.');
      }
      const input: ImitationJobInput = {
        initialSnapshot, episodes: Object.freeze(checked), validationEpisodeIds: validation.map((episode) => episode.id),allowTrainingOnly:options.allowTrainingOnly,
        updateBudget: TEACH_UPDATE_BUDGET, learningRate: TEACH_LEARNING_RATE, optimizer: 'adam', trainingSeed: 1222,
      };
      const job = workerJobs.start(input, onProgress);
      const result = await job.promise;
      if (disposed||token!==epoch) throw new WorkerJobCancelledError('Training result is no longer current');
      imitationSnapshot = result.snapshot;
      options.onStateChange?.();
      return result;
    },
    cancel: () => {epoch++;workerJobs.cancel();},
    dispose() { if (!disposed) { disposed = true;epoch++; workerJobs.dispose(); } },
  };
}

/** Lightweight synchronous path used by focused tests; production UI uses the real worker above. */
export async function trainImitationDirect(episodes: readonly DemonstrationEpisode[]): Promise<ImitationJobResult> {
  const validation = episodes.filter((episode) => episode.seed >= 2000 && episode.seed <= 2099);
  return runImitationJob({ initialSnapshot: createInitialSnapshot(), episodes, validationEpisodeIds: validation.map((episode) => episode.id), updateBudget: TEACH_UPDATE_BUDGET, learningRate: TEACH_LEARNING_RATE, optimizer: 'adam', trainingSeed: 1222 }, { yieldControl: async () => undefined });
}

export const TEACH_FIXED_STEP_SECONDS = PHYSICS.dt;
export { WorkerJobCancelledError };
