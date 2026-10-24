import test from 'node:test';
import assert from 'node:assert/strict';
import { CarPolicy } from '../src/car/policy-adapter.ts';
import { createGenome, genomePolicy, validateGenome } from '../src/evolution/genome.ts';
import { genomeAction } from '../src/evolution/inference.ts';
import { mutateGenome } from '../src/evolution/mutation.ts';
import { crossoverGenomes } from '../src/evolution/crossover.ts';
import { genomeDistance, groupGenomes } from '../src/evolution/species.ts';
import { nextGeneration } from '../src/evolution/reproduction.ts';
import { createSeededRandom } from '../src/core/random.ts';

const obs = [0.17, 0.33, 0.51, 0.72, 0.84, 0.93];
const seq = (...values: number[]) => { let i = 0; return () => values[i++ % values.length]!; };

test('genome canonicalization, all 83 inference positions, and immutability', () => {
  const parameters = Array.from({ length: 83 }, (_, i) => Math.sin(i * 0.17));
  const genome = createGenome('known', 0, 22, parameters);
  const direct = new CarPolicy(22, parameters);
  assert.equal(genomeAction(genome, obs), direct.action(obs));
  assert.deepEqual(genomePolicy(genome).parameters, parameters);
  const copy = validateGenome(structuredClone(genome));
  assert.deepEqual(copy, genome);
  assert.ok(Object.isFrozen(copy) && Object.isFrozen(copy.parameters) && Object.isFrozen(copy.parents));
  assert.throws(() => { (copy.parameters as number[])[0] = 1; }, TypeError);
  assert.throws(() => validateGenome({ ...genome, parents: undefined }));
  assert.throws(() => createGenome('', 0, 0));
  assert.throws(() => createGenome('x', -1, 0));
  assert.throws(() => createGenome('x', 0, NaN));
});

test('mutation is seeded, bounded, immutable, and validates every draw', () => {
  const p = createGenome('p', 0, 1, Array(83).fill(8));
  const before = [...p.parameters];
  const a = mutateGenome(p, 'a', 1, createSeededRandom(99));
  const b = mutateGenome(p, 'b', 1, createSeededRandom(99));
  assert.deepEqual(a.parameters, b.parameters);
  assert.ok(a.parameters.every((x) => x >= -8 && x <= 8));
  assert.deepEqual(p.parameters, before);
  assert.throws(() => mutateGenome(p, 'bad', 1, () => 1), /\[0, 1\)/);
});

test('crossover takes explicit homologous parent positions and rejects invalid RNG', () => {
  const a = createGenome('a', 0, 1, Array(83).fill(-2));
  const b = createGenome('b', 0, 2, Array(83).fill(3));
  const child = crossoverGenomes(a, b, 'c', 1, seq(0, 0.75));
  assert.equal(child.parameters[0], -2);
  assert.equal(child.parameters[1], 3);
  assert.deepEqual(child.parents, ['a', 'b']);
  assert.throws(() => crossoverGenomes(a, b, 'bad', 1, () => NaN));
});

test('RMS distance and sorted greedy groups use lexicographic representatives', () => {
  const z = createGenome('z', 0, 0, Array(83).fill(0));
  const a = createGenome('a', 0, 0, Array(83).fill(0.2));
  const b = createGenome('b', 0, 0, Array(83).fill(0.8));
  assert.ok(Math.abs(genomeDistance(z, a) - 0.2) < 1e-12);
  assert.ok(Math.abs(genomeDistance(z, b) - 0.8) < 1e-12);
  const groups = groupGenomes([z, b, a]);
  assert.equal(groups.length, 2);
  assert.equal(groups[0]!.representative.id, 'a');
  assert.deepEqual(groups[0]!.members.map((g) => g.id), ['a', 'z']);
  assert.equal(groupGenomes([]).length, 0);
});

test('reproduction validates fitness, keeps one elite, resolves ties, and preserves sizes', () => {
  for (const size of [4, 5]) {
    const population = Array.from({ length: size }, (_, i) => createGenome(`p${i}`, 0, i, Array(83).fill(i / 10)));
    const scores = population.map((g, i) => ({ id: g.id, fitness: i === size - 1 ? 10 : 1 }));
    const result = nextGeneration(population, scores, 1, createSeededRandom(17));
    assert.equal(result.length, size);
    assert.deepEqual(result.map((g) => g.id), Array.from({ length: size }, (_, i) => `g1-a${i}`));
    assert.deepEqual(result[0]!.parameters, population[size - 1]!.parameters);
    assert.deepEqual(result[0]!.parents, [population[size - 1]!.id]);
    assert.ok(result.every((g) => g.generation === 1 && g.parameters.every((x) => x >= -8 && x <= 8)));
    const tied = nextGeneration(population, population.map((g) => ({ id: g.id, fitness: 2 })), 1, createSeededRandom(17));
    assert.deepEqual(tied[0]!.parameters, population[0]!.parameters);
    assert.throws(() => nextGeneration(population, scores.slice(1), 1, createSeededRandom(1)));
    assert.throws(() => nextGeneration(population, [...scores, scores[0]!], 1, createSeededRandom(1)));
    assert.throws(() => nextGeneration(population, scores.map((x, i) => i ? x : { ...x, fitness: NaN }), 1, createSeededRandom(1)));
  }
});
