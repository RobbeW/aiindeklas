import type { Controller, Observation } from "../core/contracts.ts";
import { createSeededRandom } from "../core/random.ts";
import { OBSERVATION_INPUT_COUNT } from "./environment.ts";

/** An explicitly untrained opponent: its action stream never consumes world RNG. */
export function createUntrainedController(seed: number, flapProbability = 0.08): Controller<0 | 1> & {
  readonly label: string;
  readonly seed: number;
  readonly flapProbability: number;
} {
  if (!Number.isFinite(flapProbability) || flapProbability < 0 || flapProbability > 1) {
    throw new RangeError("flap probability must be finite and in [0, 1]");
  }
  const random = createSeededRandom(seed);
  return Object.freeze({
    label: "Ongetraind · willekeurige acties",
    seed,
    flapProbability,
    selectAction(observation: Observation): 0 | 1 {
      if (observation.length !== OBSERVATION_INPUT_COUNT || observation.some((x) => !Number.isFinite(x))) {
        throw new RangeError("baseline expects five finite observation values");
      }
      return random() < flapProbability ? 1 : 0;
    },
  });
}
