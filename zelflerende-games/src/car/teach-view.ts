import type { CircuitDocument } from '../tracks/document.ts';
import { assertTrainingTrack, getTrackRole } from '../tracks/catalog.ts';
import { mountCarPlayView } from './play-view.ts';
import { CarEpisodeRecorder, generateCarReferenceEpisode, splitCarEpisodes, validateCarEpisode, type CarEpisode } from './recorder.ts';

export interface CarTeachViewOptions { readonly document:CircuitDocument; readonly onChange?:(episodes:readonly CarEpisode[])=>void; }
export interface CarTeachView {
  getEpisodes():readonly CarEpisode[]; setEpisodes(episodes:readonly CarEpisode[]):void; dispose():void;
}
/** Manual car recording and dataset curation. Model fitting belongs to the next task. */
export function mountCarTeachView(root:HTMLElement,options:CarTeachViewOptions):CarTeachView {
  const doc=options.document; let episodes:CarEpisode[]=[];let recorder:CarEpisodeRecorder|undefined;let disposed=false;let nextManualRole:'training'|'control'='training';
  root.innerHTML='<section class="card car-teach"><h2>Neem rijvoorbeelden op</h2><p>Elke afgeronde rit wordt een voorbeeld. Opnieuw starten wist de onafgemaakte rit.</p><div class="car-teach__game"></div><details class="context-help car-example-library"><summary>Bekijk en beheer rijvoorbeelden</summary><section class="card"><h3>Voorbeelden</h3><p class="car-teach__counts" role="status" aria-live="polite"></p><div class="car-teach__actions"><button type="button" class="car-teach__example">Voeg synthetisch oefenpaar toe</button><button type="button" class="secondary car-teach__clear">Wis alle rijvoorbeelden</button><button type="button" class="secondary car-teach__undo" hidden>Maak verwijderen ongedaan</button></div><ul class="car-teach__list"></ul></section></details></section>';
  const style=document.createElement('style');style.textContent='.car-teach{display:grid;gap:16px}.car-teach__actions{display:flex;flex-wrap:wrap;gap:10px}.car-teach__list{padding-left:1.25rem}.car-teach__list li{display:flex;gap:12px;align-items:center;justify-content:space-between;margin:.5rem 0}.car-teach__counts{min-height:1.5em}.car-teach button:focus-visible{outline:3px solid var(--brand-purple);outline-offset:2px}@media(prefers-reduced-motion:no-preference){.car-teach button{transition:transform var(--motion-fast) var(--ease-standard)}.car-teach button:hover{transform:translateY(-1px)}}';root.prepend(style);
  const game=root.querySelector<HTMLElement>('.car-teach__game')!,list=root.querySelector<HTMLUListElement>('.car-teach__list')!,counts=root.querySelector<HTMLElement>('.car-teach__counts')!,undoButton=root.querySelector<HTMLButtonElement>('.car-teach__undo')!;
  let undoEpisodes:CarEpisode[]|undefined;
  const publish=(invalidateUndo=false)=>{if(invalidateUndo)undoEpisodes=undefined;episodes=[...episodes];render();options.onChange?.(getEpisodes());};
  const getEpisodes=()=>Object.freeze([...episodes]);
  const render=()=>{list.replaceChildren();let train=0,control=0,duration=0,balance=[0,0,0];for(const e of episodes){if(e.seed<=1999)train++;else control++;duration+=e.durationSeconds;for(const f of e.frames)balance[f.action]++;const li=document.createElement('li'),label=document.createElement('span'),remove=document.createElement('button');label.textContent=`${e.source==='human'?'Handmatig':'Synthetisch'} · ${e.seed<=1999?'training':'controle'} · ${e.durationSeconds.toFixed(1)} s`;remove.type='button';remove.className='secondary';remove.textContent='Verwijder';remove.setAttribute('aria-label',`Verwijder rijvoorbeeld ${episodes.indexOf(e)+1}`);remove.onclick=()=>{const index=episodes.findIndex(x=>x.id===e.id);undoEpisodes=[...episodes];episodes=episodes.filter(x=>x.id!==e.id);publish();(undoButton.hidden?list.querySelectorAll<HTMLButtonElement>('button')[Math.min(index,episodes.length-1)]:undoButton).focus();};li.append(label,remove);list.append(li);}
    undoButton.hidden=!undoEpisodes;
    counts.textContent=undoEpisodes?'Rijvoorbeeld verwijderd. Gebruik ‘Maak verwijderen ongedaan’ om het terug te zetten.':`${train} training · ${control} controle · ${duration.toFixed(1)} s · acties recht ${balance[0]}, links ${balance[1]}, rechts ${balance[2]}.`;
    const reserved=getTrackRole(doc)!=='training'&&getTrackRole(doc)!=='custom';root.querySelector<HTMLButtonElement>('.car-teach__example')!.disabled=reserved;
    if(reserved)root.querySelector<HTMLButtonElement>('.car-teach__example')!.title='Gereserveerde evaluatiecircuits kunnen geen trainingsvoorbeelden maken.';
  };
  const nextSeed=(role:'training'|'control')=>{const start=role==='training'?1000:2000,end=role==='training'?1999:2099;for(let n=start;n<=end;n++){if(!episodes.some(e=>e.seed===n)){return n;}}throw new Error(`Geen vrije ${role}zaadwaarde beschikbaar`);};
  const play=mountCarPlayView(game,{document:doc,getSeed:()=>{const role=getTrackRole(doc);const selected=role==='validation'||role==='final'?'control':nextManualRole;nextManualRole=selected==='training'?'control':'training';return nextSeed(selected);},onEpisodeStart:(seed)=>{recorder=new CarEpisodeRecorder(doc);recorder.start(`car-human-${seed}-${Date.now()}` ,seed,'human');},onStep:(_observation,action)=>{if(!recorder)throw new Error('Geen actieve auto-opname');recorder.step(action);},onEpisode:()=>{const e=recorder?.completedEpisode;if(e){episodes.push(e);publish(true);}}});
  root.querySelector<HTMLButtonElement>('.car-teach__clear')!.onclick=()=>{if(!episodes.length)return;undoEpisodes=[...episodes];episodes=[];publish();undoButton.focus();};
  undoButton.onclick=()=>{if(!undoEpisodes)return;episodes=[...undoEpisodes];undoEpisodes=undefined;publish();root.querySelector<HTMLButtonElement>('.car-teach__clear')?.focus();};
  root.querySelector<HTMLButtonElement>('.car-teach__example')!.onclick=()=>{try{assertTrainingTrack(doc);const t=nextSeed('training'),c=nextSeed('control');episodes.push(generateCarReferenceEpisode(doc,t),generateCarReferenceEpisode(doc,c));publish(true);}catch(e){counts.textContent=e instanceof Error?e.message:String(e);}};
  render();
  return {getEpisodes,setEpisodes(values){const split=splitCarEpisodes(values),all=[...split.training,...split.control];episodes=all.map(validateCarEpisode);undoEpisodes=undefined;publish();},dispose(){if(disposed)return;disposed=true;play.dispose();root.replaceChildren();}};
}
