import { mountGameFullscreen } from '../ui/game-fullscreen.ts';
import {WorkerJobClient,WorkerJobCancelledError} from '../core/worker-client.ts';
import {type ParallelPracticeInput,type ParallelPracticeProgress,type ParallelPracticeResult,PARALLEL_ROUND_OPTIONS,parallelPracticeMode} from '../learning/parallel-practice.ts';
import type {PolicySnapshot} from '../learning/policy-snapshot.ts';
import type {PracticeProgress} from '../learning/practice-job.ts';
import {mountPracticeGym} from '../ui/practice-gym.ts';
import {practiceCheckText} from '../ui/practice-check-text.ts';
import {FlappyEnvironment} from './environment.ts';
import {createFlappyFlockRenderer} from './renderer.ts';
import {chipIcon} from './schematic-elements.ts';
import '../styles/parallel-practice.css';

export interface PracticeViewOptions {
 readonly onReset?:()=>void;
 readonly onSnapshot?:(snapshot:PolicySnapshot,progress:PracticeProgress)=>void;
 readonly onTest?:()=>void;
}
export async function mountFlappyPracticeView(root:HTMLElement,options:PracticeViewOptions={}) {
 root.innerHTML=`<section class="card parallel-practice"><h1>Laat het model oefenen</h1><p>Nu gaan we het AI-model zelf laten oefenen en trainen.</p>
 <div class="parallel-controls"><label for="practice-agents">Vogels tegelijk<select id="practice-agents"><option>6</option><option selected>12</option><option>18</option><option>24</option></select></label>
 <label for="practice-budget">Trainingsrondes (epochs)<select id="practice-budget">${PARALLEL_ROUND_OPTIONS.map(n=>`<option value="${n}" ${n===32?'selected':''}>${n}</option>`).join('')}</select></label>
 <label for="practice-speed">Snelheid<select id="practice-speed"><option value="1">1×</option><option value="4">4×</option><option value="16" selected>16×</option><option value="64">64×</option></select></label></div>
 <p class="parallel-epoch">Eén trainingsronde: iedere vogel speelt één poging. Daarna leert hetzelfde AI-model van hun beloningen en straffen.</p>
 <p class="parallel-fast-note" hidden><strong>Snelle training · spelbeeld uit</strong>De vogels blijven oefenen. We tekenen hun spel niet, zodat de computer sneller kan rekenen. Een training duurt maximaal twee minuten. Je voortgang blijft bewaard; je kunt daarna verder oefenen.</p>
 <div class="toolbar"><button id="practice-start" disabled>Start zelfstandig oefenen</button><button id="practice-pause" class="secondary" disabled>Pauzeer oefenen</button><button id="practice-cancel" class="secondary" disabled>Stop oefenen</button><button id="practice-reset-baseline" class="secondary">Begin met jouw imitatie</button></div><p id="practice-origin" role="status"></p>
 <p class="parallel-model-check" hidden></p><section class="parallel-fast-result" hidden><p class="parallel-fast-summary"></p><button class="practice-test-model">Test jouw AI-model</button></section>
 <div class="parallel-layout"><section class="parallel-game"><h2 class="parallel-flock-title">Twaalf vogels leren samen</h2><canvas class="parallel-canvas" role="img" aria-label="Vogels die echte trainingspogingen uitvoeren"></canvas><div class="parallel-agents" aria-label="Trainende vogels"></div></section>
 <section class="parallel-feedback" aria-label="Van spelen naar leren"><div class="parallel-model">${chipIcon}<strong>Gedeeld AI-model</strong><p class="parallel-model-state">Jouw imitatie is het startpunt</p></div><p class="parallel-rewards">Beloning en straf uit de lopende ronde</p><span class="parallel-flow-arrow" aria-hidden="true">↓</span><p class="parallel-loop-state">Vogels spelen → beloning en straf → AI-model leert</p><div class="parallel-numbers"><p><strong class="parallel-rounds">0</strong> trainingsrondes</p><p><strong class="parallel-attempts">0</strong> voltooide pogingen</p><p><strong class="parallel-time">0,0 s</strong> trainingstijd</p></div><progress id="practice-progress" max="32" value="0" aria-label="Voltooide trainingsrondes"></progress><p id="practice-status" role="status" aria-live="polite">Kies het aantal vogels en trainingsrondes.</p></section></div></section>`;
 const q=<T extends HTMLElement=HTMLElement>(s:string)=>root.querySelector<T>(s)!;
 const start=q<HTMLButtonElement>('#practice-start'),pause=q<HTMLButtonElement>('#practice-pause'),stop=q<HTMLButtonElement>('#practice-cancel'),reset=q<HTMLButtonElement>('#practice-reset-baseline');
 const agents=q<HTMLSelectElement>('#practice-agents'),rounds=q<HTMLSelectElement>('#practice-budget'),speed=q<HTMLSelectElement>('#practice-speed'),status=q('#practice-status'),bar=q<HTMLProgressElement>('#practice-progress');
 const test=q<HTMLButtonElement>('.practice-test-model');
 const renderer=await createFlappyFlockRenderer(q<HTMLCanvasElement>('.parallel-canvas'));
 const game=document.createElement('div');game.className='game-fullscreen';q('.parallel-practice').append(game);const fullscreen=document.createElement('button');fullscreen.type='button';fullscreen.className='secondary game-fullscreen-button';game.append(fullscreen,q('.parallel-practice > .toolbar'),q('#practice-origin'),q('.parallel-model-check'),q('.parallel-fast-note'),q('.parallel-fast-result'),q('.parallel-layout'));const fullscreenControl=mountGameFullscreen(game,fullscreen,message=>{status.textContent=message;});
 const client=new WorkerJobClient<ParallelPracticeInput,ParallelPracticeProgress,ParallelPracticeResult>(()=>new Worker(new URL('../workers/parallel-practice.worker.ts',import.meta.url),{type:'module'}));
 let source:PolicySnapshot|undefined,latest:PracticeProgress|undefined,result:ParallelPracticeResult|undefined,current:ParallelPracticeProgress|undefined;
 let active=false,paused=false,disposed=false,epoch=0,baseSteps=0,baseElapsed=0;
 let runs:NonNullable<PracticeProgress['trainingRuns']>=[];
 const fast=()=>parallelPracticeMode(Number(rounds.value))==='fast';
 const seconds=(n:number)=>(n/1000).toFixed(1).replace('.',',');
 const canTest=()=>source?.stage==='post_rl'&&!!options.onTest;
 const controls=()=>{
  start.disabled=active||!source;pause.disabled=stop.disabled=!active;agents.disabled=rounds.disabled=active;speed.disabled=active||fast();reset.disabled=active||!options.onReset;
  test.disabled=active||!canTest();start.textContent=fast()?'Start snelle training':'Start zelfstandig oefenen';
  q('.parallel-fast-result').hidden=!fast()||active||!runs.some(r=>r.mode==='fast');
  const check=latest?.modelCheck;q('.parallel-model-check').hidden=active||!check;q('.parallel-model-check').textContent=check?practiceCheckText(check):'';
 };
 const syncMode=()=>{q('.parallel-layout').hidden=fast();q('.parallel-fast-note').hidden=!fast();controls();};
 const idle=()=>{
  syncMode();if(fast())return;
  const env=new FlappyEnvironment();env.reset({seed:1100});renderer.render(Array.from({length:Number(agents.value)},(_,id)=>({id,world:env.world,done:false,pipesPassed:0})));
  q('.parallel-flock-title').textContent=`${agents.value} vogels leren samen`;
  q('.parallel-agents').replaceChildren(...Array.from({length:Number(agents.value)},(_,i)=>{const e=document.createElement('span');e.textContent=String(i+1);return e;}));
 };
 const goTest=()=>{if(!active&&canTest())options.onTest?.();};
 const setPause=()=>{if(!active)return;paused=!paused;if(paused)client.pause();else client.resume();pause.textContent=paused?'Hervat oefenen':'Pauzeer oefenen';status.textContent=paused?'De vogels en het leren staan op pauze.':'De vogels oefenen verder.';q('.parallel-model').classList.toggle('is-updating',!paused&&current?.phase==='updating');updateGym();};
 const gym=mountPracticeGym(start,{onPause:setPause,onStop:()=>client.cancel(),onTest:goTest});
 const updateGym=(terminal?:'complete'|'stopped'|'error',message?:string)=>{
  if(current?.mode!=='fast'&&!fast())return;
  gym.update({status:terminal??(paused?'paused':'running'),completed:current?.completedRounds??0,budget:current?.roundBudget??Number(rounds.value),attempts:current?.episodes??0,elapsedMs:current?.elapsedMs??0,message:message??(paused?'De training staat op pauze.':'De vogels oefenen; beloning en straf sturen het AI-model.'),canTest:canTest(),modelCheck:current?.modelCheck});
 };
 const summary=(p:ParallelPracticeProgress,reason?:NonNullable<PracticeProgress['trainingRuns']>[number]['reason'])=>({rounds:p.completedRounds,requestedRounds:p.roundBudget,mode:p.mode,agents:p.agentCount,speed:Number(speed.value),elapsedMs:p.elapsedMs,attempts:p.trainedEpisodes,meanScore:p.meanScore,...(reason?{reason}:{}),...(p.modelCheck?{modelCheck:p.modelCheck}:{})});
 const update=(p:ParallelPracticeProgress)=>{
  if(disposed)return;current=p;source=p.snapshot;
  latest={...p,cumulativeSteps:baseSteps+p.steps,cumulativeElapsedMs:baseElapsed+p.elapsedMs,trainingRuns:p.trainedEpisodes?[...runs,summary(p)].slice(-12):runs};
  if(p.mode==='live'){
   if(p.birds.length){renderer.render(p.birds.map(b=>({...b,pipesPassed:b.score})));const markers=[...q('.parallel-agents').children];p.birds.forEach((b,i)=>{markers[i]?.classList.toggle('is-finished',b.done);markers[i]?.setAttribute('title',`Vogel ${i+1}: ${b.score} punten`);});}
   q('.parallel-rewards').textContent=`Opgetelde beloning deze ronde: ${p.birds.reduce((sum,b)=>sum+b.totalReward,0).toFixed(2).replace('.',',')} · ${p.birds.filter(b=>b.done).length} vogels klaar`;
   q('.parallel-model').classList.toggle('is-updating',p.phase==='updating'&&!paused);q('.parallel-model-state').textContent=p.phase==='updating'?'Beloningen en straffen veranderen het AI-model':`${p.updates} keer bijgewerkt`;
   q('.parallel-loop-state').textContent=p.phase==='complete'?'Training afgerond':p.phase==='updating'?'Resultaten verzamelen → AI-model bijwerken':`Ronde ${p.round}: ${p.birds.filter(b=>!b.done).length} vogels spelen`;
   q('.parallel-rounds').textContent=String(p.completedRounds);q('.parallel-attempts').textContent=String(p.episodes);q('.parallel-time').textContent=`${seconds(p.elapsedMs)} s`;bar.max=p.roundBudget;bar.value=p.completedRounds;
   if(active&&!paused)status.textContent=p.phase==='updating'?'Het gedeelde AI-model leert van de afgelopen pogingen.':`${p.completedRounds} van ${p.roundBudget} trainingsrondes klaar.`;
  }
  updateGym();options.onSnapshot?.(p.snapshot,latest);
 };
 const saveRun=(reason:NonNullable<PracticeProgress['trainingRuns']>[number]['reason'])=>{
  if(!latest||!current)return;
  if(current.trainedEpisodes)runs=[...runs,summary(current,reason)].slice(-12);
  latest={...latest,trainingRuns:runs};options.onSnapshot?.(latest.snapshot,latest);
  q('.parallel-fast-summary').textContent=`${current.completedRounds} van ${current.roundBudget} rondes · ${current.episodes.toLocaleString('nl-BE')} voltooide pogingen · ${seconds(current.elapsedMs)} s trainingstijd.`;
 };
 start.onclick=()=>{
  if(!source||active)return;const token=++epoch;active=true;paused=false;current=undefined;result=undefined;
  baseSteps=latest?.cumulativeSteps??latest?.steps??0;baseElapsed=latest?.cumulativeElapsedMs??latest?.elapsedMs??0;idle();controls();
  if(fast())gym.start(Number(rounds.value));
  status.textContent='De vogels beginnen. Hun resultaten trainen hetzelfde AI-model.';
  try {
   const job=client.start({snapshot:source,roundBudget:Number(rounds.value),agentCount:Number(agents.value),speed:Number(speed.value),environmentSeed:1100+(source.trainingCounts.reinforcementEpisodes%700),actionSeed:17000+source.trainingCounts.reinforcementEpisodes},p=>{if(token===epoch&&!disposed)update(p);});
   void job.promise.then(p=>{
    if(token!==epoch||disposed)return;result=p;update(p);saveRun(p.reason);
    const message=p.reason==='round_budget'?`${p.completedRounds} trainingsrondes klaar. Test jouw AI-model.`:p.reason==='time_budget'?`Na twee minuten gestopt: ${p.completedRounds} van ${p.roundBudget} rondes klaar. Je AI-model is bewaard; je kunt verder oefenen.`:`Gestopt bij de rekenlimiet: ${p.completedRounds} van ${p.roundBudget} rondes klaar. Je AI-model is bewaard.`;
    active=false;status.textContent=message;q('.parallel-fast-summary').textContent=message;controls();updateGym(p.reason==='round_budget'?'complete':'stopped',message);
   }).catch(error=>{
    if(token!==epoch||disposed)return;saveRun('cancelled');active=false;q('.parallel-model').classList.remove('is-updating');q('.parallel-loop-state').textContent='Training gestopt';
    const message=error instanceof WorkerJobCancelledError?'Gestopt. Het laatst bijgewerkte AI-model blijft bewaard.':'Het oefenen is onderbroken. Probeer opnieuw; het laatst bijgewerkte AI-model blijft bewaard.';
    status.textContent=message;q('.parallel-fast-summary').textContent=message;controls();updateGym(error instanceof WorkerJobCancelledError?'stopped':'error',message);
   }).finally(()=>{if(token===epoch&&!disposed){active=false;paused=false;pause.textContent='Pauzeer oefenen';controls();}});
  } catch {active=false;controls();if(fast()){gym.update({status:'error',completed:0,budget:Number(rounds.value),attempts:0,elapsedMs:0,message:'De training kon niet starten. Probeer opnieuw.',canTest:canTest()});}}
 };
 pause.onclick=setPause;stop.onclick=()=>client.cancel();reset.onclick=()=>options.onReset?.();test.onclick=goTest;agents.onchange=idle;rounds.onchange=idle;
 const blur=()=>{if(active&&!paused)setPause();};const visibility=()=>{if(document.hidden)blur();};window.addEventListener('blur',blur);document.addEventListener('visibilitychange',visibility);idle();
 return {
  setSource(snapshot:PolicySnapshot|undefined,force=false){
   if(!force&&source===snapshot)return;epoch++;client.cancel();source=snapshot;active=false;paused=false;latest=undefined;current=undefined;result=undefined;runs=[];baseSteps=baseElapsed=0;
   bar.value=0;bar.max=Number(rounds.value);q('.parallel-rounds').textContent='0';q('.parallel-attempts').textContent='0';q('.parallel-time').textContent='0,0 s';q('.parallel-model').classList.remove('is-updating');
   q('.parallel-model-state').textContent=snapshot?.stage==='post_rl'?'Je getrainde AI-model oefent verder':'Jouw imitatie is het startpunt';q('.parallel-rewards').textContent='Beloning en straf uit de lopende ronde';q('.parallel-loop-state').textContent='Vogels spelen → beloning en straf → AI-model leert';
   q('#practice-origin').textContent=snapshot?'We beginnen met jouw bewaarde AI-model.':'Train eerst je AI-model bij Doe het voor.';status.textContent='Kies het aantal vogels en trainingsrondes.';idle();
  },
  restoreProgress(p:PracticeProgress){
   if(active)return;latest=p;source=p.snapshot;runs=p.trainingRuns??[];const last=runs.at(-1);
   if(last){const requested=last.requestedRounds??last.rounds;if((PARALLEL_ROUND_OPTIONS as readonly number[]).includes(requested))rounds.value=String(requested);agents.value=String(last.agents);speed.value=String(last.speed);q('.parallel-rounds').textContent=String(last.rounds);q('.parallel-model-state').textContent=`Bewaard na ${last.rounds} trainingsrondes`;bar.max=requested;bar.value=last.rounds;q('.parallel-fast-summary').textContent=`Bewaard: ${last.rounds} van ${requested} rondes · ${last.attempts.toLocaleString('nl-BE')} pogingen · ${seconds(last.elapsedMs)} s trainingstijd.`;}
   q('.parallel-attempts').textContent=String(p.episodes);q('.parallel-time').textContent=`${seconds(p.elapsedMs)} s`;status.textContent='De vorige training is bewaard. Je kunt verder oefenen.';idle();
  },
  getProgress:()=>latest,getResult:()=>result,
  dispose(){fullscreenControl.dispose();disposed=true;epoch++;client.dispose();gym.dispose();renderer.dispose();window.removeEventListener('blur',blur);document.removeEventListener('visibilitychange',visibility);root.replaceChildren();}
 };
}
