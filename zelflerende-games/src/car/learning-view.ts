import { mountNavigationDrawer } from '../ui/navigation-drawer.ts';
import { assertTrainingTrack } from '../tracks/catalog.ts';
import { trackIdentity,type CircuitDocument } from '../tracks/document.ts';
import { buildRoute } from '../tracks/route.ts';
import { createInitialLibrary,saveCircuit,getTrainingDocuments,type CircuitLibrary } from '../tracks/library.ts';
import { mountCircuitLibrary } from '../tracks/library-view.ts';
import { mountCircuitWorkshop } from '../tracks/workshop-view.ts';
import { mountGenerationView } from './generation-view.ts';
import { mountEvolutionLesson } from './evolution-lesson.ts';
import { mountCarLessonIllustration } from './lesson-illustrations.ts';
import type { EvolutionProgress } from '../evolution/generation-job.ts';
import { mountCarPlayView } from './play-view.ts';
import { mountCarImitationView,type CarTeachState } from './imitation-view.ts';
import { mountCarPracticeView } from './practice-view.ts';
import type { CarPracticeProgress } from './practice-adapter.ts';
import { mountCarComparisonView } from './comparison-view.ts';
import type { EvaluationRecord } from '../evaluation/records.ts';
import { stableIdentity } from '../core/identity.ts';
import { MAX_ANSWER_LENGTH } from '../flappy/lesson-notes.ts';
import type { CarLessonNotes,CarLessonStep,LessonPage } from './lesson-notes.ts';
import intro from '../content/car-intro.nl.json';
import '../styles/car-lesson.css';
export interface CarLearningState {readonly document:CircuitDocument;readonly draft?:CircuitDocument;readonly library?:CircuitLibrary;readonly notes?:CarLessonNotes;readonly teach?:CarTeachState;readonly practice?:CarPracticeProgress;readonly records:readonly EvaluationRecord[];readonly evolution?:EvolutionProgress;}
const entries=[['play','1 · Rijd'],['edit','2 · Bouw circuit'],['tracks','3 · Kies oefencircuits'],['population','4 · Evolueer'],['compare','5 · Vergelijk']] as const;
const legacy=[['teach','Extra · Rijvoorbeelden'],['practice','Extra · Eén model oefenen']] as const;
const pages=[['before','Vooraf'],['experiment','Experiment'],['after','Terugblik']] as const;
const esc=(s:string)=>s.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
export async function mountCarLearningView(root:HTMLElement,options:{state?:CarLearningState;initialStep?:string;initialLesson?:LessonPage;onStepChange?:(step:string,page:LessonPage)=>void;onChange?:(state:CarLearningState)=>void}={}){
 let state:CarLearningState=options.state??{document:createInitialLibrary().entries[0]!.document,records:[]},disposed=false,epoch=0;
 if(!state.library){let library=createInitialLibrary();try{assertTrainingTrack(state.document);if(!library.entries.some(e=>trackIdentity(e.document)===trackIdentity(state.document)))library=saveCircuit(library,'Mijn bewaarde circuit',state.document);}catch{/* Reserved legacy test document remains available to drive, outside training. */}state={...state,library};}
 let active:{dispose():void}|undefined,currentStep:CarLessonStep='play',currentPage:LessonPage='before';
 root.innerHTML='<main class="car-learning car-lesson"><div class="exercise-menu"><nav aria-label="Leerroute raceauto"></nav></div><nav class="lesson-pages" aria-label="Onderdelen van de oefening"></nav><div class="lesson-page-content"></div><nav class="lesson-actions" aria-label="Verder in deze oefening"></nav></main>';
 const nav=root.querySelector<HTMLElement>('.exercise-menu nav')!,stage=root.querySelector<HTMLElement>('.lesson-page-content')!,pageNav=root.querySelector<HTMLElement>('.lesson-pages')!,actions=root.querySelector<HTMLElement>('.lesson-actions')!;
 const menu=mountNavigationDrawer(root.querySelector<HTMLElement>('.exercise-menu')!,{label:'Open oefeningen',kind:'exercise'});
 const publish=()=>{if(!disposed)options.onChange?.(state);};
 const all=[...entries,...legacy];
 const addAction=(text:string,step:CarLessonStep,page:LessonPage,secondary=false)=>{const b=document.createElement('button');b.type='button';b.textContent=text;b.className=secondary?'secondary':'';b.onclick=()=>show(step,page,true);actions.append(b);};
 const answer=(field:'prediction'|'reflection',label:string)=>{const wrap=document.createElement('div');wrap.className='lesson-answer';const l=document.createElement('label'),input=document.createElement('textarea');input.id=`car-answer-${currentStep}-${field}`;input.rows=3;input.maxLength=MAX_ANSWER_LENGTH;input.value=state.notes?.[currentStep]?.[field]??'';l.htmlFor=input.id;l.textContent=label;const step=currentStep;input.oninput=()=>{state={...state,notes:{...state.notes,[step]:{prediction:'',reflection:'',...state.notes?.[step],[field]:input.value}}};publish();};wrap.append(l,input);return wrap;};
 const useDocument=(document:CircuitDocument)=>{buildRoute(document);const changed=trackIdentity(document)!==trackIdentity(state.document);state={...state,document,draft:document,...(changed?{practice:undefined,teach:state.teach?{...state.teach,stale:!!state.teach.imitation}:undefined}:{})};publish();};
 function show(step:CarLessonStep,page:LessonPage='before',focus=false){
  if(disposed)return;const token=++epoch;active?.dispose();active=undefined;currentStep=step;currentPage=page;
  const phase=intro.phases.find(p=>p.id===step)!;const index=entries.findIndex(([id])=>id===step);
  for(const b of nav.querySelectorAll<HTMLButtonElement>('[data-step]'))if(b.dataset.step===step)b.setAttribute('aria-current','step');else b.removeAttribute('aria-current');
  for(const b of pageNav.querySelectorAll<HTMLButtonElement>('[data-page]'))if(b.dataset.page===page)b.setAttribute('aria-current','page');else b.removeAttribute('aria-current');
  menu.setCurrent(all.find(([id])=>id===step)![1]);options.onStepChange?.(step,page);actions.replaceChildren();
  const host=document.createElement('div');host.className=`car-lesson-screen car-lesson-screen--${page}`;stage.replaceChildren(host);
  if(page==='before'){
   host.innerHTML=`<section class="card car-brief"><p class="eyebrow">${esc(all.find(([id])=>id===step)![1])} · Vooraf</p><h1 tabindex="-1">${esc(phase.title)}</h1>${step==='population'?'':`<p class="lesson-explanation">${esc(phase.explanation)}</p>`}<div class="car-illustration-host"></div><div class="car-answers"></div></section>`;
   const art=host.querySelector<HTMLElement>('.car-illustration-host')!;
   if(step==='population')active=mountEvolutionLesson(art,{onContinue:()=>show('population','experiment',true)});
   else if(['play','edit','tracks','compare'].includes(step))active=mountCarLessonIllustration(art,step as 'play'|'edit'|'tracks'|'compare');
   host.querySelector('.car-answers')!.append(answer('prediction',phase.prediction));addAction('Naar het experiment',step,'experiment');
  }else if(page==='after'){
   host.innerHTML=`<section class="card car-brief"><p class="eyebrow">${esc(all.find(([id])=>id===step)![1])} · Terugblik</p><h1 tabindex="-1">Wat heb je ontdekt?</h1><div class="car-result-summary"></div><div class="car-answers"></div></section>`;
   const summary=host.querySelector<HTMLElement>('.car-result-summary')!;
   if(step==='tracks')summary.textContent=`Je oefenreeks: ${state.library!.selectedIds.map(id=>state.library!.entries.find(e=>e.id===id)?.name).filter(Boolean).join(' → ')||'nog geen circuits gekozen'}.`;
   if(step==='population'&&state.evolution){const e=state.evolution,currentIds=state.library!.selectedIds.map(id=>trackIdentity(state.library!.entries.find(x=>x.id===id)!.document)),earlier=stableIdentity(e.trainingTrackIds)!==stableIdentity(currentIds);summary.textContent=`${earlier?'Eerdere oefenreeks · ':''}${e.completedGenerations} ${e.completedGenerations===1?'generatie':'generaties'} · ${e.evaluatedEpisodes} complete ritten · ${(e.elapsedMs/1000).toFixed(1).replace('.',',')} seconden oefentijd.`;}
   host.querySelector('.car-answers')!.append(answer('reflection',phase.reflection));addAction('Terug naar het experiment',step,'experiment',true);const next=entries[index+1];if(index>=0&&next)addAction(`Volgende: ${next[1].replace(/^\d+ · /,'')}`,next[0],'before');
  }else{
   host.innerHTML='<h1 class="car-experiment-title" tabindex="-1"></h1><div class="car-experiment-host"></div>';
   host.querySelector('h1')!.textContent=phase.title;const experiment=host.querySelector<HTMLElement>('.car-experiment-host')!;
   addAction('Terug naar vooraf',step,'before',true);addAction('Naar de terugblik',step,'after');
   try{
    if(step==='play')active=mountCarPlayView(experiment,{document:state.document});
    else if(step==='edit')active=mountCircuitWorkshop(experiment,{document:state.draft??state.document,onChange:draft=>{state={...state,draft};publish();},onTest:document=>{useDocument(document);show('play','experiment',true);},onSave:(name,document)=>{state={...state,library:saveCircuit(state.library!,name,document)};useDocument(document);}});
    else if(step==='tracks')active=mountCircuitLibrary(experiment,{state:state.library!,onChange:library=>{state={...state,library};publish();},onChoose:entry=>{
     const open=()=>{useDocument(entry.document);show('edit','experiment',true);};
     if(state.draft&&trackIdentity(state.draft)!==trackIdentity(state.document)){
      experiment.querySelector('.circuit-replace-choice')?.remove();const panel=document.createElement('section');panel.className='card circuit-replace-choice';panel.setAttribute('role','alert');const text=document.createElement('p');text.textContent='Je ontwerp bevat wijzigingen die nog niet als circuit zijn bewaard. Bewaar het eerst in de bouwer, of kies bewust een ander circuit.';const keep=document.createElement('button');keep.type='button';keep.textContent='Terug naar mijn ontwerp';keep.onclick=()=>show('edit','experiment',true);const replace=document.createElement('button');replace.type='button';replace.className='secondary';replace.textContent='Open toch het andere circuit';replace.onclick=open;panel.append(text,keep,replace);experiment.prepend(panel);keep.focus();
     }else open();
    }});
    else if(step==='population')active=mountGenerationView(experiment,{document:state.document,documents:getTrainingDocuments(state.library!),progress:state.evolution,showIntro:false,onProgress:evolution=>{if(token===epoch&&!disposed){state={...state,evolution};publish();}}});
    else if(step==='teach')active=mountCarImitationView(experiment,{document:state.document,state:state.teach,onChange:teach=>{const changed=state.teach?.imitation&&stableIdentity(state.teach.imitation)!==stableIdentity(teach.imitation??null);state={...state,teach,practice:changed||teach.stale?undefined:state.practice};publish();}});
    else if(step==='practice')active=mountCarPracticeView(experiment,{document:state.document,source:state.teach?.stale?undefined:state.teach?.imitation,progress:state.teach?.stale?undefined:state.practice,onProgress:practice=>{state={...state,practice};publish();}});
    else active=mountCarComparisonView(experiment,{models:[...new Map([...(state.evolution?.milestones??[]),state.evolution?.champion,...(!state.evolution?.champion?[state.teach?.initial,...(!state.teach?.stale?[state.teach?.imitation,state.practice?.snapshot]:[])]:[])].filter((s):s is NonNullable<typeof s>=>!!s).map(s=>[stableIdentity(s),s])).values()],records:state.records,onRecords:records=>{state={...state,records};publish();}});
   }catch(e){const p=document.createElement('p');p.setAttribute('role','alert');p.textContent=e instanceof Error?e.message:String(e);experiment.append(p);}
   const duplicate=experiment.querySelector('h2');if(duplicate?.textContent?.replace(/[.!?]+$/,'')===phase.title.replace(/[.!?]+$/,''))duplicate.hidden=true;
  }
  if(focus){const heading=host.querySelector<HTMLElement>('h1')!;heading.focus({preventScroll:true});root.scrollIntoView({block:'start',behavior:'instant'});}
 }
 for(const [key,text]of entries){const b=document.createElement('button');b.type='button';b.className='secondary';b.textContent=text;b.dataset.step=key;b.onclick=()=>show(key,'before',true);nav.append(b);}
 const extras=document.createElement('details');extras.className='context-help';extras.innerHTML='<summary>Extra gereedschap</summary>';for(const[key,text]of legacy){const b=document.createElement('button');b.type='button';b.className='secondary';b.textContent=text;b.dataset.step=key;b.onclick=()=>show(key,'before',true);extras.append(b);}nav.append(extras);
 for(const[key,text]of pages){const b=document.createElement('button');b.type='button';b.className='secondary';b.textContent=text;b.dataset.page=key;b.onclick=()=>{if(currentPage!==key)show(currentStep,key,true);};pageNav.append(b);}
 publish();show(all.some(([id])=>id===options.initialStep)?options.initialStep as CarLessonStep:'play',options.initialLesson??'before');
 return{getState:()=>state,dispose(){disposed=true;epoch++;active?.dispose();menu.dispose();root.replaceChildren();}};
}
