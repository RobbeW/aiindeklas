import { createSeededRandom, randomInteger } from "../core/random.ts";

export const PIPE_SEQUENCE_VERSION = "flappy-pipes-v1" as const;
export const PIPE_GAP_CENTER_MIN = 120;
export const PIPE_GAP_CENTER_MAX = 320;

export interface PipeSpec {
  readonly index: number;
  readonly gapCenter: number;
}

/** Build a seed/index-stable immutable pipe sequence for one environment. */
export function generatePipeSequence(seed: number, count: number): readonly PipeSpec[] {
  if (!Number.isSafeInteger(seed)) {
    throw new RangeError("seed must be a finite safe integer");
  }
  if (!Number.isSafeInteger(count) || count < 0) {
    throw new RangeError("count must be a non-negative finite safe integer");
  }

  const random = createSeededRandom(seed);
  const sequence: PipeSpec[] = [];
  for (let index = 0; index < count; index += 1) {
    sequence.push(Object.freeze({
      index,
      gapCenter: randomInteger(random, PIPE_GAP_CENTER_MIN, PIPE_GAP_CENTER_MAX),
    }));
  }
  return Object.freeze(sequence);
}
