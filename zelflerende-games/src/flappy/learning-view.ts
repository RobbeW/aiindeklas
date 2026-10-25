import { mountNavigationDrawer } from '../ui/navigation-drawer.ts';
import { mountControlTour } from '../ui/control-tour.ts';
import { mountFlappyDuelView } from './duel-view.ts';
import { mountFlappyTeachView,type TeachState } from './teach-view.ts';
import { mountFlappyPracticeView } from './practice-view.ts';
import { mountComparisonView } from '../evaluation/comparison-view.ts';
import type { PolicySnapshot } from '../learning/policy-snapshot.ts';
import type { PracticeProgress } from '../learning/practice-job.ts';
import { stableIdentity,type EvaluationRecord } from '../evaluation/records.ts';
import { BernoulliPolicy } from '../learning/policy.ts';
import { createPolicySnapshot } from '../learning/policy-snapshot.ts';
import { MAX_ANSWER_LENGTH,type FlappyLessonNotes,type FlappyLessonStep,type LessonAnswers,type LessonPage } from './lesson-notes.ts';
import { flappyTourSteps } from './lesson-tour.ts';
import { mountObservationExplainer } from './observation-explainer.ts';
import { mountRecordingExplainer } from './recording-explainer.ts';
import { mountHandoffExplainer } from './handoff-explainer.ts';
import { mountCoverageExplainer } from './coverage-explainer.ts';
import { mountTestingExplainer } from './testing-explainer.ts';
import { mountFrozenFlockExplainer } from './frozen-flock-explainer.ts';
import { mountRewardLesson } from './reward-lesson.ts';
import { mountFlappyArenaView } from './arena-view.ts';
import intro from '../content/flappy-intro.nl.json';
import '../styles/flappy-lesson.css';

export interface FlappyLearningState {
 readonly teach?:TeachState;readonly postRl?:PolicySnapshot;readonly practice?:PracticeProgress;
 readonly human:readonly EvaluationRecord[];readonly records?:readonly EvaluationRecord[];readonly notes?:FlappyLessonNotes;
}
const esc=(text:string)=>text.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
type ExperienceStep=FlappyLessonStep|'arena';
const tabs=[['play','1 · Speel'],['teach','2 · Geef voorbeelden'],['practice','3 · Oefen zelfstandig'],['compare','4 · Vergelijk'],['arena','5 · Daag het AI-model uit']] as const;
const pages=[['before','Vooraf'],['experiment','Experiment'],['after','Terugblik']] as const;
export async function mountFlappyLearningView(root:HTMLElement,options:{state?:FlappyLearningState;initialStep?:string;initialLesson?:LessonPage;onStepChange?:(step:string,page:LessonPage)=>void;onChange?:(state:FlappyLearningState)=>void}={}) {
 root.innerHTML='<div class="learning-shell flappy-lesson"><div class="exercise-menu"><nav aria-label="Flappy leerroute"></nav></div><nav class="lesson-pages" aria-label="Onderdelen van de oefening"></nav><div class="lesson-page-content"></div><nav class="lesson-actions" aria-label="Verder in deze oefening"></nav></div>';
 const nav=root.querySelector('nav')!,content=root.querySelector<HTMLElement>('.lesson-page-content')!,pageNav=root.querySelector<HTMLElement>('.lesson-pages')!,actions=root.querySelector<HTMLElement>('.lesson-actions')!;
 const menu=mountNavigationDrawer(root.querySelector<HTMLElement>('.exercise-menu')!,{label:'Open oefeningen',kind:'exercise'});
 let active:{dispose():void}|undefined,tour:ReturnType<typeof mountControlTour>|undefined,epoch=0,disposed=false;
 let currentTab:FlappyLessonStep='play',currentPage:LessonPage='before';
 let teach=options.state?.teach,postRl=options.state?.postRl,practice=options.state?.practice,notes:FlappyLessonNotes={...options.state?.notes};
 let human:readonly EvaluationRecord[]=options.state?.human??[],modelRecords=options.state?.records??[];
 let imitationId=teach?.imitationSnapshot&&!teach.imitationIsStale?stableIdentity(teach.imitationSnapshot.parameters):'';
 const getState=():FlappyLearningState=>({teach,postRl,practice,human,records:modelRecords,notes});
 const publish=()=>options.onChange?.(getState());
 const updateTeach=(value:TeachState)=>{const id=value.imitationSnapshot&&!value.imitationIsStale?stableIdentity(value.imitationSnapshot.parameters):'';if(id!==imitationId){postRl=undefined;practice=undefined;imitationId=id;}teach=value;publish();};
 const answer=(field:keyof LessonAnswers,label:string)=>{
  const wrapper=document.createElement('div');wrapper.className='lesson-answer';const caption=document.createElement('label'),input=document.createElement('textarea');
  input.id=`answer-${currentTab}-${field}`;input.rows=3;input.maxLength=MAX_ANSWER_LENGTH;input.value=notes[currentTab]?.[field]??'';caption.htmlFor=input.id;caption.textContent=label;
  const step=currentTab;input.addEventListener('input',()=>{notes={...notes,[step]:{prediction:'',reflection:'',nextTry:'',...notes[step],[field]:input.value}};publish();});wrapper.append(caption,input);return wrapper;
 };
 const addAction=(label:string,page:LessonPage,secondary=false,tab:ExperienceStep=currentTab)=>{const button=document.createElement('button');button.type='button';button.textContent=label;if(secondary)button.className='secondary';button.onclick=()=>void show(tab,page,true);actions.append(button);};
 async function show(tab:ExperienceStep,page:LessonPage='before',focus=false){
  const token=++epoch;tour?.dispose();tour=undefined;active?.dispose();active=undefined;
  root.querySelector('.flappy-lesson')!.classList.toggle('flappy-lesson--arena',tab==='arena');pageNav.hidden=tab==='arena';
  if(tab==='arena')page='experiment';else currentTab=tab;currentPage=page;
  const host=document.createElement('div');host.className=`lesson-screen lesson-screen--${page}`;content.replaceChildren(host);actions.replaceChildren();
  for(const b of nav.querySelectorAll('button'))if(b.dataset.tab===tab)b.setAttribute('aria-current','step');else b.removeAttribute('aria-current');
  for(const b of pageNav.querySelectorAll('button'))if(b.dataset.page===page)b.setAttribute('aria-current','page');else b.removeAttribute('aria-current');
  options.onStepChange?.(tab,page);menu.setCurrent(tabs.find(([id])=>id===tab)![1]);
  if(tab==='arena'){
   try{const view=await mountFlappyArenaView(host,{snapshot:postRl,onPractice:()=>void show('practice','experiment',true)});if(disposed||token!==epoch){view.dispose();return;}active=view;}
   catch(e){if(token===epoch&&!disposed){const p=document.createElement('p');p.setAttribute('role','alert');p.textContent=e instanceof Error?e.message:String(e);host.append(p);}}
   if(focus&&token===epoch&&!disposed){const heading=host.querySelector<HTMLElement>('h1');heading?.setAttribute('tabindex','-1');heading?.focus({preventScroll:true});root.scrollIntoView({block:'start',behavior:'instant'});}return;
  }
  const phase=intro.phases.find(p=>p.id===tab)!;
  if(page==='before'){
   host.innerHTML=`<section class="card lesson-brief"><p class="eyebrow">${esc(tabs.find(([id])=>id===tab)![1])} · Vooraf</p><h1 tabindex="-1" class="lesson-screen-title">${esc(phase.title)}</h1><p class="lesson-explanation">${esc(phase.explanation)}</p><h2>Dit ga je doen</h2><ol>${phase.instructions?.map(line=>`<li>${esc(line)}</li>`).join('')??''}</ol><div class="lesson-answers"></div><p class="muted lesson-note">Je mag eerst proberen. Je antwoord blijft bij dit experiment, ook als je een bestand exporteert. Gebruik geen namen of persoonlijke gegevens.</p></section>`;
   {
    const theory=document.createElement('div');theory.className='lesson-theory';host.querySelector('h2')!.before(theory);
    const children:{dispose():void}[]=[],cleanups:(()=>void)[]=[];
    const extra=(label:string,mount:(root:HTMLElement)=>{dispose():void})=>{
     const details=document.createElement('details'),summary=document.createElement('summary'),body=document.createElement('div');details.className='lesson-theory-extra';summary.textContent=label;details.append(summary,body);theory.append(details);let child:{dispose():void}|undefined;
     const toggle=()=>{if(details.open){if(!child)child=mount(body);}else{child?.dispose();child=undefined;}};details.addEventListener('toggle',toggle);cleanups.push(()=>{details.removeEventListener('toggle',toggle);child?.dispose();});
    };
    const main=document.createElement('div');theory.append(main);
    const snapshot=teach&&!teach.imitationIsStale?teach.imitationSnapshot:undefined;
    if(tab==='play')children.push(mountObservationExplainer(main));
    else if(tab==='teach'){children.push(mountRecordingExplainer(main,{episodes:teach?.episodes}));extra('Verschillende voorbeelden',mountCoverageExplainer);extra('Oefenen en testen',mountTestingExplainer);extra('Wat ziet het AI-model?',body=>mountObservationExplainer(body,{snapshot}));}
    else if(tab==='practice'){children.push(mountHandoffExplainer(main,{snapshot,hasPractised:!!postRl}));extra('Beloning, straf en de Skinnerbox',mountRewardLesson);extra('Twaalf vogels, één AI-model',body=>mountFrozenFlockExplainer(body,{snapshot:postRl??snapshot,onOpenLive:()=>{void show('practice','experiment',true).then(()=>root.querySelector('.flock-panel')?.scrollIntoView({block:'start',behavior:'instant'}));}}));}
    else children.push(mountTestingExplainer(main));
    active={dispose(){for(const cleanup of cleanups)cleanup();for(const child of children)child.dispose();}};
   }
   host.querySelector('.lesson-answers')!.append(answer('prediction',phase.prediction));addAction('Naar het experiment','experiment');
  }else if(page==='after'){
   const prediction=notes[tab]?.prediction;
   host.innerHTML=`<section class="card lesson-brief"><p class="eyebrow">${esc(tabs.find(([id])=>id===tab)![1])} · Terugblik</p><h1 tabindex="-1" class="lesson-screen-title">Wat heb je ontdekt?</h1>${prediction?`<blockquote><strong>Je voorspelling</strong><p>${esc(prediction)}</p></blockquote>`:''}<div class="lesson-answers"></div><p class="lesson-takeaway">${esc(phase.takeaway??'')}</p><p class="muted lesson-note">Onderbouw je antwoord met wat je zag. Een mislukte poging kan ook iets duidelijk maken.</p></section>`;
   host.querySelector('.lesson-answers')!.append(answer('reflection',phase.reflection),answer('nextTry',phase.nextTry??'Wat wil je hierna onderzoeken?'));
   addAction('Terug naar het experiment','experiment',true);const next=tabs[tabs.findIndex(([id])=>id===tab)+1];if(next)addAction(`Volgende: ${next[1].replace(/^\d+ · /,'')}`,'before',false,next[0]);
  }else{
   host.innerHTML='<div class="lesson-experiment-tools"><button type="button" class="secondary lesson-tour-button">Rondleiding</button><p class="lesson-tour-hint" role="status">Een korte uitleg bij de knoppen. Je kunt die altijd overslaan.</p></div><div class="lesson-guidance"></div><div class="lesson-experiment-host"></div>';
   const experiment=host.querySelector<HTMLElement>('.lesson-experiment-host')!;
   if(tab==='practice'&&(!teach?.imitationSnapshot||teach.imitationIsStale)){const b=document.createElement('button');b.className='secondary';b.textContent='Ga naar voorbeelden en train je model';b.onclick=()=>void show('teach','experiment',true);host.querySelector('.lesson-guidance')!.append(b);}
   // Mount the existing simulation only on the experiment page; leaving it stops active work.
   addAction('Terug naar vooraf','before',true);addAction('Naar de terugblik','after');if(tab==='teach'){const note=document.createElement('p');note.className='lesson-note';note.textContent='Rond je opname af voordat je deze pagina verlaat. Een onafgemaakte opname wordt niet bewaard.';host.append(note);}
   try{
    let view:{dispose():void};
    if(tab==='play')view=await mountFlappyDuelView(experiment);
    else if(tab==='teach')view=await mountFlappyTeachView(experiment,{restoreState:teach,onStateChange:s=>{if(token===epoch&&!disposed)updateTeach(s);}});
    else if(tab==='practice'){
     let p:Awaited<ReturnType<typeof mountFlappyPracticeView>>;
     p=await mountFlappyPracticeView(experiment,{onReset:()=>{postRl=undefined;practice=undefined;p.setSource(teach&&!teach.imitationIsStale?teach.imitationSnapshot:undefined,true);publish();},onSnapshot:(s,progress)=>{if(token===epoch&&!disposed){if(s.stage==='post_rl')postRl=s;practice=progress;publish();}}});
     p.setSource(postRl??(teach&&!teach.imitationIsStale?teach.imitationSnapshot:undefined));if(practice)p.restoreProgress(practice);view=p;
    }else view=await mountComparisonView(experiment,{initial:teach?.initialSnapshot??createPolicySnapshot(new BernoulliPolicy(1222),{stage:'initial'}),imitation:teach&&!teach.imitationIsStale?teach.imitationSnapshot:undefined,postRl,
     demonstrationSeconds:teach?.episodes.filter(e=>e.seed<2000).reduce((n,e)=>n+e.durationSeconds,0)??0,practiceSteps:practice?.cumulativeSteps??practice?.steps,practiceElapsedMs:practice?.cumulativeElapsedMs??practice?.elapsedMs,humanRecords:human,modelRecords,
     onModelRecords:r=>{if(token===epoch&&!disposed){modelRecords=r;publish();}},onHumanRecords:r=>{if(token===epoch&&!disposed){human=r;publish();}}});
    if(disposed||token!==epoch){view.dispose();return;}active=view;
    tour=mountControlTour(experiment,flappyTourSteps(tab),()=>{
     // Pause running controls before explaining them; training resumes only by an explicit student action.
     for(const selector of ['#duel-pause','#teach-pause','#practice-pause','.flock-pause','#human-pause']){const button=experiment.querySelector<HTMLButtonElement>(selector);if(button&&!button.disabled&&button.textContent?.startsWith('Pauzeer'))button.click();}
    });
    host.querySelector<HTMLButtonElement>('.lesson-tour-button')!.onclick=()=>{const hint=host.querySelector<HTMLElement>('.lesson-tour-hint')!,cancel=experiment.querySelector<HTMLButtonElement>('#cancel-button');if(cancel&&!cancel.disabled){hint.textContent='Laat de training eerst afronden of annuleer ze. Open daarna de rondleiding.';hint.classList.add('is-notice');return;}hint.textContent='Een korte uitleg bij de knoppen. Je kunt die altijd overslaan.';hint.classList.remove('is-notice');tour?.start();};
   }catch(e){if(token===epoch&&!disposed){const p=document.createElement('p');p.setAttribute('role','alert');p.textContent=e instanceof Error?e.message:String(e);experiment.replaceChildren(p);}}
  }
  if(focus&&token===epoch&&!disposed){const heading=host.querySelector<HTMLElement>('h1,h2')??host;heading.tabIndex=-1;heading.focus({preventScroll:true});root.querySelector('.flappy-lesson')?.scrollIntoView({block:'start',behavior:'instant'});}
 }
 for(const [id,text]of tabs){const b=document.createElement('button');b.className='secondary';b.type='button';b.dataset.tab=id;b.textContent=text;b.onclick=()=>void show(id,'before',true);nav.append(b);}
 for(const [id,text]of pages){const b=document.createElement('button');b.className='secondary';b.type='button';b.dataset.page=id;b.textContent=text;b.onclick=()=>{if(currentPage!==id)void show(currentTab,id,true);};pageNav.append(b);}

 await show(tabs.some(([id])=>id===options.initialStep)?options.initialStep as ExperienceStep:'play',options.initialLesson??'before');
 return{getState,async reset(){teach=undefined;postRl=undefined;practice=undefined;human=[];modelRecords=[];notes={};imitationId='';publish();await show('play','before',true);},dispose(){disposed=true;epoch++;tour?.dispose();active?.dispose();menu.dispose();root.replaceChildren();}};
}
