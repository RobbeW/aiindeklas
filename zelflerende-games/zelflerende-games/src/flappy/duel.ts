import type { Controller } from "../core/contracts.ts";
import { createUntrainedController } from "./baseline.ts";
import { FlappyEnvironment, type FlappyEpisodeResult } from "./environment.ts";
import type { WorldState } from "./world.ts";

export const DUEL_SEQUENCE_SEED = 2000;
export const DUEL_OPPONENT_SEED = DUEL_SEQUENCE_SEED + 10_000;

export type DuelPhase = "ready" | "running" | "paused" | "finished";
export type DuelWinner = "player" | "computer" | "tie";

export interface DuelCompletion {
  readonly player: Readonly<FlappyEpisodeResult>;
  readonly computer: Readonly<FlappyEpisodeResult>;
  readonly winner: DuelWinner;
}

export interface DuelSnapshot {
  readonly phase: DuelPhase;
  readonly playerWorld: WorldState;
  readonly computerWorld: WorldState;
  readonly playerResult: Readonly<FlappyEpisodeResult> | undefined;
  readonly computerResult: Readonly<FlappyEpisodeResult> | undefined;
  readonly playerPipesPassed: number;
  readonly computerPipesPassed: number;
  readonly completion: Readonly<DuelCompletion> | undefined;
}

export interface FlappyDuelOptions {
  /** Test hook; a fresh controller is created with the same seed on each restart. */
  readonly computerControllerFactory?: (seed: number) => Controller<0 | 1>;
}

function pipeSequenceMatches(left: WorldState, right: WorldState): boolean {
  return left.pipes.length === right.pipes.length && left.pipes.every((pipe, index) => {
    const other = right.pipes[index];
    return other !== undefined && pipe.index === other.index &&
      pipe.x === other.x && pipe.gapCenter === other.gapCenter;
  });
}

export function compareDuelResults(
  player: Readonly<FlappyEpisodeResult>,
  computer: Readonly<FlappyEpisodeResult>,
): DuelWinner {
  if (player.pipesPassed !== computer.pipesPassed) {
    return player.pipesPassed > computer.pipesPassed ? "player" : "computer";
  }
  if (player.survivalSteps !== computer.survivalSteps) {
    return player.survivalSteps > computer.survivalSteps ? "player" : "computer";
  }
  return "tie";
}

/** Pure simulation coordinator for one human-versus-untrained Flappy duel. */
export class FlappyDuelSession {
  private readonly playerEnvironment = new FlappyEnvironment();
  private readonly computerEnvironment = new FlappyEnvironment();
  private readonly controllerFactory: (seed: number) => Controller<0 | 1>;
  private computerController: Controller<0 | 1>;
  private currentPhase: DuelPhase = "ready";
  private playerCompletion: Readonly<FlappyEpisodeResult> | undefined;
  private computerCompletion: Readonly<FlappyEpisodeResult> | undefined;
  private finalCompletion: Readonly<DuelCompletion> | undefined;

  constructor(options: FlappyDuelOptions = {}) {
    this.controllerFactory = options.computerControllerFactory ?? ((seed) => createUntrainedController(seed));
    this.playerEnvironment.reset({ seed: DUEL_SEQUENCE_SEED });
    this.computerEnvironment.reset({ seed: DUEL_SEQUENCE_SEED });
    if (!pipeSequenceMatches(this.playerEnvironment.world, this.computerEnvironment.world)) {
      throw new Error("Duel sides must use an identical pipe sequence.");
    }
    this.computerController = this.controllerFactory(DUEL_OPPONENT_SEED);
  }

  get snapshot(): DuelSnapshot {
    return Object.freeze({
      phase: this.currentPhase,
      playerWorld: this.playerEnvironment.world,
      computerWorld: this.computerEnvironment.world,
      playerResult: this.playerCompletion,
      computerResult: this.computerCompletion,
      playerPipesPassed: this.playerEnvironment.pipesPassed,
      computerPipesPassed: this.computerEnvironment.pipesPassed,
      completion: this.finalCompletion,
    });
  }

  start(): DuelSnapshot {
    if (this.currentPhase === "ready") this.currentPhase = "running";
    return this.snapshot;
  }

  pause(): DuelSnapshot {
    if (this.currentPhase === "running") this.currentPhase = "paused";
    return this.snapshot;
  }

  resume(): DuelSnapshot {
    if (this.currentPhase === "paused") this.currentPhase = "running";
    return this.snapshot;
  }

  restart(): DuelSnapshot {
    this.playerEnvironment.reset({ seed: DUEL_SEQUENCE_SEED });
    this.computerEnvironment.reset({ seed: DUEL_SEQUENCE_SEED });
    if (!pipeSequenceMatches(this.playerEnvironment.world, this.computerEnvironment.world)) {
      throw new Error("Duel sides must use an identical pipe sequence.");
    }
    this.computerController = this.controllerFactory(DUEL_OPPONENT_SEED);
    this.playerCompletion = undefined;
    this.computerCompletion = undefined;
    this.finalCompletion = undefined;
    this.currentPhase = "running";
    return this.snapshot;
  }

  /** Advance each still-live side once. A finished side keeps its terminal snapshot. */
  step(playerAction: 0 | 1): DuelSnapshot {
    if (playerAction !== 0 && playerAction !== 1) throw new RangeError("action must be 0 (wait) or 1 (flap)");
    if (this.currentPhase !== "running") return this.snapshot;

    if (this.playerCompletion === undefined) {
      const result = this.playerEnvironment.step(playerAction);
      if (result.done && result.result) this.playerCompletion = result.result;
    }
    if (this.computerCompletion === undefined) {
      const action = this.computerController.selectAction(this.computerEnvironment.getObservation());
      const result = this.computerEnvironment.step(action);
      if (result.done && result.result) this.computerCompletion = result.result;
    }

    if (this.playerCompletion && this.computerCompletion) {
      this.currentPhase = "finished";
      this.finalCompletion = Object.freeze({
        player: this.playerCompletion,
        computer: this.computerCompletion,
        winner: compareDuelResults(this.playerCompletion, this.computerCompletion),
      });
    }
    return this.snapshot;
  }
}
