import type { CarWorldVersion } from './config.ts';
import type { CircuitDocument } from '../tracks/document.ts';
import { getTrackRole } from '../tracks/catalog.ts';
import { mountCarPlayView } from './play-view.ts';
import { CarEpisodeRecorder, splitCarEpisodes, validateCarEpisode, type CarEpisode } from './recorder.ts';

export interface CarTeachViewOptions { readonly document:CircuitDocument;readonly worldVersion?:CarWorldVersion; readonly onChange?:(episodes:readonly CarEpisode[])=>void; }
export interface CarTeachView {getEpisodes():readonly CarEpisode[];setEpisodes(episodes:readonly CarEpisode[]):void;dispose():void;}
/** Legacy recording tool; the main car route proceeds directly to circuit sets and evolution. */
export function mountCarTeachView(root:HTMLElement,options:CarTeachViewOptions):CarTeachView {
 let episodes:CarEpisode[]=[],recorder:CarEpisodeRecorder|undefined,disposed=false,nextManualRole:'training'|'control'='training';
 root.innerHTML='<section class="card car-teach"><h2>Neem rijvoorbeelden op</h2><p>Rijd een poging uit om je opname te bewaren.</p><p class="car-teach__counts" role="status" aria-live="polite"></p><div class="car-teach__game"></div></section>';
 const counts=root.querySelector<HTMLElement>('.car-teach__counts')!;
 const getEpisodes=()=>Object.freeze([...episodes]);
 const publish=()=>{counts.textContent=`${episodes.filter(e=>e.seed<2000).length} trainingsopnamen · ${episodes.filter(e=>e.seed>=2000).length} controleopnamen`;options.onChange?.(getEpisodes());};
 const nextSeed=(role:'training'|'control')=>{const first=role==='training'?1000:2000,last=role==='training'?1999:2099;for(let seed=first;seed<=last;seed++)if(!episodes.some(e=>e.seed===seed))return seed;throw new Error('Geen vrije seed voor een nieuwe opname.');};
 const play=mountCarPlayView(root.querySelector('.car-teach__game')!,{document:options.document,worldVersion:options.worldVersion,humanSpeedControl:false,getSeed:()=>{const role=getTrackRole(options.document);const selected=role==='validation'||role==='final'?'control':nextManualRole;nextManualRole=selected==='training'?'control':'training';return nextSeed(selected);},onEpisodeStart:seed=>{recorder=new CarEpisodeRecorder(options.document,options.worldVersion);recorder.start(`car-human-${seed}-${Date.now()}`,seed,'human');},onStep:(_observation,action)=>{if(!recorder)throw new Error('Geen actieve auto-opname');recorder.step(action);},onEpisode:()=>{if(recorder?.completedEpisode){episodes.push(recorder.completedEpisode);publish();}}});
 publish();return{getEpisodes,setEpisodes(values){const split=splitCarEpisodes(values);episodes=[...split.training,...split.control].map(validateCarEpisode);publish();},dispose(){if(disposed)return;disposed=true;play.dispose();root.replaceChildren();}};
}
