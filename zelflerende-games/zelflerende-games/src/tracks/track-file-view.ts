import { mountFilePicker } from '../ui/file-picker.ts';
import { parseCircuitFile,serializeCircuit,MAX_TRACK_FILE_BYTES } from './track-files.ts';
import { trackIdentity,type CircuitDocument } from './document.ts';
export interface TrackFileViewOptions {getDocument():CircuitDocument;onImport(document:CircuitDocument):void;}
export function mountTrackFileView(root:HTMLElement,options:TrackFileViewOptions){
  root.innerHTML='<section class="card"><h2>Bewaar je circuit</h2><div class="toolbar"><button id="track-download">Download circuit</button><div class="file-field"><span>Importeer circuit</span><input id="track-import" type="file" accept=".json,application/json" hidden></div><button id="track-reference" class="secondary">Open voorbeeldlus</button></div><p>Je circuit moet gesloten zijn en een start hebben.</p><p id="track-file-status" role="status" aria-live="polite"></p></section>';
 const picker=mountFilePicker(root.querySelector<HTMLInputElement>('#track-import')!,'Kies een circuitbestand');
  const status=root.querySelector<HTMLElement>('#track-file-status')!;let disposed=false,epoch=0;
  root.querySelector<HTMLButtonElement>('#track-download')!.onclick=()=>{try{const doc=options.getDocument(),blob=new Blob([serializeCircuit(doc)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`circuit-${trackIdentity(doc)}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);status.textContent='Circuitbestand gedownload; bewaar dit bestand als eigen kopie.';}catch(e){status.textContent=e instanceof Error?e.message:String(e);}};
  async function importText(read:()=>Promise<string>){
    const token=++epoch,before=trackIdentity(options.getDocument());
    try{const doc=parseCircuitFile(await read());if(disposed||token!==epoch)return;if(trackIdentity(options.getDocument())!==before)throw new Error('Je circuit wijzigde tijdens het lezen. Importeer opnieuw om je nieuwe werk te behouden.');options.onImport(doc);status.textContent=`Circuit ${trackIdentity(doc)} geïmporteerd. Vorig werk blijft via Ongedaan maken beschikbaar.`;}
    catch(e){if(!disposed&&token===epoch)status.textContent=`Import geweigerd: ${e instanceof Error?e.message:String(e)}. Je circuit is behouden.`;}
  }
  root.querySelector<HTMLInputElement>('#track-import')!.onchange=e=>{const file=(e.currentTarget as HTMLInputElement).files?.[0];if(!file)return;if(file.size>MAX_TRACK_FILE_BYTES){status.textContent='Import geweigerd: bestand groter dan256KB. Je circuit is behouden.';return;}void importText(()=>file.text());};
  root.querySelector<HTMLButtonElement>('#track-reference')!.onclick=()=>{void importText(async()=>{const response=await fetch(`${import.meta.env.BASE_URL}tracks/teaching-loop.json`);if(!response.ok)throw new Error('Voorbeeldlus kon niet worden geladen');return response.text();});};
  return{dispose(){picker.dispose();disposed=true;epoch++;root.replaceChildren();}};
}
