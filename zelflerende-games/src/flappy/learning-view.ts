import { confirmRemoval } from '../ui/confirm-removal.ts';
import { renderLessonActions } from '../ui/lesson-actions.ts';
import { mountNavigationDrawer } from '../ui/navigation-drawer.ts';
import { mountFlappyDuelView } from './duel-view.ts';
import { mountFlappyTeachView,type TeachState } from './teach-view.ts';
import { mountFlappyPracticeView } from './practice-view.ts';
import { mountComparisonView } from '../evaluation/comparison-view.ts';
import type { PolicySnapshot } from '../learning/policy-snapshot.ts';
import type { PracticeProgress } from '../learning/practice-job.ts';
import { stableIdentity,type EvaluationRecord } from '../evaluation/records.ts';
import { BernoulliPolicy } from '../learning/policy.ts';
import { createPolicySnapshot } from '../learning/policy-snapshot.ts';
import { renderLessonPrompt } from '../ui/disclosure.ts';
import intro from '../content/flappy-intro.nl.json';

export interface FlappyLearningState {readonly teach?:TeachState;readonly postRl?:PolicySnapshot;readonly practice?:PracticeProgress;readonly human:readonly EvaluationRecord[];readonly records?:readonly EvaluationRecord[];}
export async function mountFlappyLearningView(root:HTMLElement,options:{state?:FlappyLearningState;initialStep?:string;onStepChange?:(step:string)=>void;onChange?:(state:FlappyLearningState)=>void}={}) {
  root.innerHTML='<div class="learning-shell"><div class="exercise-menu"><nav aria-label="Flappy leerroute"></nav></div><section id="lesson-prompt" class="card"></section><div class="lesson-guidance"></div><div id="learning-content"></div><nav class="lesson-actions" aria-label="Volgende oefening"></nav><details class="context-help"><summary>Flappy-experiment wissen</summary><p>Verwijder alle Flappy-voorbeelden, modellen en metingen uit dit experiment. Je raceauto-experiment blijft bewaard.</p><button id="clear-flappy-session" class="secondary">Wis dit Flappy-experiment</button></details></div>';
  const nav=root.querySelector('nav')!,content=root.querySelector<HTMLElement>('#learning-content')!,prompt=root.querySelector<HTMLElement>('#lesson-prompt')!;
  const style=document.createElement('style');style.textContent='.learning-shell{max-width:1200px;margin:auto;padding:0}.learning-shell nav{position:relative}.learning-shell nav button[aria-current="step"]{background:var(--brand-purple-dark);color:white}.learning-shell #lesson-prompt{margin-bottom:8px}.learning-shell #lesson-prompt p{margin:6px 0}.learning-shell #learning-content>div{max-width:1120px;margin:auto}';root.prepend(style);
  const menu=mountNavigationDrawer(root.querySelector<HTMLElement>('.exercise-menu')!,{label:'Open oefeningen',kind:'exercise'});
  const tabs=[['play','1 · Speel'],['teach','2 · Geef voorbeelden'],['practice','3 · Oefen zelfstandig'],['compare','4 · Vergelijk']] as const;
  type Tab=typeof tabs[number][0];
  let active:{dispose():void}|undefined,epoch=0,disposed=false;let confirmation:(()=>void)|undefined;
  let teach=options.state?.teach,postRl=options.state?.postRl,practice=options.state?.practice;
  let human:readonly EvaluationRecord[]=options.state?.human??[];let imitationId=teach?.imitationSnapshot&&!teach.imitationIsStale?stableIdentity(teach.imitationSnapshot.parameters):'';
  let modelRecords=options.state?.records??[];
  const getState=():FlappyLearningState=>({teach,postRl,practice,human,records:modelRecords});
  const publish=()=>options.onChange?.(getState());
  const updateTeach=(value:TeachState)=>{
    const id=value.imitationSnapshot&&!value.imitationIsStale?stableIdentity(value.imitationSnapshot.parameters):'';
    if(id!==imitationId){postRl=undefined;practice=undefined;imitationId=id;}
    teach=value;publish();
  };
  async function show(tab:Tab){
    const token=++epoch;active?.dispose();active=undefined;const host=document.createElement('div');content.replaceChildren(host);
    for(const b of nav.querySelectorAll('button'))if(b.dataset.tab===tab)b.setAttribute('aria-current','step');else b.removeAttribute('aria-current');
    options.onStepChange?.(tab);
    renderLessonActions(root.querySelector<HTMLElement>('.lesson-actions')!,tabs,tab,id=>void show(id as Tab));
    const guidance=root.querySelector<HTMLElement>('.lesson-guidance')!;guidance.replaceChildren();
    if(tab==='practice'&&(!teach?.imitationSnapshot||teach.imitationIsStale)){const b=document.createElement('button');b.className='secondary';b.textContent='Ga naar voorbeelden en train je model';b.onclick=()=>void show('teach');guidance.append(b);}
    menu.setCurrent(tabs.find(([id])=>id===tab)![1]);
    const phase=intro.phases.find(p=>p.id===tab)!;
    renderLessonPrompt(prompt,phase);
    try{
      let view:{dispose():void};
      if(tab==='play')view=await mountFlappyDuelView(host);
      else if(tab==='teach')view=await mountFlappyTeachView(host,{restoreState:teach,onStateChange:s=>{if(token===epoch&&!disposed)updateTeach(s);}});
      else if(tab==='practice'){
        let p:Awaited<ReturnType<typeof mountFlappyPracticeView>>;
        p=await mountFlappyPracticeView(host,{onReset:()=>{postRl=undefined;practice=undefined;p.setSource(teach&&!teach.imitationIsStale?teach.imitationSnapshot:undefined,true);publish();},onSnapshot:(s,progress)=>{if(token===epoch&&!disposed){if(s.stage==='post_rl')postRl=s;practice=progress;publish();}}});
        p.setSource(postRl??(teach&&!teach.imitationIsStale?teach.imitationSnapshot:undefined));if(practice)p.restoreProgress(practice);view=p;
      }else{
        view=await mountComparisonView(host,{initial:teach?.initialSnapshot??createPolicySnapshot(new BernoulliPolicy(1222),{stage:'initial'}),
          imitation:teach&&!teach.imitationIsStale?teach.imitationSnapshot:undefined,postRl,
          demonstrationSeconds:teach?.episodes.filter(e=>e.seed<2000).reduce((n,e)=>n+e.durationSeconds,0)??0,
          practiceSteps:practice?.cumulativeSteps??practice?.steps,practiceElapsedMs:practice?.cumulativeElapsedMs??practice?.elapsedMs,humanRecords:human,modelRecords,
          onModelRecords:r=>{if(token===epoch&&!disposed){modelRecords=r;publish();}},
          onHumanRecords:r=>{if(token===epoch&&!disposed){human=r;publish();}}});
      }
      if(disposed||token!==epoch)view.dispose();else active=view;
    }catch(e){if(token===epoch&&!disposed){const p=document.createElement('p');p.setAttribute('role','alert');p.textContent=e instanceof Error?e.message:String(e);host.replaceChildren(p);}}
  }
  for(const [id,text]of tabs){const b=document.createElement('button');b.className='secondary';b.type='button';b.dataset.tab=id;b.textContent=text;b.onclick=()=>{void show(id);};nav.append(b);}
  root.querySelector<HTMLButtonElement>('#clear-flappy-session')!.onclick=()=>{const trigger=root.querySelector<HTMLButtonElement>('#clear-flappy-session')!;confirmation?.();confirmation=confirmRemoval(trigger,'Hiermee wis je alle Flappy-voorbeelden, modellen en metingen. Je raceauto-experiment blijft bewaard. Dit kan niet ongedaan worden gemaakt.',()=>{teach=undefined;postRl=undefined;practice=undefined;human=[];modelRecords=[];imitationId='';publish();void show('teach');});};
  await show(tabs.some(([id])=>id===options.initialStep)?options.initialStep as Tab:'play');
  return{getState,dispose(){disposed=true;epoch++;confirmation?.();active?.dispose();menu.dispose();root.replaceChildren();}};
}
