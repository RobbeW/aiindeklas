export interface DemoScene {
  readonly id: string;
  readonly game: 'flappy' | 'car';
  readonly kind: 'splash' | 'activity';
  readonly durationMs: number;
  readonly title: string;
  readonly body: string;
}

export const DEMO_SCENES: readonly DemoScene[] = Object.freeze([
  { id: 'f-intro', game: 'flappy', kind: 'splash', durationMs: 8000, title: 'Kan jij een computer leren spelen?', body: '' },
  { id: 'f-untrained', game: 'flappy', kind: 'activity', durationMs: 20000, title: 'Kan jij de computer verslaan?', body: 'De computer heeft nog niet geoefend.' },
  { id: 'f-example-info', game: 'flappy', kind: 'splash', durationMs: 8000, title: 'Doe het voor.', body: '' },
  { id: 'f-examples', game: 'flappy', kind: 'activity', durationMs: 45000, title: 'Doe het voor.', body: 'De computer kijkt mee.' },
  { id: 'f-imitation', game: 'flappy', kind: 'splash', durationMs: 12000, title: 'De computer oefent met voorbeelden.', body: '' },
  { id: 'f-reward-info', game: 'flappy', kind: 'splash', durationMs: 10000, title: 'Nu oefent de computer zelf.', body: '' },
  { id: 'f-training', game: 'flappy', kind: 'activity', durationMs: 60000, title: 'Nu oefent de computer zelf.', body: 'Alle vogels gebruiken hetzelfde AI-model.' },
  { id: 'f-match-info', game: 'flappy', kind: 'splash', durationMs: 8000, title: 'Kan jij winnen?', body: 'Drie spelers tegen de computer.' },
  { id: 'f-match', game: 'flappy', kind: 'activity', durationMs: 180000, title: 'Kan jij winnen?', body: '' },
  { id: 'c-intro', game: 'car', kind: 'splash', durationMs: 10000, title: 'Kan jij een auto leren rijden?', body: '' },
  { id: 'c-drive', game: 'car', kind: 'activity', durationMs: 20000, title: 'Rijd mee.', body: '' },
  { id: 'c-circuits', game: 'car', kind: 'splash', durationMs: 8000, title: 'Oefen op verschillende circuits.', body: '' },
  { id: 'c-darwin', game: 'car', kind: 'splash', durationMs: 16000, title: 'Wat zou Darwin doen?', body: '' },
  { id: 'c-training', game: 'car', kind: 'activity', durationMs: 75000, title: 'Laat de auto’s oefenen.', body: '' },
  { id: 'c-match-info', game: 'car', kind: 'splash', durationMs: 8000, title: 'Tijd voor een race.', body: 'Drie spelers tegen de computer.' },
  { id: 'c-match', game: 'car', kind: 'activity', durationMs: 180000, title: 'Wie rijdt het verst?', body: '' },
  { id: 'c-close', game: 'car', kind: 'splash', durationMs: 8000, title: 'Nog een keer?', body: '' },
].map((scene) => Object.freeze(scene as DemoScene)));
const LOOP_DURATION = DEMO_SCENES.reduce((sum, scene) => sum + scene.durationMs, 0);

export interface DemoTimelineSnapshot {
  readonly scene: DemoScene; readonly index: number; readonly elapsedMs: number;
  readonly remainingMs: number; readonly fraction: number; readonly loop: number; readonly paused: boolean;
}
export class DemoTimeline {
  private index = 0;
  private elapsedMs = 0;
  private loop = 0;
  private readonly reasons = new Set<string>();
  get snapshot(): DemoTimelineSnapshot {
    const scene = DEMO_SCENES[this.index]!;
    return Object.freeze({ scene, index: this.index, elapsedMs: this.elapsedMs, remainingMs: scene.durationMs - this.elapsedMs,
      fraction: this.elapsedMs / scene.durationMs, loop: this.loop, paused: this.reasons.size > 0 });
  }
  advance(deltaMs: number): DemoTimelineSnapshot {
    if (!Number.isFinite(deltaMs) || deltaMs < 0 || deltaMs > Number.MAX_SAFE_INTEGER) throw new RangeError('invalid timeline delta');
    if (this.reasons.size || deltaMs === 0) return this.snapshot;
    let position = this.elapsedMs + DEMO_SCENES.slice(0, this.index).reduce((sum, scene) => sum + scene.durationMs, 0);
    // Divide before adding, so even huge deltas require at most one pass through the scenes.
    this.loop += Math.floor(deltaMs / LOOP_DURATION);
    position += deltaMs % LOOP_DURATION;
    if (position >= LOOP_DURATION) { this.loop += 1; position -= LOOP_DURATION; }
    this.index = 0;
    while (position >= DEMO_SCENES[this.index]!.durationMs) position -= DEMO_SCENES[this.index++]!.durationMs;
    this.elapsedMs = position;
    return this.snapshot;
  }
  next(): DemoTimelineSnapshot {
    this.index += 1;
    if (this.index === DEMO_SCENES.length) { this.index = 0; this.loop += 1; }
    this.elapsedMs = 0;
    return this.snapshot;
  }
  pause(reason: string): DemoTimelineSnapshot { this.validateReason(reason); this.reasons.add(reason); return this.snapshot; }
  resume(reason: string): DemoTimelineSnapshot { this.validateReason(reason); this.reasons.delete(reason); return this.snapshot; }
  reset(): DemoTimelineSnapshot { this.index = 0; this.elapsedMs = 0; this.loop = 0; this.reasons.clear(); return this.snapshot; }
  private validateReason(reason: string): void { if (typeof reason !== 'string' || !reason.trim()) throw new RangeError('pause reason required'); }
}

/** A car scene completes only after both training and its recorded presentation. */
export function carTrainingReady(championReady:boolean,playbackComplete:boolean,operatorSkip=false):boolean {
  return championReady && (operatorSkip || playbackComplete);
}
