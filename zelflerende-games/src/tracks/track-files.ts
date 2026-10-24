import { validateCircuit,trackIdentity,type CircuitDocument } from './document.ts';
import { buildRoute } from './route.ts';
export const MAX_TRACK_FILE_BYTES=256_000;
export function parseCircuitFile(text:string):CircuitDocument {
  if(typeof text!=='string'||new TextEncoder().encode(text).length>MAX_TRACK_FILE_BYTES)throw new Error('Circuit file exceeds256KB');
  let value:unknown;try{value=JSON.parse(text);}catch{throw new Error('Invalid circuit JSON');}
  const envelope=value as {kind?:unknown;schemaVersion?:unknown;trackId?:unknown;document?:unknown};
  const wrapped=envelope?.kind==='circuit-file';
  if(wrapped&&envelope.schemaVersion!==1)throw new Error('Unsupported circuit file schema');
  const doc=validateCircuit(wrapped?envelope.document:value);buildRoute(doc);
  if(wrapped&&envelope.trackId!==trackIdentity(doc))throw new Error('Circuit identity does not match document');
  return doc;
}
export function serializeCircuit(document:CircuitDocument):string {
  const doc=validateCircuit(document);buildRoute(doc);
  const text=JSON.stringify({kind:'circuit-file',schemaVersion:1,trackId:trackIdentity(doc),document:doc},null,2)+'\n';
  if(new TextEncoder().encode(text).length>MAX_TRACK_FILE_BYTES)throw new Error('Circuit export exceeds256KB');return text;
}
