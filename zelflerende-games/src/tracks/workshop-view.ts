import { mountTrackEditor } from './editor-view.ts';import { mountTrackFileView } from './track-file-view.ts';import type { CircuitDocument } from './document.ts';
import { validateConnections } from './connectivity.ts';
import { mountCarPlayView } from '../car/play-view.ts';
export function mountCircuitWorkshop(root:HTMLElement,options:{document?:CircuitDocument;onChange?:(doc:CircuitDocument)=>void;onTest?:(doc:CircuitDocument)=>void;onSave?:(name:string,doc:CircuitDocument)=>void}={}){
  root.innerHTML='<main class="circuit-workspace"><div id="workshop-editor"></div><details class="context-help circuit-files"><summary>Circuit opslaan of openen</summary><div id="workshop-files"></div></details><div id="workshop-drive"></div></main>';
  const driveRoot=root.querySelector<HTMLElement>('#workshop-drive')!;let drive:ReturnType<typeof mountCarPlayView>|undefined;
  const editor=mountTrackEditor(root.querySelector('#workshop-editor')!,{...options,onChange:doc=>{drive?.dispose();drive=undefined;options.onChange?.(doc);},onTest:doc=>{
    drive?.dispose();if(options.onTest)options.onTest(doc);else{drive=mountCarPlayView(driveRoot,{document:doc});driveRoot.scrollIntoView({block:'start',behavior:'auto'});}
  }});
  if(options.onSave){const area=document.createElement('div');area.className='card';area.innerHTML='<label>Naam van je circuit <input maxlength="64" id="workshop-name"></label> <button id="workshop-save">Bewaar in oefencircuits</button><p role="status" id="workshop-save-status"></p>';root.querySelector('#workshop-editor')!.after(area);area.querySelector<HTMLButtonElement>('#workshop-save')!.onclick=()=>{const doc=editor.getDocument(),name=area.querySelector<HTMLInputElement>('#workshop-name')!.value.trim(),status=area.querySelector<HTMLElement>('#workshop-save-status')!;if(!name){status.textContent='Geef je circuit een naam.';return;}if(!doc.start||!validateConnections(doc).valid){status.textContent='Maak eerst een gesloten circuit met start.';return;}try{options.onSave!(name,doc);status.textContent='Circuit bewaard.';}catch(e){status.textContent=e instanceof Error?e.message:String(e);}};}
  const files=mountTrackFileView(root.querySelector('#workshop-files')!,{getDocument:editor.getDocument,onImport:doc=>editor.loadDocument(doc)});
  return{...editor,dispose(){drive?.dispose();files.dispose();editor.dispose();root.replaceChildren();}};
}
