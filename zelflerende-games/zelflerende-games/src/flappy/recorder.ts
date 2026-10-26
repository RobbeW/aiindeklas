import { DEMONSTRATION_VERSION, type DemonstrationEpisode, type DemonstrationFrame } from '../data/demonstrations.ts';
import { FlappyEnvironment, FLAPPY_WORLD_CONFIG_VERSION, FLAPPY_OBSERVATION_VERSION, FLAPPY_SEQUENCE_VERSION } from './environment.ts';
import { PHYSICS } from './physics.ts';

/** Call step only when the simulation advances. Pausing records nothing. Restart discards an incomplete episode. */
export class DemonstrationRecorder {
  readonly environment = new FlappyEnvironment();
  private frames: DemonstrationFrame[] = [];
  private metadata: { id: string; seed: number; source: DemonstrationEpisode['source'] } | undefined;
  private saved: DemonstrationEpisode | undefined;

  start(id: string, seed: number, source: DemonstrationEpisode['source'] = 'human') {
    if (!id.trim() || !['human', 'synthetic_reference'].includes(source)) throw new Error('invalid episode identity/source');
    const observation = this.environment.reset({ seed });
    this.metadata = { id, seed, source };
    this.frames = [];
    this.saved = undefined;
    return observation;
  }

  step(action: 0 | 1) {
    if (!this.metadata || this.saved) throw new Error('start a new recording episode');
    const frame = Object.freeze({ step: this.frames.length, observation: Object.freeze([...this.environment.getObservation()]), action });
    const transition = this.environment.step(action);
    this.frames.push(frame);
    if (transition.done && transition.result) {
      this.saved = Object.freeze({
        version: DEMONSTRATION_VERSION, ...this.metadata,
        worldVersion: FLAPPY_WORLD_CONFIG_VERSION, observationVersion: FLAPPY_OBSERVATION_VERSION,
        sequenceVersion: FLAPPY_SEQUENCE_VERSION,
        durationSeconds: this.frames.length * PHYSICS.dt,
        frames: Object.freeze([...this.frames]), result: transition.result,
      });
    }
    return transition;
  }

  get completedEpisode(): DemonstrationEpisode | undefined { return this.saved; }
}
