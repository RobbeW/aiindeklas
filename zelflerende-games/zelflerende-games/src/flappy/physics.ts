export const PHYSICS = Object.freeze({
  worldWidth: 360,
  worldHeight: 480,
  groundY: 440,
  birdX: 72,
  initialBirdY: 220,
  radius: 10,
  dt: 1 / 60,
  gravity: 1000,
  flapVelocity: -330,
  maxFallVelocity: 500,
} as const);

export interface BirdState {
  readonly y: number;
  readonly velocityY: number;
}

export type BoundaryContact = "ceiling" | "floor" | null;

function validateState(state: BirdState): void {
  if (state === null || typeof state !== "object" ||
      !Number.isFinite(state.y) || !Number.isFinite(state.velocityY)) {
    throw new RangeError("bird state y and velocityY must be finite numbers");
  }
}

export function initialBirdState(): BirdState {
  return Object.freeze({ y: PHYSICS.initialBirdY, velocityY: 0 });
}

/** Advance one fixed simulation step, without mutating or clamping the input state. */
export function stepBird(state: BirdState, action: 0 | 1): BirdState {
  validateState(state);
  if (action !== 0 && action !== 1) {
    throw new RangeError("action must be 0 (wait) or 1 (flap)");
  }

  let velocityY = action === 1 ? PHYSICS.flapVelocity : state.velocityY;
  velocityY += PHYSICS.gravity * PHYSICS.dt;
  velocityY = Math.min(velocityY, PHYSICS.maxFallVelocity);
  const y = state.y + velocityY * PHYSICS.dt;
  return Object.freeze({ y, velocityY });
}

/** Report contact at or beyond the bird's ceiling/floor edge. */
export function checkBoundary(bird: BirdState): BoundaryContact {
  validateState(bird);
  if (bird.y - PHYSICS.radius <= 0) return "ceiling";
  if (bird.y + PHYSICS.radius >= PHYSICS.groundY) return "floor";
  return null;
}
