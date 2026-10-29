import { CarEnvironment } from '../car/environment.ts';
import type { PopulationFrame } from '../evolution/live-frame.ts';
import { validateGenome } from '../evolution/genome.ts';
import { CarPolicy } from '../car/policy-adapter.ts';
import { appendPresentationSnapshot, createPresentationSnapshot, PRESENTATION_SNAPSHOT_LIMIT, type PresentationPopulationSnapshot, type PresentationTrackOutcome } from '../evolution/presentation-snapshots.ts';
import { trackIdentity, validateCircuit, type CircuitDocument } from '../tracks/document.ts';
import { getCarConfig } from '../car/config.ts';

export type PresentationStatus = 'waiting'|'playing'|'terminal'|'track-boundary'|'complete'|'disposed';
export interface CarTrainingPresentationState {
  readonly status: PresentationStatus; readonly trackIndex: number; readonly trackCount: number;
  readonly attemptIndex: number; readonly availableAttempts: number; readonly archiveSealed: boolean;
  readonly generation?: number; readonly speed: number; readonly elapsedAttemptMs: number;
  readonly frame?: PopulationFrame;
}
export interface CarTrainingPresentationOptions { readonly reducedMotion?: boolean; readonly fixedSpeed?: 2|8; }

/** Session-only replay: bounded snapshots and current simulation, never a frame history. */
export class CarTrainingPresentation {
  private readonly documents: readonly CircuitDocument[];
  private readonly ids: readonly string[];
  private archive: readonly PresentationPopulationSnapshot[] = Object.freeze([]);
  private sealed = false; private disposed = false; private paused = false; private hidden = false;
  private track = 0; private attempt = 0; private status: PresentationStatus = 'waiting';
  private lastFrame: PopulationFrame | undefined;
  private elapsed = 0; private simulatedMs = 0; private round = 0;
  private envs: CarEnvironment[] = []; private policies: CarPolicy[] = [];
  private observations: ReturnType<CarEnvironment['reset']>[] = [];
  private done: boolean[] = [];
  private readonly options: CarTrainingPresentationOptions;
  constructor(documents: readonly CircuitDocument[], options: CarTrainingPresentationOptions = {}) {
    this.options = Object.freeze({...options});
    if (!documents.length || documents.length > 8) throw new RangeError('Expected 1 to 8 circuits');
    if (options.fixedSpeed !== undefined && options.fixedSpeed !== 2 && options.fixedSpeed !== 8) throw new RangeError('Invalid fixed speed');
    this.documents = Object.freeze(documents.map(validateCircuit)); this.ids = Object.freeze(this.documents.map(trackIdentity));
    if (new Set(this.ids).size !== this.ids.length) throw new Error('Duplicate circuit');
  }
  private assertLive(){if(this.disposed) throw new Error('Presentation disposed');}
  addSnapshot(snapshot: PresentationPopulationSnapshot): void {
    this.assertLive(); if(this.sealed) throw new Error('Archive sealed');
    if (this.archive.length >= PRESENTATION_SNAPSHOT_LIMIT) throw new Error('Snapshot limit reached');
    if (!snapshot || snapshot.kind !== 'evolution-presentation-population' || snapshot.schemaVersion !== 1 ||
      !Number.isSafeInteger(snapshot.generation) || snapshot.generation !== this.archive.length || !Number.isSafeInteger(snapshot.seed) ||
      !Array.isArray(snapshot.trackIds) || JSON.stringify(snapshot.trackIds) !== JSON.stringify(this.ids) ||
      !Array.isArray(snapshot.agents) || snapshot.agents.length !== 12) throw new Error('Incompatible presentation snapshot');
    getCarConfig(snapshot.worldVersion);
    const genomes = snapshot.agents.map(a=>validateGenome(a.genome));
    if(new Set(genomes.map(g=>g.id)).size !== 12 || genomes.some(g=>g.generation !== snapshot.generation) ||
      snapshot.agents.some(a=>!Array.isArray(a.perTrack) || a.perTrack.length !== this.ids.length || a.perTrack.some((o:PresentationTrackOutcome,i:number)=>o.trackId!==this.ids[i] || !o.result || !Number.isFinite(o.fitness)))) throw new Error('Incompatible snapshot outcomes');
    const copy = createPresentationSnapshot(snapshot.generation, genomes, this.ids, snapshot.agents.map(a=>a.perTrack), snapshot.seed);
    // createPresentationSnapshot uses the current world; preserve the captured version explicitly.
    const frozen = Object.freeze({...copy, worldVersion:snapshot.worldVersion});
    const next = appendPresentationSnapshot(this.archive, frozen);
    if(next===this.archive) throw new Error('Presentation archive byte limit exceeded');
    this.archive=next; if(this.status==='waiting') this.startIfReady();
  }
  seal(): void { this.assertLive(); this.sealed=true; if(this.status==='waiting') this.startIfReady(); }
  setPaused(value:boolean):void {this.assertLive();this.paused=value;}
  setHidden(value:boolean):void {this.assertLive();this.hidden=value;}
  acknowledgeTrackBoundary():void {this.assertLive();if(this.status!=='track-boundary') return;this.track++;this.attempt=0;this.status='waiting';this.startIfReady();}
  private get speed():number {return this.options.reducedMotion ? 1 : this.options.fixedSpeed ?? (this.attempt<3?1:this.attempt<6?2:4);}
  private startIfReady():void {
    if(this.attempt>=this.archive.length){
      if(this.sealed || this.archive.length===PRESENTATION_SNAPSHOT_LIMIT){this.status=this.archive.length===0 || this.track===this.documents.length-1?'complete':'track-boundary';}
      return;
    }
    const s=this.archive[this.attempt]!;this.envs=s.agents.map(()=>new CarEnvironment(this.documents[this.track]!,s.worldVersion));
    this.policies=s.agents.map(a=>new CarPolicy(a.genome.initializationSeed,a.genome.parameters,s.worldVersion));this.observations=this.envs.map(e=>e.reset({seed:s.seed}));
    this.done=s.agents.map(()=>false);this.elapsed=0;this.simulatedMs=0;this.round=0;this.status='playing';
  }
  /** Advance by active wall milliseconds; a stale or invalid delta contributes at most 100 ms. */
  advance(deltaMs:number):CarTrainingPresentationState {
    this.assertLive(); if(this.paused||this.hidden||!Number.isFinite(deltaMs)||deltaMs<=0) return this.state;
    const delta=Math.min(deltaMs,100);if(this.status!=='playing'&&this.status!=='terminal')return this.state;
    this.elapsed+=delta;
    if(this.status==='playing'){
      this.simulatedMs+=delta*this.speed;
      const stepMs=1000/60;
      while(this.simulatedMs+1e-8>=stepMs && this.status==='playing'){
        this.simulatedMs-=stepMs;this.round++;
        for(let i=0;i<this.envs.length;i++) if(!this.done[i]){
          const transition=this.envs[i]!.step(this.policies[i]!.action(this.observations[i]!));this.observations[i]=transition.observation;
          if(transition.done){this.done[i]=true;const expected=this.archive[this.attempt]!.agents[i]!.perTrack[this.track]!.result;
            if(JSON.stringify(transition.result)!==JSON.stringify(expected)) throw new Error('Replay outcome differs from captured result');}
        }
        if(this.done.every(Boolean))this.status='terminal';
      }
    }
    if(this.status==='terminal' && this.elapsed>=2000){this.lastFrame=this.state.frame;this.attempt++;this.status='waiting';this.startIfReady();}
    return this.state;
  }
  get state():CarTrainingPresentationState {
    const s=this.archive[this.attempt];
    const frame=s && (this.status==='playing'||this.status==='terminal') ? Object.freeze({trackId:this.ids[this.track]!,generation:s.generation,round:this.round,
      agents:Object.freeze(this.envs.map((e,i)=>Object.freeze({id:s.agents[i]!.genome.id,world:e.world,done:this.done[i]!,...(e.completedResult?{result:e.completedResult}:{})})))}) : this.status==='track-boundary' || this.status==='waiting' || this.status==='complete' ? this.lastFrame : undefined;
    return Object.freeze({status:this.status,trackIndex:this.track+1,trackCount:this.documents.length,attemptIndex:Math.min(this.attempt+1,this.archive.length || 1),availableAttempts:this.archive.length,archiveSealed:this.sealed,...(s?{generation:s.generation}:{}),speed:this.speed,elapsedAttemptMs:this.elapsed,...(frame?{frame}:{})});
  }
  dispose():void {this.disposed=true;this.status='disposed';this.archive=Object.freeze([]);this.envs=[];this.policies=[];this.observations=[];this.done=[];this.lastFrame=undefined;}
}

/** Two independent clocks share only circuit-boundary acknowledgement. */
export class SplitCarTrainingPresentation {
  private readonly left: CarTrainingPresentation;
  private readonly right: CarTrainingPresentation;
  constructor(documents: readonly CircuitDocument[]) {
    this.left = new CarTrainingPresentation(documents, {fixedSpeed: 2});
    this.right = new CarTrainingPresentation(documents, {fixedSpeed: 8});
  }
  addSnapshot(snapshot: PresentationPopulationSnapshot): void { this.left.addSnapshot(snapshot); this.right.addSnapshot(snapshot); }
  seal(): void { this.left.seal(); this.right.seal(); }
  setPaused(value: boolean): void { this.left.setPaused(value); this.right.setPaused(value); }
  setHidden(value: boolean): void { this.left.setHidden(value); this.right.setHidden(value); }
  advance(delta: number): CarTrainingPresentationState { this.left.advance(delta); this.right.advance(delta); return this.state; }
  acknowledgeTrackBoundary(): void {
    if (this.left.state.status === 'track-boundary' && this.right.state.status === 'track-boundary') {
      this.left.acknowledgeTrackBoundary(); this.right.acknowledgeTrackBoundary();
    }
  }
  get state(): CarTrainingPresentationState {
    const left = this.left.state, right = this.right.state;
    if ((left.status === 'track-boundary' && right.status !== 'track-boundary') || (left.status === 'complete' && right.status !== 'complete'))
      return Object.freeze({...left, status: 'playing' as const});
    return left;
  }
  get rightState(): CarTrainingPresentationState { return this.right.state; }
  dispose(): void { this.left.dispose(); this.right.dispose(); }
}
