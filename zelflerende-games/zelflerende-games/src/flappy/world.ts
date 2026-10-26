import { checkBoundary, initialBirdState, PHYSICS, stepBird, type BirdState } from "./physics.ts";
import { generatePipeSequence, type PipeSpec } from "./sequence.ts";

export const PIPE_WIDTH = 52;
export const PIPE_GAP = 140;
export const PIPE_SPEED = 120;
export const PIPE_SPACING = 220;
export const FIRST_PIPE_X = 420;
export const EPISODE_HORIZON_STEPS = 1800;

export interface PipeState {
  readonly index: number;
  readonly x: number;
  readonly gapCenter: number;
}

export interface WorldState {
  readonly bird: BirdState;
  readonly steps: number;
  readonly pipes: readonly PipeState[];
}

export type WorldTerminalReason = "ceiling" | "floor" | "pipe_collision" | "time_limit" | null;

const requiredPipeCount = Math.ceil(
  (FIRST_PIPE_X + PIPE_SPEED * PHYSICS.dt * EPISODE_HORIZON_STEPS) / PIPE_SPACING,
) + 1;

function validateSequence(sequence: readonly PipeSpec[]): readonly PipeSpec[] {
  if (!Array.isArray(sequence)) throw new TypeError("pipe sequence must be an array");
  if (sequence.length < requiredPipeCount) {
    throw new RangeError(`pipe sequence must contain at least ${requiredPipeCount} specs for the full horizon`);
  }
  const copy: PipeSpec[] = [];
  for (let index = 0; index < sequence.length; index += 1) {
    const spec = sequence[index];
    if (spec === undefined || spec.index !== index ||
        !Number.isSafeInteger(spec.index) || !Number.isFinite(spec.gapCenter) ||
        spec.gapCenter < 120 || spec.gapCenter > 320) {
      throw new RangeError("pipe specs must have sequential indices and gap centers in [120, 320]");
    }
    copy.push(Object.freeze({ index, gapCenter: spec.gapCenter }));
  }
  return Object.freeze(copy);
}

export function createWorld(seed: number, suppliedSequence?: readonly PipeSpec[]): WorldState {
  if (!Number.isSafeInteger(seed)) throw new RangeError("seed must be a finite safe integer");
  const specs = validateSequence(suppliedSequence ?? generatePipeSequence(seed, requiredPipeCount));
  const pipes = specs.map(({ index, gapCenter }) => Object.freeze({
    index,
    x: FIRST_PIPE_X + index * PIPE_SPACING,
    gapCenter,
  }));
  return Object.freeze({ bird: initialBirdState(), steps: 0, pipes: Object.freeze(pipes) });
}

function validateWorld(state: WorldState): void {
  if (state === null || typeof state !== "object" || !Number.isSafeInteger(state.steps) ||
      state.steps < 0 || state.steps > EPISODE_HORIZON_STEPS || !Array.isArray(state.pipes)) {
    throw new RangeError("world state has invalid steps or pipes");
  }
  if (checkBoundary(state.bird) !== null && !Number.isFinite(state.bird.velocityY)) {
    throw new RangeError("world bird state is invalid");
  }
  for (const pipe of state.pipes) {
    if (!Number.isSafeInteger(pipe.index) || !Number.isFinite(pipe.x) || !Number.isFinite(pipe.gapCenter)) {
      throw new RangeError("world pipe state values must be finite with an integer index");
    }
  }
}

export function stepWorld(state: WorldState, action: 0 | 1): WorldState {
  validateWorld(state);
  if (state.steps >= EPISODE_HORIZON_STEPS) throw new RangeError("world has reached its time limit");
  const nextPipes = state.pipes.map((pipe) => Object.freeze({
    ...pipe,
    x: pipe.x - PIPE_SPEED * PHYSICS.dt,
  }));
  return Object.freeze({
    bird: stepBird(state.bird, action),
    steps: state.steps + 1,
    pipes: Object.freeze(nextPipes),
  });
}

function circleIntersectsRect(
  x: number,
  y: number,
  radius: number,
  left: number,
  top: number,
  right: number,
  bottom: number,
): boolean {
  const closestX = Math.max(left, Math.min(x, right));
  const closestY = Math.max(top, Math.min(y, bottom));
  const dx = x - closestX;
  const dy = y - closestY;
  return dx * dx + dy * dy <= radius * radius + 1e-9;
}

export function detectPipeCollision(bird: BirdState, pipes: readonly PipeState[]): boolean {
  if (bird === null || typeof bird !== "object" || !Number.isFinite(bird.y) || !Number.isFinite(bird.velocityY)) {
    throw new RangeError("bird state y and velocityY must be finite numbers");
  }
  if (!Array.isArray(pipes)) throw new TypeError("pipes must be an array");
  const gapHalf = PIPE_GAP / 2;
  for (const pipe of pipes) {
    if (!Number.isFinite(pipe.x) || !Number.isFinite(pipe.gapCenter)) {
      throw new RangeError("pipe position and gap center must be finite");
    }
    const left = pipe.x;
    const right = pipe.x + PIPE_WIDTH;
    if (circleIntersectsRect(PHYSICS.birdX, bird.y, PHYSICS.radius, left, 0, right, pipe.gapCenter - gapHalf) ||
        circleIntersectsRect(PHYSICS.birdX, bird.y, PHYSICS.radius, left, pipe.gapCenter + gapHalf, right, PHYSICS.worldHeight)) {
      return true;
    }
  }
  return false;
}

export function getWorldTerminalReason(state: WorldState): WorldTerminalReason {
  validateWorld(state);
  const boundary = checkBoundary(state.bird);
  if (boundary !== null) return boundary;
  if (detectPipeCollision(state.bird, state.pipes)) return "pipe_collision";
  if (state.steps >= EPISODE_HORIZON_STEPS) return "time_limit";
  return null;
}
