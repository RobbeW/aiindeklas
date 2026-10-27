import { drawTrack } from './renderer.ts';
import { validateLibrary, MAX_SELECTED_CIRCUITS, type CircuitLibrary, type LibraryEntry } from './library.ts';
/** The caller owns persistence and the current editor document; onChoose handles replacing the draft. */
export interface LibraryViewOptions {readonly state:CircuitLibrary;readonly onChange:(library:CircuitLibrary)=>void;readonly onChoose:(entry:LibraryEntry)=>void;}
export function mountCircuitLibrary(root:HTMLElement,options:LibraryViewOptions){
 let state=validateLibrary(options.state),disposed=false;
 root.innerHTML='<section class="card"><h2>Kies je oefencircuits</h2><p>Kies maximaal 8 circuits en zet ze in de volgorde waarin de auto oefent.</p><p id="library-count"></p><p id="library-status" role="status" aria-live="polite"></p><div id="library-list"></div></section>';
 const list=root.querySelector<HTMLElement>('#library-list')!,status=root.querySelector<HTMLElement>('#library-status')!;
 function update(next:CircuitLibrary){
  const focused=root.ownerDocument.activeElement as HTMLElement|null,row=focused?.closest<HTMLElement>('[data-entry-id]'),entryId=row?.dataset.entryId,control=focused?.dataset.control,rowIndex=row?[...list.children].indexOf(row):-1;
  try{const valid=validateLibrary(next);options.onChange(valid);state=valid;render();status.textContent='Oefenreeks bijgewerkt.';}catch(e){render();status.textContent=e instanceof Error?e.message:String(e);}
  if(entryId){const rows=[...list.querySelectorAll<HTMLElement>('[data-entry-id]')],target=rows.find(r=>r.dataset.entryId===entryId)??rows[Math.max(0,Math.min(rowIndex,rows.length-1))];const next=target&&([...target.querySelectorAll<HTMLElement>('[data-control]')].find(b=>b.dataset.control===control&&!b.matches(':disabled'))??target.querySelector<HTMLElement>('input:not(:disabled),button:not(:disabled)'));next?.focus();}
 }
 function render(){if(disposed)return;root.querySelector<HTMLElement>('#library-count')!.textContent=`${state.selectedIds.length} van ${MAX_SELECTED_CIRCUITS} gekozen · ${state.entries.length} circuits bewaard`;list.replaceChildren();
  for(const entry of [...state.selectedIds.map(id=>state.entries.find(e=>e.id===id)!),...state.entries.filter(e=>!state.selectedIds.includes(e.id))]){const row=document.createElement('article');row.className='card';row.dataset.entryId=entry.id;const title=document.createElement('h3');title.textContent=entry.name;
   const canvas=document.createElement('canvas');canvas.width=240;canvas.height=140;canvas.setAttribute('aria-label',`Voorbeeld van ${entry.name}`);drawTrack(canvas.getContext('2d')!,entry.document);
   const label=document.createElement('label'),check=document.createElement('input');check.type='checkbox';check.dataset.control='select';check.checked=state.selectedIds.includes(entry.id);label.append(check,document.createTextNode(` Kies voor oefenreeks${check.checked?` · plaats ${state.selectedIds.indexOf(entry.id)+1}`:''}`));
   check.onchange=()=>update({...state,selectedIds:check.checked?[...state.selectedIds,entry.id]:state.selectedIds.filter(id=>id!==entry.id)});
   const toolbar=document.createElement('div');toolbar.className='toolbar';const button=(text:string,action:()=>void,disabled=false)=>{const b=document.createElement('button');b.type='button';b.className='secondary';b.textContent=text;b.dataset.control=text;b.disabled=disabled;b.onclick=action;toolbar.append(b);};
   const index=state.selectedIds.indexOf(entry.id);const move=(delta:number)=>{const ids=[...state.selectedIds],target=index+delta;[ids[index],ids[target]]=[ids[target]!,ids[index]!];update({...state,selectedIds:ids});};
   button('Omhoog',()=>move(-1),index<=0);button('Omlaag',()=>move(1),index<0||index===state.selectedIds.length-1);button('Open in bouwer',()=>options.onChoose(entry));
   if(entry.provenance==='custom'){const name=document.createElement('input');name.value=entry.name;name.dataset.control='name';name.maxLength=64;name.setAttribute('aria-label',`Nieuwe naam voor ${entry.name}`);toolbar.append(name);button('Naam wijzigen',()=>update({...state,entries:state.entries.map(e=>e.id===entry.id?{...e,name:name.value}:e)}));button('Verwijder uit bibliotheek',()=>update({...state,entries:state.entries.filter(e=>e.id!==entry.id),selectedIds:state.selectedIds.filter(id=>id!==entry.id)}));}
   row.append(title,canvas,label,toolbar);list.append(row);
  }}
 render();return{setState(value:CircuitLibrary){state=validateLibrary(value);render();},dispose(){disposed=true;root.replaceChildren();}};
}
