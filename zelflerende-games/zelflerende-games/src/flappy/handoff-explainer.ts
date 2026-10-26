import type { PolicySnapshot } from '../learning/policy-snapshot.ts';
import { chipIcon } from './schematic-elements.ts';
import { chooseRecording } from './recording-examples.ts';
import { gameCabinet } from './theory-diagram.ts';
import { feedbackSteps,inspectHandoff,nextFeedbackStep,type FeedbackMode } from './handoff-explainer-state.ts';
import '../styles/theory-explainers.css';
import '../styles/schematic-common.css';

export function mountHandoffExplainer(root:HTMLElement,options:{snapshot?:PolicySnapshot;hasPractised?:boolean}={}){
 let mode:FeedbackMode='examples',step=0;const model=inspectHandoff(options.snapshot),world=chooseRecording([],'training').examples[0]!.world;
 root.innerHTML=`<section class="theory-explainer handoff-explainer" aria-labelledby="handoff-theory-title"><header><p class="td-kicker">Vooraf · Zelf proberen</p><h2 id="handoff-theory-title">Van voordoen naar zelf proberen</h2><p>Hetzelfde AI-model oefent verder. De feedback verandert.</p></header><div class="td-controls" role="group" aria-label="Kies hoe het model oefent"><button type="button" class="secondary td-examples" aria-pressed="true">Leren van jouw voorbeelden</button><button type="button" class="secondary td-rewards" aria-pressed="false">Leren van gevolgen</button></div><figure><div class="td-stage"><div class="sch-flow sch-flow--three td-handoff-flow">
  <div class="sch-object"><span class="sch-label">Situatie</span><div class="sch-platform td-game-platform"><svg viewBox="0 0 360 480" aria-hidden="true" focusable="false">${gameCabinet(world)}</svg></div></div><span class="sch-arrow" aria-hidden="true">→</span>
  <div class="sch-object"><span class="sch-label">AI-model</span><div class="sch-platform td-model-platform">${chipIcon}<span class="sch-small">Kiest flappen of wachten</span></div></div><span class="sch-arrow" aria-hidden="true">←</span>
  <div class="sch-object"><span class="sch-label">Feedback</span><div class="sch-platform td-feedback-platform"><span class="td-feedback-example"><strong>Jouw actie</strong><span>flappen of wachten</span></span><span class="td-feedback-reward"><strong>Beloning of straf</strong><span>positief of negatief getal</span></span></div></div>
 </div></div><figcaption>Kies de feedback voor het AI-model.</figcaption></figure><div class="td-readout" role="status" aria-live="polite" aria-atomic="true"><h3 class="td-step-title"></h3><p class="td-step-copy"></p><p class="td-model-copy"></p></div><div class="td-controls"><button type="button" class="secondary td-next">Volgende uitlegstap</button><button type="button" class="secondary td-reset">Begin opnieuw</button></div><details class="td-detail"><summary>Wat blijft hetzelfde?</summary><p>De vijf getallen en de acties flappen of wachten blijven gelijk. De uitlegknoppen veranderen je model niet.</p></details><p class="td-caption">Uitlegvoorbeeld · je experiment blijft ongewijzigd.</p></section>`;
 const view=root.querySelector<HTMLElement>('.handoff-explainer')!,q=<T extends HTMLElement>(s:string)=>view.querySelector<T>(s)!;
 const examples=q<HTMLButtonElement>('.td-examples'),rewards=q<HTMLButtonElement>('.td-rewards'),next=q<HTMLButtonElement>('.td-next'),reset=q<HTMLButtonElement>('.td-reset');
 const render=()=>{const copy=feedbackSteps[mode][step]!;view.dataset.mode=mode;view.dataset.step=String(step);q('.td-step-title').textContent=`${step+1} · ${copy.title}`;q('.td-step-copy').textContent=copy.text;
  q('.td-model-copy').textContent=model.available?(options.hasPractised?'Verder oefenen vertrekt van je laatst bewaarde oefenmodel.':'Hetzelfde AI-model start vanuit je bewaarde imitatie.'):'Maak en train eerst een imitatie bij Geef voorbeelden.';
  examples.setAttribute('aria-pressed',String(mode==='examples'));rewards.setAttribute('aria-pressed',String(mode==='rewards'));
 };
 examples.onclick=()=>{mode='examples';step=0;render();};rewards.onclick=()=>{mode='rewards';step=0;render();};next.onclick=()=>{step=nextFeedbackStep(step);render();};reset.onclick=()=>{mode='examples';step=0;render();};render();
 return{dispose(){examples.onclick=rewards.onclick=next.onclick=reset.onclick=null;root.replaceChildren();}};
}
