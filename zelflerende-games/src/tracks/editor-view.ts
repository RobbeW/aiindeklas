import { TrackEditorState } from './editor-state.ts';
import { TRACK_VERSION,validateCircuit,tilePorts,opposite,type CircuitDocument,type Tile } from './document.ts';
import { validateConnections } from './connectivity.ts';
import { startFinishSvg,tileSvgPath } from './renderer.ts';
export interface EditorViewOptions {readonly document?:CircuitDocument;readonly onChange?:(document:CircuitDocument)=>void;readonly onTest?:(document:CircuitDocument)=>void;}
export function mountTrackEditor(root:HTMLElement,options:EditorViewOptions={}) {
  const state=new TrackEditorState(options.document??validateCircuit({version:TRACK_VERSION,width:6,height:6,cells:[]}));
  let x=0,y=0,rotation:Tile['rotation']=0,shape:Tile['kind']='straight',disposed=false,customSize=false;
  root.innerHTML=`<section class="card"><h2>Bouw je circuit</h2>
    <p>Kies een vak, plaats een tegel en sluit je circuit. Zet de start op een recht stuk.</p>
    <div class="toolbar editor-grid-settings"><label>Rastergrootte <select id="grid-size" aria-label="Rastergrootte"></select></label><div class="toolbar grid-custom" hidden><label>Breedte <input id="grid-width" type="number" min="3" max="32" value="6"></label><label>Hoogte <input id="grid-height" type="number" min="3" max="32" value="6"></label><button id="grid-apply" class="secondary">Grootte toepassen</button></div></div><div class="toolbar"><button id="tile-straight">Plaats recht stuk</button><button id="tile-turn" class="secondary">Plaats bocht</button><button id="tile-rotate" class="secondary">Draai 90°</button><button id="tile-erase" class="secondary">Wis tegel</button><button id="tile-start" class="secondary" title="Klik opnieuw op hetzelfde startvak om de rijrichting om te keren">Start / finish</button><button id="tile-test">Controleer en test circuit</button></div>
    <p id="editor-selection"></p><p id="editor-status" role="status" aria-live="polite"></p><div id="editor-errors"></div>
    <div class="track-grid-scroll" tabindex="0" aria-label="Circuitraster; schuif horizontaal indien nodig"><div id="track-grid" role="grid" aria-label="Circuit bewerken"></div></div></section>`;
  const style=document.createElement('style');style.textContent='.track-grid-scroll{overflow:auto;padding:7px}.track-cell{position:relative;padding:0;aspect-ratio:1;min-height:44px;border-radius:3px;background:var(--bg);border:1px solid var(--border);color:var(--ink)}.track-cell:hover:not(:disabled){transform:none;background:var(--bg)}.track-cell svg{width:100%;height:100%;display:block}.track-cell[aria-selected="true"]{outline:3px solid var(--brand-purple);outline-offset:-3px}.track-cell[aria-invalid="true"]{border:3px solid #a62034}.track-cell .cell-marker{position:absolute;top:0;left:3px;background:white;color:var(--ink);font-size:12px;padding:1px 3px;border-radius:3px}#track-grid{display:grid}';root.prepend(style);
  const q=<T extends HTMLElement>(s:string)=>root.querySelector<T>(s)!;
  const grid=q('#track-grid'),status=q('#editor-status');

  for(const [id,kind,text]of [['#tile-straight','straight','Recht stuk'],['#tile-turn','turn','Bocht']] as const){q(id).innerHTML=`<svg class="tile-tool-icon" viewBox="0 0 100 100" aria-hidden="true"><path d="${tileSvgPath(kind)}" fill="none" stroke="currentColor" stroke-width="32"/></svg><span>${text}</span>`;}
  function render(focus=false){
    if(disposed)return;const d=state.document;x=Math.min(x,d.width-1);y=Math.min(y,d.height-1);const validation=validateConnections(d);
    q('#tile-straight').setAttribute('aria-pressed',String(shape==='straight'));q('#tile-turn').setAttribute('aria-pressed',String(shape==='turn'));
    q('#editor-selection').textContent=`Vak ${y+1}, ${x+1} · ${shape==='straight'?'recht stuk':'bocht'} · ${rotation*90}°`;
    syncSizeControls();
    grid.style.width=`min(100%,${45*d.width/d.height}svh)`;grid.style.gridTemplateColumns=`repeat(${d.width},minmax(44px,1fr))`;grid.style.minWidth=`${d.width*44}px`;grid.setAttribute('aria-rowcount',String(d.height));grid.setAttribute('aria-colcount',String(d.width));
    const cells:HTMLElement[]=[];
    for(let row=0;row<d.height;row++)for(let col=0;col<d.width;col++){
      const tile=d.cells.find(t=>t.x===col&&t.y===row),issue=validation.issues.find(i=>i.x===col&&i.y===row);
      const b=document.createElement('button');b.type='button';b.className='track-cell';b.tabIndex=col===x&&row===y?0:-1;b.setAttribute('role','gridcell');b.setAttribute('aria-rowindex',String(row+1));b.setAttribute('aria-colindex',String(col+1));
      b.setAttribute('aria-selected',String(col===x&&row===y));if(issue)b.setAttribute('aria-invalid','true');
      const start=d.start?.x===col&&d.start.y===row;
      b.setAttribute('aria-label',`Rij ${row+1}, kolom ${col+1}: ${tile?`${tile.kind==='straight'?'recht stuk':'bocht'} ${tile.rotation*90} graden`:'leeg'}${start?`, start/finish, rijrichting ${d.start!.direction}`:''}${issue?`, let op: ${issue.message}`:''}`);
      if(tile)b.innerHTML=`<svg aria-hidden="true" viewBox="0 0 100 100"><path d="${tileSvgPath(tile.kind)}" transform="rotate(${tile.rotation*90} 50 50)" fill="none" stroke="#625B70" stroke-width="52"/><path d="${tileSvgPath(tile.kind)}" transform="rotate(${tile.rotation*90} 50 50)" fill="none" stroke="#3DFFD0" stroke-width="2" stroke-dasharray="7 7"/>${start?startFinishSvg(d.start!.direction):''}</svg>`;
      if(issue){const marker=document.createElement('span');marker.className='cell-marker';marker.textContent='!';b.append(marker);}
      b.onclick=()=>{x=col;y=row;render(true);};
      b.onkeydown=e=>{
        const move={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]}[e.key];
        if(move){e.preventDefault();x=Math.max(0,Math.min(d.width-1,x+move[0]!));y=Math.max(0,Math.min(d.height-1,y+move[1]!));render(true);}
        else if(e.key==='Enter'||e.key===' '){e.preventDefault();place();}
        else if(e.key.toLowerCase()==='r'&&!e.ctrlKey&&!e.metaKey){e.preventDefault();rotate();}
        else if(e.key==='Delete'||e.key==='Backspace'){e.preventDefault();change(()=>state.edit({type:'erase',x,y}));}
      };
      cells.push(b);
    }
    grid.replaceChildren(...cells);
    q('#editor-errors').replaceChildren(...validation.issues.slice(0,6).map(i=>{const p=document.createElement('p');p.textContent=`! ${i.message}`;return p;}));
    if(focus)(grid.children[y*d.width+x] as HTMLButtonElement).focus();
  }
  function change(action:()=>unknown){try{action();widthInput.value=String(state.document.width);heightInput.value=String(state.document.height);status.textContent='Circuit gewijzigd. Test de verbindingen vóór je rijdt.';render();options.onChange?.(state.document);}catch(e){status.textContent=e instanceof Error?e.message:String(e);syncSizeControls();}}
  function place(){change(()=>state.edit({type:'place',tile:{x,y,kind:shape,rotation}}));render(true);}
  function rotate(){const tile=state.document.cells.find(c=>c.x===x&&c.y===y);if(tile)change(()=>state.edit({type:'rotate',x,y}));else rotation=(rotation+1)%4 as Tile['rotation'];render(true);}
  const widthInput=q<HTMLInputElement>('#grid-width'),heightInput=q<HTMLInputElement>('#grid-height'),sizeSelect=q<HTMLSelectElement>('#grid-size');
  widthInput.value=String(state.document.width);heightInput.value=String(state.document.height);
  function syncSizeControls(){
    const d=state.document,current=`${d.width}x${d.height}`,values=['12x12','20x20','32x32'];if(!values.includes(current))values.unshift(current);
    sizeSelect.replaceChildren(...values.map(value=>{const option=document.createElement('option');option.value=value;option.textContent=value.replace('x',' × ');return option;}));
    const custom=document.createElement('option');custom.value='custom';custom.textContent='Aangepast…';sizeSelect.append(custom);sizeSelect.value=customSize?'custom':current;q('.grid-custom').hidden=!customSize;
  }
  sizeSelect.onchange=()=>{customSize=sizeSelect.value==='custom';if(customSize){q('.grid-custom').hidden=false;widthInput.focus();return;}const [width,height]=sizeSelect.value.split('x').map(Number);change(()=>state.resize(width!,height!));};
  q<HTMLButtonElement>('#grid-apply').onclick=()=>change(()=>state.resize(Number(widthInput.value),Number(heightInput.value)));
  const shortcuts=(e:KeyboardEvent)=>{if(!(e.ctrlKey||e.metaKey)||e.target instanceof HTMLInputElement||e.target instanceof HTMLTextAreaElement)return;const key=e.key.toLowerCase();if(key==='z'||key==='y'){e.preventDefault();const redo=key==='y'||e.shiftKey;change(()=>redo?state.redo():state.undo());render(true);}};
  root.addEventListener('keydown',shortcuts);
  q<HTMLButtonElement>('#tile-straight').onclick=()=>{shape='straight';place();};q<HTMLButtonElement>('#tile-turn').onclick=()=>{shape='turn';place();};
  q<HTMLButtonElement>('#tile-rotate').onclick=rotate;q<HTMLButtonElement>('#tile-erase').onclick=()=>change(()=>state.edit({type:'erase',x,y}));
  q<HTMLButtonElement>('#tile-start').onclick=()=>{const tile=state.document.cells.find(t=>t.x===x&&t.y===y);if(!tile||tile.kind!=='straight'){status.textContent='Kies eerst een recht stuk voor start en finish.';return;}const current=state.document.start;change(()=>state.edit({type:'start',start:{x,y,direction:current?.x===x&&current.y===y?opposite(current.direction):tilePorts(tile)[0]!}}));};

  q<HTMLButtonElement>('#tile-test').onclick=()=>{const v=validateConnections(state.document);if(!v.valid||!state.document.start){status.textContent=!v.valid?'Repareer eerst de gemarkeerde aansluitingen.':'Kies een recht stuk als start en finish.';render();return;}status.textContent='Eén gesloten circuit met start gevonden.';options.onTest?.(state.document);};
  render();
  return{getDocument:()=>state.document,loadDocument(value:unknown){change(()=>state.replace(value));x=0;y=0;render();},dispose(){disposed=true;root.removeEventListener('keydown',shortcuts);root.replaceChildren();}};
}
