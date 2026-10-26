import { validateCircuit,trackIdentity,type CircuitDocument } from './document.ts';
export const TRACK_CATALOG=Object.freeze([
  Object.freeze({id:'teaching-loop',role:'training' as const,identity:'fnv1a32-3933cc5d',label:'Eenvoudige oefenlus'}),
  Object.freeze({id:'long-loop',role:'validation' as const,identity:'fnv1a32-4b58e9cb',label:'Langere controlelus'}),
  Object.freeze({id:'unseen-bends',role:'final' as const,identity:'fnv1a32-a9f11b4e',label:'Gereserveerd eindcircuit'}),
]);
export const getTrackRole=(doc:CircuitDocument)=>TRACK_CATALOG.find(t=>t.identity===trackIdentity(doc))?.role??'custom';
export function assertTrainingTrack(doc:CircuitDocument){if(['validation','final'].includes(getTrackRole(doc)))throw new Error('Reserved control/final circuit cannot be automatically used for training');}
export async function loadReferenceTrack(id:string):Promise<CircuitDocument>{
  const entry=TRACK_CATALOG.find(t=>t.id===id);if(!entry)throw new Error('Unknown reference circuit');
  const response=await fetch(`${import.meta.env.BASE_URL}tracks/${entry.id}.json`);if(!response.ok)throw new Error('Circuit could not be loaded');
  const doc=validateCircuit(await response.json());if(trackIdentity(doc)!==entry.identity)throw new Error('Reference circuit identity changed; review the catalog');return doc;
}
