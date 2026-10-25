import type { DemonstrationEpisode } from '../data/demonstrations.ts';
import { chooseRecording,type RecordingRole } from './recording-examples.ts';
import { gameCabinet } from './theory-diagram.ts';
import '../styles/theory-explainers.css';
import '../styles/schematic-common.css';

export function mountRecordingExplainer(root:HTMLElement,options:{episodes?:readonly DemonstrationEpisode[]}={}){
 const doc=root.ownerDocument;let role:RecordingRole='training',index=0,selected=chooseRecording(options.episodes??[],role);
 root.innerHTML=`<section class="theory-explainer recording-explainer" aria-labelledby="recording-theory-title"><header><p class="td-kicker">Vooraf · Voorbeelden</p><h2 id="recording-theory-title">Wat bewaart een opname?</h2><p>Een voorbeeld koppelt de situatie aan jouw actie: flappen of wachten.</p></header><div class="td-controls" role="group" aria-label="Kies een soort opname"><button type="button" class="secondary td-training" aria-pressed="true">Trainingsopname</button><button type="button" class="secondary td-validation" aria-pressed="false">Controleopname</button></div><p class="td-source"></p><figure><div class="td-stage"></div><figcaption>De waarneming en jouw actie vormen samen één voorbeeld.</figcaption></figure><div class="td-readout" role="status" aria-live="polite" aria-atomic="true"><h3 class="td-moment"></h3><p class="td-action"></p><p class="td-role-copy"></p></div><div class="td-cards" role="group" aria-label="Bekijk opgenomen spelmomenten"></div><details class="td-detail"><summary>Bekijk de vijf bewaarde getallen</summary><dl class="td-observations"></dl></details><div class="td-controls"><button type="button" class="secondary td-next">Volgend opgenomen moment</button><button type="button" class="secondary td-reset">Begin opnieuw</button></div><p class="td-caption">Uitlegvoorbeeld · je experiment blijft ongewijzigd.</p></section>`;
 const view=root.querySelector<HTMLElement>('.recording-explainer')!,q=<T extends HTMLElement>(s:string)=>view.querySelector<T>(s)!;
 const training=q<HTMLButtonElement>('.td-training'),validation=q<HTMLButtonElement>('.td-validation'),next=q<HTMLButtonElement>('.td-next'),reset=q<HTMLButtonElement>('.td-reset');
 const render=()=>{
  const current=selected.examples[index]!,action=current.frame.action?'flappen':'wachten';
  view.dataset.role=role;view.dataset.moment=String(index);
  q('.td-source').textContent=`${selected.episode.source==='human'?'Jouw bewaarde opname':'Vast synthetisch voorbeeld'}${selected.fallback?' · Je opname past niet bij deze spelversie.':''}`;
  q('.td-stage').innerHTML=`<div class="sch-flow sch-flow--three td-scene-flow">
   <div class="sch-object"><span class="sch-label">Spelmoment</span><div class="sch-platform td-game-platform"><svg viewBox="0 0 360 480" aria-hidden="true" focusable="false">${gameCabinet(current.world)}</svg></div></div><span class="sch-arrow" aria-hidden="true">→</span>
   <div class="sch-object"><span class="sch-label">Waarneming + actie</span><div class="sch-platform td-example-platform"><span class="sch-big">5 getallen</span><span class="sch-small">+ ${action}</span></div></div><span class="sch-arrow" aria-hidden="true">→</span>
   <div class="sch-object"><span class="sch-label">Bewaren in</span><div class="td-trays"><div class="sch-platform td-role-platform ${role==='training'?'is-active':''}"><span class="sch-label">Training</span><span class="td-role-selected" aria-label="${role==='training'?'Geselecteerd':'Niet geselecteerd'}">${role==='training'?'✓':''}</span></div><div class="sch-platform td-role-platform ${role==='validation'?'is-active':''}"><span class="sch-label">Controle</span><span class="td-role-selected" aria-label="${role==='validation'?'Geselecteerd':'Niet geselecteerd'}">${role==='validation'?'✓':''}</span></div></div></div>
  </div>`;
  q('.td-moment').textContent=`Moment ${index+1} van ${selected.examples.length} · spelstap ${current.frame.step}`;
  q('.td-action').textContent=`Jij koos: ${action}.`;
  q('.td-role-copy').textContent=role==='training'?'Training gebruikt deze voorbeelden om de keuzes na te doen.':'Controle meet hoe goed het AI-model jouw acties voorspelt.';
  q('.td-observations').innerHTML=['Hoogte','Verticale snelheid','Afstand tot opening','Bovenkant opening','Onderkant opening'].map((name,i)=>`<div><dt>${name}</dt><dd>${current.frame.observation[i]!.toLocaleString('nl-BE',{maximumFractionDigits:3})}</dd></div>`).join('');
  const cards=q('.td-cards'),focused=cards.contains(doc.activeElement)?(doc.activeElement as HTMLElement).dataset.exampleIndex:undefined;cards.replaceChildren();selected.examples.forEach((sample,i)=>{const b=doc.createElement('button');b.type='button';b.className='secondary';b.dataset.exampleIndex=String(i);b.textContent=`${i+1} · ${sample.frame.action?'Flappen':'Wachten'}`;b.setAttribute('aria-pressed',String(index===i));b.onclick=()=>{index=i;render();};cards.append(b);});if(focused!==undefined)cards.querySelector<HTMLButtonElement>(`[data-example-index="${focused}"]`)?.focus({preventScroll:true});
  training.setAttribute('aria-pressed',String(role==='training'));validation.setAttribute('aria-pressed',String(role==='validation'));next.disabled=index===selected.examples.length-1;
 };
 const choose=(value:RecordingRole)=>{role=value;index=0;selected=chooseRecording(options.episodes??[],role);render();};
 training.onclick=()=>choose('training');validation.onclick=()=>choose('validation');next.onclick=()=>{index=Math.min(index+1,selected.examples.length-1);render();};reset.onclick=()=>{index=0;render();};render();
 return{dispose(){training.onclick=validation.onclick=next.onclick=reset.onclick=null;root.replaceChildren();}};
}
