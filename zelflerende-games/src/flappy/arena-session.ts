import { FlappyEnvironment, type FlappyEpisodeResult } from "./environment.ts";
import type { PolicySnapshot } from "../learning/policy-snapshot.ts";
import { restorePolicySnapshot } from "../learning/policy-snapshot.ts";
import type { BernoulliPolicy } from "../learning/policy.ts";
import type { WorldState } from "./world.ts";

export type ArenaPlayerId = "p1" | "p2" | "p3" | "ai";
export type ArenaPhase = "ready" | "running" | "paused" | "finished";

export interface ArenaParticipantSnapshot {
  readonly id: ArenaPlayerId;
  readonly world: WorldState;
  readonly score: number;
  readonly result?: Readonly<FlappyEpisodeResult>;
}

export interface ArenaStanding {
  readonly id: ArenaPlayerId;
  readonly rank: number;
  readonly score: number;
  readonly survivalSteps: number;
}

export interface FlappyArenaSnapshot {
  readonly phase: ArenaPhase;
  readonly seed: number;
  readonly participants: readonly ArenaParticipantSnapshot[];
  readonly standings: readonly ArenaStanding[];
}

const PLAYER_IDS: readonly ArenaPlayerId[] = Object.freeze(["p1", "p2", "p3", "ai"]);
type HumanActions = readonly [0 | 1, 0 | 1, 0 | 1];

interface ArenaParticipant {
  readonly id: ArenaPlayerId;
  readonly environment: FlappyEnvironment;
  score: number;
  result: Readonly<FlappyEpisodeResult> | undefined;
}

/** Rank score first, survival time second; exact ties share their competition rank. */
export function rankArenaResults(
  entries: readonly { readonly id: ArenaPlayerId; readonly score: number; readonly survivalSteps: number }[],
): readonly ArenaStanding[] {
  const sorted = [...entries].sort((left, right) =>
    right.score - left.score || right.survivalSteps - left.survivalSteps || PLAYER_IDS.indexOf(left.id) - PLAYER_IDS.indexOf(right.id));
  let previous: { score: number; survivalSteps: number } | undefined;
  let previousRank = 0;
  const standings = sorted.map((entry, index) => {
    const tied = previous !== undefined && entry.score === previous.score && entry.survivalSteps === previous.survivalSteps;
    const rank = tied ? previousRank : index + 1;
    previous = entry;
    previousRank = rank;
    return Object.freeze({ ...entry, rank });
  });
  return Object.freeze(standings);
}

export class FlappyArenaSession {
  private readonly participants: readonly ArenaParticipant[];
  private readonly policy: BernoulliPolicy;
  private currentPhase: ArenaPhase = "ready";
  readonly seed: number;

  constructor(snapshot: PolicySnapshot, seed: number) {
    if (!Number.isSafeInteger(seed)) throw new RangeError("arena seed must be a finite safe integer");
    if (snapshot === null || typeof snapshot !== "object" || snapshot.stage !== "post_rl") {
      throw new RangeError("arena requires a post_rl policy snapshot");
    }
    this.seed = seed;
    this.policy = restorePolicySnapshot(snapshot);
    this.participants = Object.freeze(PLAYER_IDS.map((id) => {
      const environment = new FlappyEnvironment();
      environment.reset({ seed });
      return { id, environment, score: 0, result: undefined };
    }));
  }

  get snapshot(): FlappyArenaSnapshot {
    const participants = Object.freeze(this.participants.map(({ id, environment, score, result }) => Object.freeze({
      id,
      world: environment.world,
      score,
      ...(result === undefined ? {} : { result }),
    })));
    const standings = rankArenaResults(participants.map(({ id, score, world }) => ({ id, score, survivalSteps: world.steps })));
    return Object.freeze({ phase: this.currentPhase, seed: this.seed, participants, standings });
  }

  start(): FlappyArenaSnapshot {
    if (this.currentPhase !== "ready") throw new Error("arena can only start from ready");
    this.currentPhase = "running";
    return this.snapshot;
  }

  pause(): FlappyArenaSnapshot {
    if (this.currentPhase !== "running") throw new Error("arena can only pause while running");
    this.currentPhase = "paused";
    return this.snapshot;
  }

  resume(): FlappyArenaSnapshot {
    if (this.currentPhase !== "paused") throw new Error("arena can only resume while paused");
    this.currentPhase = "running";
    return this.snapshot;
  }

  step(actions: HumanActions): FlappyArenaSnapshot {
    if (!Array.isArray(actions) || actions.length !== 3 || actions.some((action) => action !== 0 && action !== 1)) {
      throw new RangeError("arena actions must be a tuple of three values, each 0 or 1");
    }
    if (this.currentPhase !== "running") return this.snapshot;

    for (let index = 0; index < this.participants.length; index += 1) {
      const participant = this.participants[index]!;
      if (participant.result !== undefined) continue;
      const action = participant.id === "ai"
        ? this.policy.deterministicAction(participant.environment.getObservation())
        : actions[PLAYER_IDS.indexOf(participant.id) as 0 | 1 | 2]!;
      const transition = participant.environment.step(action);
      participant.score = participant.environment.pipesPassed;
      if (transition.done && transition.result !== undefined) participant.result = transition.result;
    }
    if (this.participants.every(({ result }) => result !== undefined)) this.currentPhase = "finished";
    return this.snapshot;
  }
}
