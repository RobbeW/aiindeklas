import type { Observation } from "../core/contracts.ts";
import { genomePolicy, type Genome } from "./genome.ts";

/** Evaluate the fixed categorical policy; ties follow CarPolicy's stable first-action rule. */
export function genomeAction(genome: Genome, observation: Observation): 0 | 1 | 2 {
  return genomePolicy(genome).action(observation);
}
