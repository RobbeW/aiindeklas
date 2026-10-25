import { renderLessonActions } from '../ui/lesson-actions.ts';
import { mountNavigationDrawer } from '../ui/navigation-drawer.ts';
import { loadReferenceTrack } from '../tracks/catalog.ts';
import type { CircuitDocument } from '../tracks/document.ts';
import { trackIdentity } from '../tracks/document.ts';
import { buildRoute } from '../tracks/route.ts';
import { mountCircuitWorkshop } from '../tracks/workshop-view.ts';
import { mountGenerationView } from './generation-view.ts';
import type { EvolutionProgress } from '../evolution/generation-job.ts';
import { mountCarPlayView } from './play-view.ts';
import { mountCarImitationView,type CarTeachState } from './imitation-view.ts';
import { mountCarPracticeView } from './practice-view.ts';
import type { CarPracticeProgress } from './practice-adapter.ts';
import { mountCarComparisonView } from './comparison-view.ts';
import type { EvaluationRecord } from '../evaluation/records.ts';
import { stableIdentity } from '../core/identity.ts';
export interface CarLearningState {readonly document:CircuitDocument;readonly draft?:CircuitDocument;readonly teach?:CarTeachState;readonly practice?:CarPracticeProgress;readonly records:readonly EvaluationRecord[];readonly evolution?:EvolutionProgress;}
export async function mountCarLearningView(root:HTMLElement,options:{state?:CarLearningState;initialStep?:string;onStepChange?:(step:string)=>void;onChange?:(state:CarLearningState)=>void}={}){
  let state:CarLearningState=options.state??{document:await loadReferenceTrack('teaching-loop'),records:[]},disposed=false;let active:{dispose():void}|undefined;
  root.innerHTML='<main class="car-learning"><header class="card"><p class="eyebrow">AI in de klas</p><h1>Zelflerende raceauto</h1><details class="context-help"><summary>Circuitinformatie</summary><p class="car-current-track"></p></details></header><div class="exercise-menu"><nav aria-label="Stappen autorijden"></nav></div><div class="lesson-guidance"></div><div class="car-learning-stage"></div><nav class="lesson-actions" aria-label="Volgende oefening"></nav></main>';
  const nav=root.querySelector('nav')!,stage=root.querySelector<HTMLElement>('.car-learning-stage')!,label=root.querySelector('.car-current-track')!;
  const menu=mountNavigationDrawer(root.querySelector<HTMLElement>('.exercise-menu')!,{label:'Open oefeningen',kind:'exercise'});
  const publish=()=>{label.textContent=`Actief circuit: ${trackIdentity(state.document)}. Een ander circuit kiezen verandert geen modelgewichten.`;options.onChange?.(state);};
  const entries=[['play','1 · Rijd'],['teach','2 · Leer van voorbeelden'],['practice','3 · Zelf oefenen'],['edit','4 · Bouw circuit'],['population','5 · Evolueer'],['compare','6 · Vergelijk']] as const;
  const choose=(key:string)=>{if(disposed)return;active?.dispose();stage.replaceChildren();for(const b of nav.querySelectorAll('button')){if(b.dataset.step===key)b.setAttribute('aria-current','step');else b.removeAttribute('aria-current');}
    options.onStepChange?.(key);
    renderLessonActions(root.querySelector<HTMLElement>('.lesson-actions')!,entries,key,choose);
    const guidance=root.querySelector<HTMLElement>('.lesson-guidance')!;guidance.replaceChildren();
    if(key==='practice'&&(!state.teach?.imitation||state.teach.stale)){const b=document.createElement('button');b.className='secondary';b.textContent='Ga naar voorbeelden en train je model';b.onclick=()=>choose('teach');guidance.append(b);}
    menu.setCurrent(entries.find(([id])=>id===key)![1]);
    if(key==='play')active=mountCarPlayView(stage,{document:state.document});
    if(key==='teach')active=mountCarImitationView(stage,{document:state.document,state:state.teach,onChange:teach=>{const changed=state.teach?.imitation&&stableIdentity(state.teach.imitation)!==stableIdentity(teach.imitation??null);state={...state,teach,practice:changed||teach.stale?undefined:state.practice};publish();}});
    if(key==='practice')active=mountCarPracticeView(stage,{document:state.document,source:state.teach?.stale?undefined:state.teach?.imitation,progress:state.teach?.stale?undefined:state.practice,onProgress:practice=>{state={...state,practice};publish();}});
    if(key==='edit')active=mountCircuitWorkshop(stage,{document:state.draft??state.document,onChange:draft=>{state={...state,draft};publish();},onTest:document=>{buildRoute(document);state={...state,document,draft:document,practice:undefined};publish();choose(entries.some(([id])=>id===options.initialStep)?options.initialStep!:'play');}});
    if(key==='population')active=mountGenerationView(stage,{document:state.document,progress:state.evolution,onProgress:evolution=>{state={...state,evolution};publish();}});
    if(key==='compare')active=mountCarComparisonView(stage,{models:[state.teach?.initial,...(!state.teach?.stale?[state.teach?.imitation,state.practice?.snapshot]:[]),state.evolution?.champion].filter((s):s is NonNullable<typeof s>=>!!s),records:state.records,onRecords:records=>{state={...state,records};publish();}});
  };
  for(const[key,text]of entries){const b=document.createElement('button');b.className='secondary';b.textContent=text;b.dataset.step=key;b.onclick=()=>choose(key);nav.append(b);}publish();choose(entries.some(([id])=>id===options.initialStep)?options.initialStep!:'play');
  return{getState:()=>state,dispose(){disposed=true;active?.dispose();menu.dispose();root.replaceChildren();}};
}
