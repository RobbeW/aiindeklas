import { DemonstrationRecorder } from './recorder.ts';
import type { DemonstrationEpisode } from '../data/demonstrations.ts';

/** Generate a transparent, labelled teaching fixture with the ordinary recorder.
 * It is synthetic reference data, never student data or a pretrained policy.
 */
export function generateReferenceDemonstration(seed: number, id = `reference-${seed}`): DemonstrationEpisode {
  if (!Number.isSafeInteger(seed) || ((seed < 1000 || seed > 1999) && (seed < 2000 || seed > 2099)) || seed === 2005) {
    throw new RangeError('reference seed must be in the training or validation namespace');
  }
  const recorder = new DemonstrationRecorder();
  recorder.start(id, seed, 'synthetic_reference');
  while (true) {
    const world = recorder.environment.world;
    const pipe = world.pipes.find((candidate) => candidate.x + 52 >= 62);
    if (!pipe) throw new Error('reference episode has no upcoming pipe');
    const observation = recorder.environment.getObservation();
    // y and gap center are both normalized to the same [-1, 1] vertical scale.
    const gapCenter = ((observation[3] ?? 0) + (observation[4] ?? 0)) / 2;
    const action = (observation[0]! > gapCenter + 0.02 && observation[1]! >= 0 ? 1 : 0) as 0 | 1;
    if (recorder.step(action).done) break;
  }
  const episode = recorder.completedEpisode;
  if (!episode) throw new Error('reference recorder ended without a complete episode');
  return episode;
}

/** Generate one role-labelled training and validation episode for the worked example. */
export function generateReferencePair(trainingSeed = 1000, validationSeed = 2000): readonly [DemonstrationEpisode, DemonstrationEpisode] {
  return Object.freeze([
    generateReferenceDemonstration(trainingSeed, `reference-training-${trainingSeed}`),
    generateReferenceDemonstration(validationSeed, `reference-validation-${validationSeed}`),
  ]);
}
