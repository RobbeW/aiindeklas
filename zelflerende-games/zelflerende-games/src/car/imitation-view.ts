import { disclose } from '../ui/disclosure.ts';
import { WORKLOADS } from '../config/workload-presets.ts';
import type { CircuitDocument } from '../tracks/document.ts';
import { mountCarTeachView } from './teach-view.ts';
import { mountCarPlayView } from './play-view.ts';
import { splitCarEpisodes,type CarEpisode } from './recorder.ts';
import { CarPolicy,createCarSnapshot,restoreCarSnapshot,validateCarSnapshot,type CarSnapshot } from './policy-adapter.ts';
import { WorkerJobClient } from '../core/worker-client.ts';
import type { WorkerPort } from '../core/worker-protocol.ts';
import type { CarImitationInput,CarImitationProgress,CarImitationResult } from './imitation-job.ts';
export interface CarTeachState {readonly episodes:readonly CarEpisode[];readonly initial:CarSnapshot;readonly imitation?:CarSnapshot;readonly stale:boolean;}
export function mountCarImitationView(root:HTMLElement,options:{document:CircuitDocument;state?:CarTeachState;onChange?:(state:CarTeachState)=>void}){
  let state:CarTeachState=options.state??{episodes:[],initial:createCarSnapshot(new CarPolicy(1222),'initial'),stale:false};
  let disposed=false,epoch=0,running=false,restoring=true;let clone:ReturnType<typeof mountCarPlayView>|undefined;
  root.innerHTML='<section class="card car-imitation"><h2>Leer van je rijvoorbeelden</h2><p>Rijd voorbeelden, train de imitatie en bekijk hoe die rijdt.</p><div class="car-collector"></div><div class="toolbar"><button class="car-fit">Train imitatie</button><button class="secondary car-fit-pause" disabled>Pauzeer training</button><button class="secondary car-fit-cancel" disabled>Stop training</button><button class="secondary car-watch" disabled>Test mijn imitatie</button></div><p class="car-fit-status" role="status" aria-live="polite">Verzamel complete trainings- en controlepogingen.</p><p class="car-fit-metrics"></p><div class="car-clone"></div><details class="context-help"><summary>Hoe leert de imitatie?</summary><p>Trainingsvoorbeelden passen de gewichten aan. Controlevoorbeelden meten de fout zonder te trainen. Test ook het rijgedrag: een lage fout garandeert geen ronde.</p><p>Het synthetische oefenpaar is door de computer gemaakt met voorkennis van de route, niet door een leerling.</p></details></section>';
  disclose(root,'Trainingsmetingen',['.car-fit-metrics']);
  const q=<T extends HTMLElement>(s:string)=>root.querySelector<T>(s)!;
  const fit=q<HTMLButtonElement>('.car-fit'),pause=q<HTMLButtonElement>('.car-fit-pause'),cancel=q<HTMLButtonElement>('.car-fit-cancel'),watch=q<HTMLButtonElement>('.car-watch'),status=q('.car-fit-status');
  q('.car-collector').before(fit.parentElement!,status);
  const jobs=new WorkerJobClient<CarImitationInput,CarImitationProgress,CarImitationResult>(()=>new Worker(new URL('../workers/car-imitation.worker.ts',import.meta.url),{type:'module'}) as unknown as WorkerPort);
  const publish=()=>{if(!disposed)options.onChange?.(state);};
  const controls=()=>{fit.disabled=running;pause.disabled=cancel.disabled=!running;watch.disabled=running||!state.imitation||state.stale;};
  const invalidate=()=>{epoch++;jobs.cancel();running=false;clone?.dispose();clone=undefined;state={...state,stale:!!state.imitation};status.textContent=state.stale?'Voorbeelden gewijzigd: train opnieuw voordat je deze kloon gebruikt.':'Voorbeelden bijgewerkt.';pause.textContent='Pauzeer training';controls();};
  const collector=mountCarTeachView(q('.car-collector'),{document:options.document,onChange:episodes=>{state={...state,episodes};if(!restoring){invalidate();publish();}}});
  collector.setEpisodes(state.episodes);restoring=false;controls();if(state.imitation)status.textContent=state.stale?'Voorbeelden gewijzigd. Train de imitatie opnieuw.':'Imitatie klaar. Bekijk hoe die rijdt.';
  fit.onclick=()=>{try{const splits=splitCarEpisodes(state.episodes);if(!splits.training.length||!splits.control.length)throw new Error('Verzamel minimaal één trainingspoging en één controlepoging.');
    invalidate();const token=++epoch;running=true;controls();status.textContent='Imitatie leert van de trainingsvoorbeelden…';
    const job=jobs.start({initialSnapshot:state.initial,episodes:state.episodes,updateBudget:WORKLOADS.supervisedUpdates},p=>{if(disposed||token!==epoch)return;status.textContent=`Training: ${p.completedUpdates}/250 updates`;q('.car-fit-metrics').textContent=`Trainingsfout ${p.trainingLoss.toFixed(3)} · controlefout ${p.controlLoss.toFixed(3)}`;});
    void job.promise.then(result=>{if(disposed||token!==epoch)return;state={...state,imitation:validateCarSnapshot(result.snapshot),stale:false};status.textContent='Imitatie klaar. Bekijk hoe die rijdt.';q('.car-fit-metrics').textContent=`${result.completedUpdates} updates · trainingsfout ${result.trainingLoss.toFixed(3)} · controlefout ${result.controlLoss.toFixed(3)}`;publish();}).catch(e=>{if(!disposed&&token===epoch)status.textContent=e instanceof Error?e.message:String(e);}).finally(()=>{if(!disposed&&token===epoch){running=false;controls();}});
  }catch(e){status.textContent=e instanceof Error?e.message:String(e);}};
  cancel.onclick=()=>{epoch++;jobs.cancel();running=false;status.textContent='Training gestopt. Onvoltooide training wordt niet bewaard.';pause.textContent='Pauzeer training';controls();};
  pause.onclick=()=>{if(pause.textContent==='Pauzeer training'){jobs.pause();pause.textContent='Hervat training';}else{jobs.resume();pause.textContent='Pauzeer training';}};
  watch.onclick=()=>{if(!state.imitation||state.stale)return;clone?.dispose();const policy=restoreCarSnapshot(state.imitation);clone=mountCarPlayView(q('.car-clone'),{document:options.document,getSeed:()=>2005,controller:o=>policy.action(o),controllerLabel:`Imitatie · test op hetzelfde circuit`});q('.car-clone').scrollIntoView({block:'start'});};
  return{getState:()=>state,dispose(){disposed=true;epoch++;jobs.dispose();collector.dispose();clone?.dispose();root.replaceChildren();}};
}
