import type { CarWorld,CarEpisodeResult } from '../car/environment.ts';

export interface PopulationFrame {
  readonly trackId:string;
  readonly generation:number;
  readonly round:number;
  readonly agents:readonly {readonly id:string;readonly world:CarWorld;readonly done:boolean;readonly result?:CarEpisodeResult}[];
}
