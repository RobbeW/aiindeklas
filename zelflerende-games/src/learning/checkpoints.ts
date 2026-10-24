import type { ModelStage } from '../core/contracts.ts';
import { createPolicySnapshot,restorePolicySnapshot,type PolicySnapshot } from './policy-snapshot.ts';

export interface CheckpointConfiguration {
  readonly supervisedLearningRate:number;
  readonly reinforcementLearningRate:number;
  readonly gradientNormCap:number;
  readonly batchSeed:number;
  readonly actionSeeds:readonly number[];
}
export interface LearningCheckpoint {
  readonly name:ModelStage;
  readonly snapshot:PolicySnapshot;
  readonly configuration:CheckpointConfiguration;
}
/** Save-once names prevent a later job silently replacing its baseline. */
export class LearningCheckpoints {
  private readonly saved=new Map<ModelStage,LearningCheckpoint>();
  save(snapshot:PolicySnapshot,configuration:CheckpointConfiguration):LearningCheckpoint {
    if (this.saved.has(snapshot.stage)) throw new Error(`checkpoint ${snapshot.stage} already saved`);
    const live=restorePolicySnapshot(snapshot);
    for (const n of [configuration.supervisedLearningRate,configuration.reinforcementLearningRate,configuration.gradientNormCap]) {
      if (!Number.isFinite(n) || n<=0) throw new Error('invalid checkpoint learning configuration');
    }
    if (!Number.isSafeInteger(configuration.batchSeed) || !Array.isArray(configuration.actionSeeds) ||
      configuration.actionSeeds.some(n=>!Number.isSafeInteger(n))) throw new Error('invalid checkpoint seeds');
    if (snapshot.stage !== 'initial' && (!snapshot.datasetProvenance.length || !snapshot.trainingSeeds.length || snapshot.trainingCounts.supervisedUpdates<1)) {
      throw new Error('trained checkpoint requires dataset/seeds/count provenance');
    }
    if (snapshot.stage === 'initial' && (snapshot.trainingCounts.supervisedUpdates || snapshot.trainingCounts.reinforcementEpisodes)) throw new Error('initial checkpoint has training');
    if (snapshot.stage === 'post_rl' && snapshot.trainingCounts.reinforcementEpisodes<1) throw new Error('post_rl checkpoint has no RL episodes');
    const checkpoint=Object.freeze({name:snapshot.stage,snapshot:createPolicySnapshot(live,snapshot),
      configuration:Object.freeze({...configuration,actionSeeds:Object.freeze([...configuration.actionSeeds])})});
    this.saved.set(snapshot.stage,checkpoint);
    return checkpoint;
  }
  get(name:ModelStage):LearningCheckpoint {
    const value=this.saved.get(name);
    if (!value) throw new Error(`missing checkpoint ${name}`);
    return value;
  }
}
