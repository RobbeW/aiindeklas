export interface DemoScene {
  readonly id: string;
  readonly game: 'flappy' | 'car';
  readonly kind: 'splash' | 'activity';
  readonly durationMs: number;
  readonly title: string;
  readonly body: string;
}

export const DEMO_SCENES: readonly DemoScene[] = Object.freeze([
  { id: 'f-intro', game: 'flappy', kind: 'splash', durationMs: 8000, title: 'Flappy Bird', body: 'Kan een computer leren spelen?' },
  { id: 'f-untrained', game: 'flappy', kind: 'activity', durationMs: 20000, title: 'Zonder oefening', body: 'Kijk hoe de computer begint.' },
  { id: 'f-example-info', game: 'flappy', kind: 'splash', durationMs: 8000, title: 'Voordoen', body: 'Geef voorbeelden door zelf te spelen.' },
  { id: 'f-examples', game: 'flappy', kind: 'activity', durationMs: 45000, title: 'Voorbeelden verzamelen', body: 'Speel mee en doe het voor.' },
  { id: 'f-imitation', game: 'flappy', kind: 'splash', durationMs: 12000, title: 'Leren van voorbeelden', body: 'De computer oefent met de voorbeelden.' },
  { id: 'f-reward-info', game: 'flappy', kind: 'splash', durationMs: 10000, title: 'Leren met beloning', body: 'De computer probeert zelf en krijgt beloning of straf.' },
  { id: 'f-training', game: 'flappy', kind: 'activity', durationMs: 60000, title: 'Zelf oefenen', body: 'De computer leert van zijn pogingen.' },
  { id: 'f-match-info', game: 'flappy', kind: 'splash', durationMs: 8000, title: 'Speel tegen de computer', body: 'Tot drie spelers kunnen meedoen.' },
  { id: 'f-match', game: 'flappy', kind: 'activity', durationMs: 180000, title: 'Mens tegen computer', body: 'Wie haalt de meeste punten?' },
  { id: 'c-intro', game: 'car', kind: 'splash', durationMs: 10000, title: 'De zelfrijdende auto', body: 'Hoe leert een auto rijden?' },
  { id: 'c-drive', game: 'car', kind: 'activity', durationMs: 20000, title: 'Zelf rijden', body: 'Probeer het circuit.' },
  { id: 'c-circuits', game: 'car', kind: 'splash', durationMs: 8000, title: 'Verschillende circuits', body: 'Oefenen op meerdere circuits.' },
  { id: 'c-darwin', game: 'car', kind: 'splash', durationMs: 16000, title: 'Van generatie naar generatie', body: 'De beste auto’s geven hun eigenschappen door.' },
  { id: 'c-training', game: 'car', kind: 'activity', durationMs: 75000, title: 'Auto’s oefenen', body: 'Elke generatie probeert opnieuw.' },
  { id: 'c-match-info', game: 'car', kind: 'splash', durationMs: 8000, title: 'Tijd voor een race', body: 'Neem het op tegen de getrainde auto.' },
  { id: 'c-match', game: 'car', kind: 'activity', durationMs: 180000, title: 'Mens tegen auto', body: 'Wie rijdt het verst?' },
  { id: 'c-close', game: 'car', kind: 'splash', durationMs: 8000, title: 'Zelf proberen?', body: 'Speel mee en ontdek hoe de computer leert.' },
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
