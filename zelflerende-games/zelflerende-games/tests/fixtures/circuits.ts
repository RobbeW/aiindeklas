import { readFileSync } from 'node:fs';
import { validateCircuit } from '../../src/tracks/document.ts';
export const teachingLoop=()=>validateCircuit(JSON.parse(readFileSync(new URL('../../public/tracks/teaching-loop.json',import.meta.url),'utf8')));
export const fixtureCircuit=(name:string)=>validateCircuit(JSON.parse(readFileSync(new URL(`../../public/tracks/${name}.json`,import.meta.url),'utf8')));
