import { CAR_CONFIG, type CarWorldVersion } from '../car/config.ts';
import type { CarEpisodeResult } from '../car/environment.ts';
import type { Genome } from './genome.ts';

export const PRESENTATION_SNAPSHOT_LIMIT = 10;
export const PRESENTATION_ARCHIVE_BYTE_LIMIT = 2 * 1024 * 1024;
export interface PresentationTrackOutcome {
  readonly trackId: string;
  readonly result: CarEpisodeResult;
  readonly fitness: number;
}
export interface PresentationPopulationSnapshot {
  readonly kind: 'evolution-presentation-population';
  readonly schemaVersion: 1;
  readonly generation: number;
  readonly worldVersion: CarWorldVersion;
  readonly seed: number;
  readonly trackIds: readonly string[];
  readonly agents: readonly { readonly genome: Genome; readonly perTrack: readonly PresentationTrackOutcome[] }[];
}

/** Copy only completed evaluations. No simulation frames or action history are retained. */
export function createPresentationSnapshot(generation: number, population: readonly Genome[], trackIds: readonly string[],
  outcomes: readonly (readonly PresentationTrackOutcome[])[], seed: number): PresentationPopulationSnapshot {
  return Object.freeze({kind:'evolution-presentation-population',schemaVersion:1,generation,worldVersion:CAR_CONFIG.version,seed,
    trackIds:Object.freeze([...trackIds]),agents:Object.freeze(population.map((genome,i)=>Object.freeze({
      genome:Object.freeze({...genome,parents:Object.freeze([...genome.parents]),parameters:Object.freeze([...genome.parameters])}),
      perTrack:Object.freeze(outcomes[i]!.map(({trackId,result,fitness})=>Object.freeze({trackId,result:Object.freeze({...result}),fitness})))
    })))});
}

/** The cap applies to the UTF-8 JSON representation of the entire archive, including array delimiters. */
export function appendPresentationSnapshot(archive: readonly PresentationPopulationSnapshot[], snapshot: PresentationPopulationSnapshot): readonly PresentationPopulationSnapshot[] {
  if (archive.length >= PRESENTATION_SNAPSHOT_LIMIT) return archive;
  const next = [...archive,snapshot];
  if (new TextEncoder().encode(JSON.stringify(next)).byteLength > PRESENTATION_ARCHIVE_BYTE_LIMIT) return archive;
  return Object.freeze(next);
}
