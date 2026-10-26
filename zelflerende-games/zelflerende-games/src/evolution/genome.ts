import { CAR_POLICY_PARAMETER_COUNT, CarPolicy } from "../car/policy-adapter.ts";

export const GENOME_PARAMETER_COUNT = CAR_POLICY_PARAMETER_COUNT;
export const GENOME_PARAMETER_MIN = -8;
export const GENOME_PARAMETER_MAX = 8;

export interface Genome {
  readonly kind: "car-genome";
  readonly schemaVersion: 1;
  readonly id: string;
  readonly generation: number;
  readonly parents: readonly string[];
  readonly initializationSeed: number;
  readonly parameters: readonly number[];
}

function validParameters(value: unknown): number[] {
  if (!Array.isArray(value) || value.length !== GENOME_PARAMETER_COUNT ||
      value.some((v) => typeof v !== "number" || !Number.isFinite(v) || v < -8 || v > 8))
    throw new RangeError("genome parameters must contain exactly 83 finite values in [-8, 8]");
  return [...value];
}

function canonical(input: { id: string; generation: number; initializationSeed: number; parameters: readonly number[]; parents?: readonly string[] }): Genome {
  if (typeof input.id !== "string" || !input.id.trim()) throw new RangeError("genome id must be a non-empty string");
  if (!Number.isSafeInteger(input.generation) || input.generation < 0) throw new RangeError("generation must be a non-negative safe integer");
  if (!Number.isSafeInteger(input.initializationSeed)) throw new RangeError("initializationSeed must be a safe integer");
  const parents = input.parents ?? [];
  if (!Array.isArray(parents) || parents.some((id) => typeof id !== "string" || !id.trim())) throw new RangeError("parents must be non-empty string IDs");
  return Object.freeze({ kind: "car-genome", schemaVersion: 1, id: input.id, generation: input.generation,
    parents: Object.freeze([...parents]), initializationSeed: input.initializationSeed,
    parameters: Object.freeze(validParameters(input.parameters)) });
}

export function createGenome(id: string, generation: number, initializationSeed: number, parameters?: readonly number[], parents?: readonly string[]): Genome {
  const initialized = parameters ?? new CarPolicy(initializationSeed).parameters;
  return canonical({ id, generation, initializationSeed, parameters: initialized, parents });
}

export function validateGenome(value: unknown): Genome {
  if (!value || typeof value !== "object") throw new RangeError("genome must be an object");
  const g = value as Record<string, unknown>;
  if (g.kind !== "car-genome" || g.schemaVersion !== 1 || !Array.isArray(g.parents)) throw new RangeError("unsupported genome kind, schema, or metadata");
  return canonical({ id: g.id as string, generation: g.generation as number, initializationSeed: g.initializationSeed as number,
    parameters: g.parameters as readonly number[], parents: g.parents as readonly string[] });
}

export function genomePolicy(genome: Genome): CarPolicy {
  const g = validateGenome(genome);
  return new CarPolicy(g.initializationSeed, g.parameters);
}
