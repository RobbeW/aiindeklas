import type { RandomSource } from "../core/contracts.ts";
import { createGenome, validateGenome, type Genome } from "./genome.ts";
import { crossoverGenomes } from "./crossover.ts";
import { mutateGenome } from "./mutation.ts";
import { groupGenomes } from "./species.ts";

export interface GenomeFitness { readonly id: string; readonly fitness: number }

function draw(rng: RandomSource): number {
  if (typeof rng !== "function") throw new TypeError("rng must be a function");
  const n = rng();
  if (!Number.isFinite(n) || n < 0 || n >= 1) throw new RangeError("rng must return a finite value in [0, 1)");
  return n;
}

function rank(a: Genome, b: Genome, scores: ReadonlyMap<string, number>): number {
  const d = scores.get(b.id)! - scores.get(a.id)!;
  return d || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
}

function tournament(members: readonly Genome[], scores: ReadonlyMap<string, number>, rng: RandomSource): Genome {
  const first = members[Math.floor(draw(rng) * members.length)]!;
  const second = members[Math.floor(draw(rng) * members.length)]!;
  return rank(first, second, scores) <= 0 ? first : second;
}

export function nextGeneration(population: readonly Genome[], fitness: readonly GenomeFitness[], generation: number, rng: RandomSource): readonly Genome[] {
  if (!Number.isSafeInteger(generation) || generation < 0) throw new RangeError("generation must be a non-negative safe integer");
  if (population.length < 4 || population.length > 32) throw new RangeError("population size must be between 4 and 32");
  if (typeof rng !== "function") throw new TypeError("rng must be a function");
  const parents = population.map(validateGenome);
  const ids = parents.map((g) => g.id);
  if (new Set(ids).size !== ids.length) throw new RangeError("population genome IDs must be unique");
  if (!Array.isArray(fitness) || fitness.length !== population.length) throw new RangeError("fitness must contain exactly one score per genome");
  const scores = new Map<string, number>();
  for (const entry of fitness) {
    if (!entry || typeof entry.id !== "string" || !Number.isFinite(entry.fitness) || scores.has(entry.id))
      throw new RangeError("fitness entries require unique IDs and finite scores");
    scores.set(entry.id, entry.fitness);
  }
  if (ids.some((id) => !scores.has(id)) || [...scores.keys()].some((id) => !ids.includes(id)))
    throw new RangeError("fitness IDs must exactly match population IDs");

  const ranked = [...parents].sort((a, b) => rank(a, b, scores));
  const elite = ranked[0]!;
  const children: Genome[] = [createGenome(`g${generation}-a0`, generation, elite.initializationSeed, elite.parameters, [elite.id])];
  const groups = groupGenomes(parents);
  for (let i = 1; i < population.length; i++) {
    const group = groups[(i - 1) % groups.length]!;
    const a = tournament(group.members, scores, rng);
    const b = tournament(group.members, scores, rng);
    const crossed = crossoverGenomes(a, b, `g${generation}-x${i}`, generation, rng);
    const mutated = mutateGenome(crossed, `g${generation}-a${i}`, generation, rng);
    children.push(createGenome(mutated.id, generation, mutated.initializationSeed, mutated.parameters, [a.id, b.id]));
  }
  return Object.freeze(children);
}
