import type { Observation } from '../core/contracts.ts';
import type { FlappyEpisodeResult } from '../flappy/environment.ts';

export const DEMONSTRATION_VERSION = 'flappy-demonstrations-v1' as const;
export interface DemonstrationFrame {
  readonly step: number;
  readonly observation: Observation;
  readonly action: 0 | 1;
}
export interface DemonstrationEpisode {
  readonly version: typeof DEMONSTRATION_VERSION;
  readonly id: string;
  readonly source: 'human' | 'synthetic_reference';
  readonly seed: number;
  readonly worldVersion: string;
  readonly observationVersion: string;
  readonly sequenceVersion: string;
  readonly durationSeconds: number;
  readonly frames: readonly DemonstrationFrame[];
  readonly result: Readonly<FlappyEpisodeResult>;
}
