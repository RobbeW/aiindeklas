import { startTrainingGym,updateTrainingGym,type TrainingGymState,type TrainingGymEvent } from './training-gym-state.ts';
import '../styles/training-gym.css';
let gymNumber=0;
/** Visualises an actual supervised job; no timer or simulated progress. */
export function mountTrainingGym(trigger:HTMLButtonElement,onCancel:()=>void){
 const doc=trigger.ownerDocument,id=`training-gym-${++gymNumber}`,dialog=doc.createElement('dialog');
 dialog.className='training-gym';dialog.setAttribute('aria-labelledby',`${id}-title`);dialog.setAttribute('aria-describedby',`${id}-meaning`);
 dialog.innerHTML=`<p class="gym-kicker">Leren van voorbeelden</p><h2 class="gym-heading" id="${id}-title">Even naar de gym.</h2>
 <div class="gym-scene" aria-hidden="true"><span class="gym-wall-label">FLAP GYM</span><div class="gym-floor"></div><div class="gym-mat"></div><div class="gym-lifter"><img class="gym-bird" src="${import.meta.env.BASE_URL}assets/flappy/redbird-midflap.png" alt="" width="88" height="62"><svg class="gym-barbell" viewBox="0 0 200 52"><rect x="16" y="22" width="168" height="8" rx="3" fill="#625B70"/><rect x="24" y="8" width="16" height="36" rx="3" fill="#3700B3"/><rect x="40" y="2" width="18" height="48" rx="3" fill="#5200FF"/><rect x="142" y="2" width="18" height="48" rx="3" fill="#5200FF"/><rect x="160" y="8" width="16" height="36" rx="3" fill="#3700B3"/></svg></div></div>
 <p class="gym-metaphor" id="${id}-meaning">De ‘gewichten’ in het model zijn getallen die bepalen hoe het kiest.</p>
 <section class="gym-explanation"><h3>Dit herhaalt de computer in elke oefenronde:</h3><ol class="gym-loop"><li><strong>Bekijk je voorbeelden.</strong><span>De situatie vóór jouw actie hoort bij jouw keuze: flappen of wachten.</span></li><li><strong>Vergelijk de schattingen.</strong><span>Hoe goed past de geschatte kans op flappen bij wat jij deed?</span></li><li><strong>Pas de getallen aan.</strong><span>Kleine aanpassingen proberen het verschil te verkleinen. Daarna volgen dezelfde voorbeelden opnieuw.</span></li></ol></section>
 <div class="gym-progress-row"><progress class="gym-progress" aria-label="Voltooide oefenrondes" value="0" max="250"></progress><span class="gym-count" aria-live="off"></span></div>
 <p class="gym-status" role="status" aria-live="polite"></p><p class="gym-result-copy" hidden></p>
 <div class="gym-actions"><button type="button" class="secondary gym-animation-toggle">Pauzeer animatie</button><button type="button" class="secondary gym-stop">Annuleer training</button><button type="button" class="gym-return" hidden>Terug naar experiment</button></div>`;
 const q=<T extends HTMLElement>(selector:string)=>dialog.querySelector<T>(selector)!;
 const status=q('.gym-status'),count=q('.gym-count'),bar=q<HTMLProgressElement>('.gym-progress'),animation=q<HTMLButtonElement>('.gym-animation-toggle'),stop=q<HTMLButtonElement>('.gym-stop'),back=q<HTMLButtonElement>('.gym-return'),result=q('.gym-result-copy');
 let state:TrainingGymState|undefined,disposed=false;
 const render=()=>{if(!state)return;const active=state.status==='running'||state.status==='stopping';dialog.dataset.state=state.status;bar.max=state.budget;bar.value=state.completed;
  count.textContent=`${state.completed} van ${state.budget} oefenrondes · ${Math.floor(state.completed/state.budget*100)}%`;
  q('.gym-heading').textContent=state.status==='complete'?'Training klaar.':state.status==='cancelled'?'Training gestopt.':state.status==='error'?'Trainen lukt nog niet.':'Even naar de gym.';
  status.setAttribute('role',state.status==='error'?'alert':'status');if(status.textContent!==state.message)status.textContent=state.message;
  stop.hidden=!active;stop.disabled=state.status==='stopping';animation.hidden=!active;animation.disabled=state.status==='stopping';back.hidden=active;result.hidden=active||state.status==='complete';
  result.textContent=state.status==='complete'?'':state.status==='cancelled'?'Je voorbeelden blijven bewaard. Je kunt opnieuw trainen.':'Kies Terug naar experiment om je voorbeelden aan te passen.';
  if(!active&&dialog.open)back.focus({preventScroll:true});
 };
 const close=()=>{if(dialog.open)dialog.close();if(trigger.isConnected)trigger.focus({preventScroll:true});};
 const cancel=()=>{if(state?.status!=='running')return;state=updateTrainingGym(state,{type:'stop'});render();onCancel();};
 const nativeCancel=(event:Event)=>{event.preventDefault();if(state?.status==='running')cancel();else if(state?.status!=='stopping')close();};
 dialog.addEventListener('cancel',nativeCancel);stop.onclick=cancel;back.onclick=close;
 animation.onclick=()=>{const paused=dialog.dataset.animation!=='paused';dialog.dataset.animation=paused?'paused':'playing';animation.textContent=paused?'Hervat animatie':'Pauzeer animatie';};
 const apply=(event:TrainingGymEvent)=>{if(disposed||!state)return;state=updateTrainingGym(state,event);render();};
 return{
  start(budget:number){if(disposed)return;state=startTrainingGym(budget);dialog.dataset.animation='playing';animation.textContent='Pauzeer animatie';render();if(!dialog.isConnected)doc.body.append(dialog);if(!dialog.open)dialog.showModal();stop.focus();},
  progress(completed:number){apply({type:'progress',completed});},
  complete(completed:number){apply({type:'complete',completed});},
  cancelled(message:string){apply({type:'cancelled',message});},
  error(message:string){apply({type:'error',message});},
  dispose(){if(disposed)return;disposed=true;if(dialog.open)dialog.close();dialog.removeEventListener('cancel',nativeCancel);dialog.remove();}
 };
}
