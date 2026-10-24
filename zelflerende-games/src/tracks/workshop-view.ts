import { mountTrackEditor } from './editor-view.ts';import { mountTrackFileView } from './track-file-view.ts';import type { CircuitDocument } from './document.ts';
import { mountCarPlayView } from '../car/play-view.ts';
export function mountCircuitWorkshop(root:HTMLElement,options:{document?:CircuitDocument;onChange?:(doc:CircuitDocument)=>void;onTest?:(doc:CircuitDocument)=>void}={}){
  root.innerHTML='<main class="circuit-workspace"><div id="workshop-editor"></div><details class="context-help circuit-files"><summary>Circuit opslaan of openen</summary><div id="workshop-files"></div></details><div id="workshop-drive"></div></main>';
  const driveRoot=root.querySelector<HTMLElement>('#workshop-drive')!;let drive:ReturnType<typeof mountCarPlayView>|undefined;
  const editor=mountTrackEditor(root.querySelector('#workshop-editor')!,{...options,onChange:doc=>{drive?.dispose();drive=undefined;options.onChange?.(doc);},onTest:doc=>{
    drive?.dispose();if(options.onTest)options.onTest(doc);else{drive=mountCarPlayView(driveRoot,{document:doc});driveRoot.scrollIntoView({block:'start',behavior:'auto'});}
  }});
  const files=mountTrackFileView(root.querySelector('#workshop-files')!,{getDocument:editor.getDocument,onImport:doc=>editor.loadDocument(doc)});
  return{...editor,dispose(){drive?.dispose();files.dispose();editor.dispose();root.replaceChildren();}};
}
