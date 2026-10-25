import { validateGenome, type Genome } from "./genome.ts";

export const GROUP_DISTANCE_THRESHOLD = 0.35;
export interface GenomeGroup { readonly id: string; readonly representative: Genome; readonly members: readonly Genome[] }

export function genomeDistance(a: Genome, b: Genome): number {
  a=validateGenome(a);b=validateGenome(b);
  if (a.parameters.length !== 83 || b.parameters.length !== 83) throw new RangeError("genomes must have 83 parameters");
  let sum = 0;
  for (let i = 0; i < 83; i++) sum += (a.parameters[i]! - b.parameters[i]!) ** 2;
  return Math.sqrt(sum / 83);
}

export function groupGenomes(population: readonly Genome[]): readonly GenomeGroup[] {
  const sorted = population.map(validateGenome).sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
  if (new Set(sorted.map((g) => g.id)).size !== sorted.length) throw new RangeError("genome IDs must be unique");
  const groups: { id: string; representative: Genome; members: Genome[] }[] = [];
  for (const genome of sorted) {
    const group = groups.find((g) => genomeDistance(genome, g.representative) <= GROUP_DISTANCE_THRESHOLD);
    if (group) group.members.push(genome);
    else groups.push({ id: genome.id, representative: genome, members: [genome] });
  }
  return Object.freeze(groups.map((g) => Object.freeze({ ...g, members: Object.freeze([...g.members]) })));
}
