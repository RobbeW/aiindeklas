/** Stable serialized experiment identity; deliberately not a cryptographic authenticity hash. */
export function stableIdentity(value:unknown):string {
  const text=JSON.stringify(value);if(text===undefined)throw new Error('Identity requires serializable data');
  let hash=2166136261;for(const c of text){hash^=c.charCodeAt(0);hash=Math.imul(hash,16777619);}
  return `fnv1a32-${(hash>>>0).toString(16).padStart(8,'0')}`;
}
