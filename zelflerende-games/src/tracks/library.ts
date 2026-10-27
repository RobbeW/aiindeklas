import { TRACK_VERSION, validateCircuit, trackIdentity, type CircuitDocument, type Tile } from './document.ts';
import { assertTrainingTrack } from './catalog.ts';
import { validateConnections } from './connectivity.ts';
import { buildRoute } from './route.ts';

/** Immutable, canonical circuit library. IDs identify entries; document identity identifies their content. */
export interface LibraryEntry { readonly id:string; readonly name:string; readonly document:CircuitDocument; readonly provenance:'built-in'|'custom'; }
export interface CircuitLibrary { readonly entries:readonly LibraryEntry[]; readonly selectedIds:readonly string[]; }
export const MAX_LIBRARY_ENTRIES=24, MAX_SELECTED_CIRCUITS=8;
export function validateLibrary(value:unknown):CircuitLibrary {
  if(!value||typeof value!=='object')throw new Error('Circuitbibliotheek ontbreekt.');
  const v=value as CircuitLibrary;
  if(!Array.isArray(v.entries)||v.entries.length>MAX_LIBRARY_ENTRIES||!Array.isArray(v.selectedIds)||v.selectedIds.length>MAX_SELECTED_CIRCUITS)throw new Error('Te veel circuits of geselecteerde circuits.');
  const ids=new Set<string>(),identities=new Set<string>();
  const entries=v.entries.map(entry=>{
    if(!entry||typeof entry.id!=='string'||!entry.id.trim()||entry.id.length>64||typeof entry.name!=='string'||!entry.name.trim()||entry.name.trim().length>64||!['built-in','custom'].includes(entry.provenance))throw new Error('Ongeldige circuitnaam of gegevens.');
    const id=entry.id.trim(),name=entry.name.trim(),document=validateCircuit(entry.document),identity=trackIdentity(document);
    if(ids.has(id)||identities.has(identity))throw new Error('Dit circuit staat al in de bibliotheek.');
    assertTrainingTrack(document);
    if(!document.start||!validateConnections(document).valid)throw new Error('Bewaar alleen een gesloten circuit met start.');
    buildRoute(document);
    ids.add(id);identities.add(identity);
    return Object.freeze({id,name,document,provenance:entry.provenance});
  });
  const selected=new Set<string>();
  for(const id of v.selectedIds){if(typeof id!=='string'||!ids.has(id)||selected.has(id))throw new Error('Ongeldige of dubbele circuitkeuze.');selected.add(id);}
  return Object.freeze({entries:Object.freeze(entries),selectedIds:Object.freeze([...v.selectedIds])});
}
/** Freeze the ordered training documents at the start of a run. */
export function getTrainingDocuments(value:CircuitLibrary):readonly CircuitDocument[]{
  const library=validateLibrary(value);if(!library.selectedIds.length)throw new Error('Kies minstens één oefencircuit.');
  return Object.freeze(library.selectedIds.map(id=>library.entries.find(e=>e.id===id)!.document));
}
function rectangle(width:number,height:number,direction:'E'|'W'):CircuitDocument {
  const cells:Tile[]=[];
  for(let y=0;y<height;y++)for(let x=0;x<width;x++){
    if(x===0&&y===0)cells.push({x,y,kind:'turn',rotation:1});
    else if(x===width-1&&y===0)cells.push({x,y,kind:'turn',rotation:2});
    else if(x===0&&y===height-1)cells.push({x,y,kind:'turn',rotation:0});
    else if(x===width-1&&y===height-1)cells.push({x,y,kind:'turn',rotation:3});
    else if(y===0||y===height-1)cells.push({x,y,kind:'straight',rotation:1});
    else if(x===0||x===width-1)cells.push({x,y,kind:'straight',rotation:0});
  }
  return validateCircuit({version:TRACK_VERSION,width,height,cells,start:{x:1,y:0,direction}});
}
/** New independent practice loops; none derives from a reserved test track. */
export function createInitialLibrary():CircuitLibrary {
  return validateLibrary({entries:[
    {id:'practice-short',name:'Korte oefenlus',document:rectangle(4,4,'E'),provenance:'built-in'},
    {id:'practice-wide',name:'Brede oefenlus',document:rectangle(7,4,'W'),provenance:'built-in'},
    {id:'practice-tall',name:'Lange oefenlus',document:rectangle(4,7,'E'),provenance:'built-in'},
  ],selectedIds:['practice-short','practice-wide','practice-tall']});
}
/** Save or rename a matching circuit without changing the selected order. */
export function saveCircuit(value:CircuitLibrary,name:string,document:CircuitDocument):CircuitLibrary {
 const library=validateLibrary(value),canonical=validateCircuit(document),identity=trackIdentity(canonical),existing=library.entries.find(e=>trackIdentity(e.document)===identity);
 if(existing)return validateLibrary({...library,entries:library.entries.map(e=>e.id===existing.id?{...e,name}:e)});
 return validateLibrary({...library,entries:[...library.entries,{id:`custom-${identity}`,name,document:canonical,provenance:'custom'}]});
}
