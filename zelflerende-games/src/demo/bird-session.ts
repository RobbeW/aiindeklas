import { createSeededRandom } from '../core/random.ts';
import type { DemonstrationEpisode } from '../data/demonstrations.ts';
import { FlappyEnvironment, type FlappyEpisodeResult } from '../flappy/environment.ts';
import { DemonstrationRecorder } from '../flappy/recorder.ts';
import type { WorldState } from '../flappy/world.ts';
import { BernoulliPolicy } from '../learning/policy.ts';
import { restorePolicySnapshot, type PolicySnapshot } from '../learning/policy-snapshot.ts';

type Action = 0 | 1;
type Source = 'human' | 'synthetic_reference' | 'model';
export interface DemoBirdOptions { readonly mode: 'untrained' | 'examples' | 'trained' | 'match'; readonly snapshot?: PolicySnapshot; readonly seed?: number }
export interface DemoBirdParticipant { readonly id: number; readonly world: WorldState; readonly score: number; readonly source: Source; readonly result?: Readonly<FlappyEpisodeResult> }
export interface DemoBirdSnapshot { readonly participants: readonly DemoBirdParticipant[]; readonly phase: 'running' | 'finished'; readonly finished: boolean }
interface Seat { environment: FlappyEnvironment; recorder?: DemonstrationRecorder; source: Source; result?: Readonly<FlappyEpisodeResult> }

/** Session-only simulations; examples are complete, source-labelled episodes. */
export class DemoBirdSession {
  private readonly mode: DemoBirdOptions['mode'];
  private readonly seed: number;
  private readonly policy: BernoulliPolicy;
  private random: () => number;
  private human = [false, false, false];
  private seats: Seat[] = [];
  private recorded: DemonstrationEpisode[] = [];
  private round = 0;
  private nextTrainingSeed = 1000;
  private pendingReset = false;
  constructor(options: DemoBirdOptions) {
    if (!options || !['untrained', 'examples', 'trained', 'match'].includes(options.mode)) throw new RangeError('invalid demo bird mode');
    this.mode = options.mode;
    this.seed = options.seed ?? 1;
    if (!Number.isSafeInteger(this.seed)) throw new RangeError('invalid demo seed');
    if (this.mode === 'trained' || this.mode === 'match') {
      if (!options.snapshot || options.snapshot.stage === 'initial' || (this.mode === 'match' && options.snapshot.stage !== 'post_rl')) throw new RangeError('trained demo requires a compatible trained snapshot');
      this.policy = restorePolicySnapshot(options.snapshot);
    } else {if(options.snapshot&&options.snapshot.stage!=='initial')throw new RangeError('untrained demo needs an initial snapshot');this.policy=options.snapshot?restorePolicySnapshot(options.snapshot):new BernoulliPolicy(this.seed);}
    this.random = createSeededRandom(this.seed);
    this.resetRound();
  }
  get participants(): readonly DemoBirdParticipant[] {
    return Object.freeze(this.seats.map((seat, id) => Object.freeze({ id, world: seat.environment.world, score: seat.environment.pipesPassed, source: seat.source, ...(seat.result ? { result: seat.result } : {}) })));
  }
  get finished(): boolean { return this.seats.every((seat) => seat.result !== undefined); }
  get phase(): 'running' | 'finished' { return this.finished ? 'finished' : 'running'; }
  get snapshot(): DemoBirdSnapshot { return Object.freeze({ participants: this.participants, phase: this.phase, finished: this.finished }); }
  get examples(): readonly DemonstrationEpisode[] { return Object.freeze([...this.recorded]); }
  takeExamples(): readonly DemonstrationEpisode[] { const examples = this.examples; this.recorded = []; return examples; }
  setHuman(index: number, human: boolean): void {
    if (!Number.isInteger(index) || index < 0 || index > 2 || typeof human !== 'boolean') throw new RangeError('invalid human seat');
    if (this.human[index] !== human) { this.human[index] = human; this.pendingReset = true; }
  }
  resetRound(): DemoBirdSnapshot {
    this.round += 1;
    const sharedSeed = (this.seed + this.round - 1) % 2147483647;
    this.random = createSeededRandom(sharedSeed);
    this.seats = Array.from({ length: 4 }, (_, id) => {
      const source: Source = id === 3 ? 'model' : this.human[id] ? 'human' : 'synthetic_reference';
      if (this.mode === 'examples' && id < 3 && this.nextTrainingSeed <= 1999) {
        const seed = this.nextTrainingSeed++;
        const recorder = new DemonstrationRecorder();
        recorder.start(`demo-training-${seed}`, seed, source as 'human' | 'synthetic_reference');
        return { environment: recorder.environment, recorder, source };
      }
      const environment = new FlappyEnvironment();
      environment.reset({ seed: sharedSeed });
      return { environment, source };
    });
    this.pendingReset = false;
    return this.snapshot;
  }
  step(actions: readonly [Action, Action, Action]): DemoBirdSnapshot {
    if (!Array.isArray(actions) || actions.length !== 3 || actions.some((action) => action !== 0 && action !== 1)) throw new RangeError('three binary actions required');
    if (this.pendingReset) this.resetRound();
    for (let id = 0; id < this.seats.length; id += 1) {
      const seat = this.seats[id]!;
      if (seat.result) continue;
      const observation = seat.environment.getObservation();
      // Same privileged observation heuristic as reference-demonstrations.ts, not a neural policy.
      const gapCenter = (observation[3]! + observation[4]!) / 2;
      const action: Action = id === 3 ? (this.mode === 'untrained' || this.mode === 'examples' ? this.policy.sampleAction(observation, this.random) : this.policy.deterministicAction(observation)) : seat.source === 'human' ? actions[id]! : observation[0]! > gapCenter + 0.02 && observation[1]! >= 0 ? 1 : 0;
      const transition = seat.recorder ? seat.recorder.step(action) : seat.environment.step(action);
      if (transition.done && transition.result) {
        seat.result = transition.result;
        const episode = seat.recorder?.completedEpisode;
        if (episode && this.recorded.length < 64) this.recorded.push(episode);
      }
    }
    return this.snapshot;
  }
}
