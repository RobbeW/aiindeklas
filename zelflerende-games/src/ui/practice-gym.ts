import {trainingGymScene} from './training-gym.ts';
import '../styles/practice-gym.css';
import type { PracticeModelCheck } from '../learning/practice-check.ts';
import { practiceCheckText } from './practice-check-text.ts';

export interface PracticeGymProgress {
  status:'running'|'paused'|'complete'|'stopped'|'error';
  completed:number;budget:number;attempts:number;elapsedMs:number;message:string;canTest:boolean;
  modelCheck?:PracticeModelCheck;
}
/** Presents actual RL worker progress. Animation never drives training or its counters. */
export function mountPracticeGym(trigger:HTMLButtonElement,actions:{onPause:()=>void;onStop:()=>void;onTest:()=>void}) {
  const doc=trigger.ownerDocument,dialog=doc.createElement('dialog');
  dialog.className='training-gym practice-gym';
  dialog.setAttribute('aria-label','Snelle training');
  dialog.innerHTML=`<p class="gym-kicker">Zelfstandig oefenen · spelbeeld uit</p><h2 class="gym-heading">Even naar de gym.</h2>
    ${trainingGymScene()}
    <section class="gym-explanation"><h3>Zo oefent het AI-model verder</h3><ol class="gym-loop">
    <li><strong>De vogels proberen.</strong>Elke vogel speelt een poging met hetzelfde AI-model.</li>
    <li><strong>Beloning en straf.</strong>Het AI-model leert van de gevolgen van hun acties.</li>
    <li><strong>Een nieuwe ronde.</strong>De vogels spelen verder met het aangepaste AI-model.</li></ol></section>
    <div class="gym-progress-row"><progress class="gym-progress" aria-label="Voltooide trainingsrondes" value="0" max="256"></progress><span class="gym-count"></span></div>
    <p class="practice-gym-metrics"></p><p class="gym-model-check" hidden></p><p class="gym-status" role="status" aria-live="polite"></p>
    <div class="gym-actions"><button type="button" class="secondary practice-gym-pause">Pauzeer training</button><button type="button" class="secondary gym-stop">Stop training</button><button type="button" class="secondary gym-animation-toggle">Pauzeer animatie</button><button type="button" class="secondary gym-return" hidden>Terug naar experiment</button><button type="button" class="practice-gym-test" hidden>Test jouw AI-model</button></div>`;
  const q=<T extends HTMLElement=HTMLElement>(s:string)=>dialog.querySelector<T>(s)!;
  const pause=q<HTMLButtonElement>('.practice-gym-pause'),stop=q<HTMLButtonElement>('.gym-stop'),animation=q<HTMLButtonElement>('.gym-animation-toggle'),back=q<HTMLButtonElement>('.gym-return'),test=q<HTMLButtonElement>('.practice-gym-test');
  let current:PracticeGymProgress|undefined,disposed=false,animationPaused=false;
  const close=()=>{if(dialog.open)dialog.close();if(trigger.isConnected)trigger.focus({preventScroll:true});};
  const update=(p:PracticeGymProgress)=>{
    if(disposed)return;const wasActive=current?.status==='running'||current?.status==='paused';current=p;
    const active=p.status==='running'||p.status==='paused';dialog.dataset.state=p.status;dialog.dataset.animation=animationPaused?'paused':'playing';
    q('.gym-heading').textContent=p.status==='complete'?'Training klaar.':p.status==='stopped'?'Training gestopt.':p.status==='paused'?'Even pauze.':p.status==='error'?'Trainen is onderbroken.':'Even naar de gym.';
    const bar=q<HTMLProgressElement>('.gym-progress');bar.max=p.budget;bar.value=p.completed;
    q('.gym-count').textContent=`${p.completed} / ${p.budget} rondes`;
    q('.practice-gym-metrics').textContent=`${p.attempts.toLocaleString('nl-BE')} voltooide pogingen · ${(p.elapsedMs/1000).toFixed(1).replace('.',',')} s trainingstijd`;
    q('.gym-model-check').hidden=active||!p.modelCheck;
    q('.gym-model-check').textContent=p.modelCheck?practiceCheckText(p.modelCheck):'';
    q('.gym-status').textContent=p.message;q('.gym-status').setAttribute('role',p.status==='error'?'alert':'status');
    pause.hidden=stop.hidden=animation.hidden=!active;pause.textContent=p.status==='paused'?'Hervat training':'Pauzeer training';
    back.hidden=active;test.hidden=active||!p.canTest;
    if(wasActive&&!active&&dialog.open)(p.canTest?test:back).focus({preventScroll:true});
  };
  const cancel=(event:Event)=>{event.preventDefault();if(current?.status==='running'||current?.status==='paused')actions.onStop();else close();};
  dialog.addEventListener('cancel',cancel);pause.onclick=actions.onPause;stop.onclick=actions.onStop;back.onclick=close;
  animation.onclick=()=>{animationPaused=!animationPaused;dialog.dataset.animation=animationPaused?'paused':'playing';animation.textContent=animationPaused?'Hervat animatie':'Pauzeer animatie';};
  test.onclick=()=>{close();actions.onTest();};
  return {start(budget:number){if(disposed)return;animationPaused=false;animation.textContent='Pauzeer animatie';update({status:'running',completed:0,budget,attempts:0,elapsedMs:0,message:'De vogels oefenen zonder live spelbeeld.',canTest:false});if(!dialog.isConnected)doc.body.append(dialog);if(!dialog.open)dialog.showModal();pause.focus();},update,dispose(){disposed=true;if(dialog.open)dialog.close();dialog.removeEventListener('cancel',cancel);dialog.remove();}};
}
