/** A caller-owned random source; core modules must not reach for browser globals. */
export type RandomSource = () => number;

/** Numeric state presented to a controller, in a versioned feature order. */
export type Observation = readonly number[];

/** Numeric actions keep environments independent of a particular controller. */
export type Action = number;

export interface ResetOptions {
  readonly seed: number;
}

export interface EpisodeResult {
  readonly survivalSteps: number;
  readonly totalReward: number;
  readonly terminationReason: string;
}

export interface EnvironmentStep<Result extends EpisodeResult = EpisodeResult> {
  readonly observation: Observation;
  readonly reward: number;
  readonly done: boolean;
  readonly reason?: string;
  /** Present only when this step ends the episode. */
  readonly result?: Readonly<Result>;
}

export interface Environment<ChosenAction extends Action = Action, Result extends EpisodeResult = EpisodeResult> {
  reset(options: ResetOptions): Observation;
  step(action: ChosenAction): EnvironmentStep<Result>;
}

export type ModelStage = "initial" | "imitation" | "post_rl";

/** A render-independent source of actions for one observation. */
export interface Controller<ChosenAction extends Action = Action> {
  selectAction(observation: Observation): ChosenAction;
}
