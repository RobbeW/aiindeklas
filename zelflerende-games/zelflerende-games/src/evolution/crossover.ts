import type { RandomSource } from "../core/contracts.ts";
import { createGenome, validateGenome, type Genome } from "./genome.ts";

function draw(rng: RandomSource): number {
  if (typeof rng !== "function") throw new TypeError("rng must be a function");
  const n = rng();
  if (!Number.isFinite(n) || n < 0 || n >= 1) throw new RangeError("rng must return a finite value in [0, 1)");
  return n;
}

export function crossoverGenomes(a: Genome, b: Genome, childId: string, generation: number, rng: RandomSource): Genome {
  const first = validateGenome(a), second = validateGenome(b);
  const parameters = first.parameters.map((v, i) => draw(rng) < 0.5 ? v : second.parameters[i]!);
  return createGenome(childId, generation, first.initializationSeed, parameters, [first.id, second.id]);
}
