import type { RandomSource } from "./contracts.ts";

/** Create an independent, reproducible random stream from an integer seed. */
export function createSeededRandom(seed: number): RandomSource {
  if (!Number.isSafeInteger(seed)) {
    throw new RangeError("seed must be a finite safe integer");
  }

  // Mulberry32: small, deterministic, and entirely independent of runtime globals.
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 0x1_0000_0000;
  };
}

/** Return an inclusive integer in [minimum, maximum] from a caller-owned source. */
export function randomInteger(
  random: RandomSource,
  minimum: number,
  maximum: number,
): number {
  if (typeof random !== "function") {
    throw new TypeError("random must be a function");
  }
  if (!Number.isSafeInteger(minimum) || !Number.isSafeInteger(maximum)) {
    throw new RangeError("range bounds must be finite safe integers");
  }
  if (maximum < minimum) {
    throw new RangeError("maximum must be greater than or equal to minimum");
  }
  const sample = random();
  if (!Number.isFinite(sample) || sample < 0 || sample >= 1) {
    throw new RangeError("random source must return a finite value in [0, 1)");
  }
  const width = maximum - minimum + 1;
  if (!Number.isSafeInteger(width)) {
    throw new RangeError("range width must be a finite safe integer");
  }
  return minimum + Math.floor(sample * width);
}
