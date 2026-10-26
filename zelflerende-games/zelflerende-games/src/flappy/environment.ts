import type { Environment, EnvironmentStep, EpisodeResult, Observation, ResetOptions } from "../core/contracts.ts";
import { checkBoundary, PHYSICS } from "./physics.ts";
import { PIPE_SEQUENCE_VERSION, type PipeSpec } from "./sequence.ts";
import {
  createWorld,
  detectPipeCollision,
  EPISODE_HORIZON_STEPS,
  getWorldTerminalReason,
  PIPE_GAP,
  PIPE_WIDTH,
  stepWorld,
  type WorldState,
} from "./world.ts";

export const FLAPPY_WORLD_CONFIG_VERSION = "flappy-world-v1" as const;
export const FLAPPY_OBSERVATION_VERSION = "flappy-observation-v1" as const;
export const OBSERVATION_INPUT_COUNT = 5;
export const OBSERVATION_NORMALIZATION = Object.freeze({
  yScale: PHYSICS.groundY,
  velocityScale: PHYSICS.maxFallVelocity,
  xScale: PHYSICS.worldWidth,
  gapScale: PHYSICS.groundY,
} as const);

export interface FlappyEpisodeResult extends EpisodeResult {
  readonly pipesPassed: number;
}

export interface FlappyEnvironmentOptions {
  /** Optional immutable fixture sequence for controlled tests. */
  readonly sequence?: readonly PipeSpec[];
}

function clip(value: number): number {
  return Math.max(-1, Math.min(1, value));
}

export class FlappyEnvironment implements Environment<0 | 1, FlappyEpisodeResult> {
  private readonly sequenceFixture: readonly PipeSpec[] | undefined;
  private currentWorld: WorldState | undefined;
  private episodeResult: Readonly<FlappyEpisodeResult> | undefined;
  private totalReward = 0;
  private passedPipeIndices = new Set<number>();
  private passedCount = 0;

  constructor(options: FlappyEnvironmentOptions = {}) {
    this.sequenceFixture = options.sequence;
  }

  get world(): WorldState {
    return this.getWorld();
  }

  get completedResult(): Readonly<FlappyEpisodeResult> | undefined {
    return this.episodeResult;
  }

  get pipesPassed(): number {
    return this.passedCount;
  }

  getWorld(): WorldState {
    if (this.currentWorld === undefined) throw new Error("environment has not been reset");
    return this.currentWorld;
  }

  getObservation(): Observation {
    return this.observationFor(this.getWorld());
  }

  reset(options: ResetOptions): Observation {
    if (options === null || typeof options !== "object" || !Number.isSafeInteger(options.seed)) {
      throw new RangeError("reset seed must be a finite safe integer");
    }
    this.currentWorld = createWorld(options.seed, this.sequenceFixture);
    this.totalReward = 0;
    this.passedPipeIndices = new Set<number>();
    this.passedCount = 0;
    this.episodeResult = undefined;
    return this.getObservation();
  }

  step(action: 0 | 1): EnvironmentStep<FlappyEpisodeResult> {
    const current = this.getWorld();
    if (this.episodeResult !== undefined) throw new Error("episode is terminal; reset before stepping again");
    if (action !== 0 && action !== 1) throw new RangeError("action must be 0 (wait) or 1 (flap)");

    const next = stepWorld(current, action);
    let newlyPassed = 0;
    const birdLeft = PHYSICS.birdX - PHYSICS.radius;
    for (let index = 0; index < current.pipes.length; index += 1) {
      const before = current.pipes[index];
      const after = next.pipes[index];
      if (before === undefined || after === undefined) continue;
      if (before.x + PIPE_WIDTH >= birdLeft && after.x + PIPE_WIDTH < birdLeft &&
          !this.passedPipeIndices.has(before.index)) {
        this.passedPipeIndices.add(before.index);
        this.passedCount += 1;
        newlyPassed += 1;
      }
    }

    const reason = getWorldTerminalReason(next);
    let reward = 0.01 + newlyPassed;
    if (reason !== null && reason !== "time_limit") reward = -1;
    this.totalReward += reward;
    this.currentWorld = next;

    let result: Readonly<FlappyEpisodeResult> | undefined;
    if (reason !== null) {
      result = Object.freeze({
        survivalSteps: next.steps,
        totalReward: this.totalReward,
        terminationReason: reason,
        pipesPassed: this.passedCount,
      });
      this.episodeResult = result;
    }
    return Object.freeze({
      observation: this.getObservation(),
      reward,
      done: reason !== null,
      ...(reason === null ? {} : { reason }),
      ...(result === undefined ? {} : { result }),
    });
  }

  private observationFor(world: WorldState): Observation {
    const birdLeft = PHYSICS.birdX - PHYSICS.radius;
    const nextPipe = world.pipes.find((pipe) => pipe.x + PIPE_WIDTH >= birdLeft);
    if (nextPipe === undefined) throw new RangeError("world has no upcoming pipe for observation");
    const gapTop = nextPipe.gapCenter - PIPE_GAP / 2;
    const gapBottom = nextPipe.gapCenter + PIPE_GAP / 2;
    const values = [
      clip(2 * world.bird.y / OBSERVATION_NORMALIZATION.yScale - 1),
      clip(world.bird.velocityY / OBSERVATION_NORMALIZATION.velocityScale),
      clip((nextPipe.x - PHYSICS.birdX) / OBSERVATION_NORMALIZATION.xScale),
      clip(2 * gapTop / OBSERVATION_NORMALIZATION.gapScale - 1),
      clip(2 * gapBottom / OBSERVATION_NORMALIZATION.gapScale - 1),
    ];
    if (values.length !== OBSERVATION_INPUT_COUNT || values.some((value) => !Number.isFinite(value))) {
      throw new RangeError("observation contains invalid normalized values");
    }
    return Object.freeze(values);
  }
}

/** Export sequence metadata alongside the environment's versioned feature contract. */
export const FLAPPY_SEQUENCE_VERSION = PIPE_SEQUENCE_VERSION;

/** Helpers re-exported for fixtures and environment consumers. */
export { checkBoundary, detectPipeCollision, getWorldTerminalReason, EPISODE_HORIZON_STEPS };
