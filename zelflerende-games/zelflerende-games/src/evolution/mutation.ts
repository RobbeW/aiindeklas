import type { RandomSource } from "../core/contracts.ts";
import { createGenome, validateGenome, type Genome } from "./genome.ts";

function draw(rng: RandomSource): number {
  if (typeof rng !== "function") throw new TypeError("rng must be a function");
  const n = rng();
  if (!Number.isFinite(n) || n < 0 || n >= 1) throw new RangeError("rng must return a finite value in [0, 1)");
  return n;
}

function gaussian(rng: RandomSource): number {
  const u1 = Math.max(draw(rng), Number.MIN_VALUE);
  const u2 = draw(rng);
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}

export function mutateGenome(parent: Genome, childId: string, generation: number, rng: RandomSource): Genome {
  const source = validateGenome(parent);
  const values = source.parameters.map((value) => {
    if (draw(rng) < 0.02) return draw(rng) * 2 - 1;
    if (draw(rng) < 0.2) return Math.max(-8, Math.min(8, value + gaussian(rng) * 0.35));
    return value;
  });
  return createGenome(childId, generation, source.initializationSeed, values, [source.id]);
}
