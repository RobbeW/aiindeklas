import { mountFlappyFlockView } from './flock-view.ts';
import { WORKLOADS,optionMarkup } from '../config/workload-presets.ts';
import { PracticeSession } from '../learning/practice-session.ts';
import type { PolicySnapshot } from '../learning/policy-snapshot.ts';
import type { PracticeProgress,PracticeResult } from '../learning/practice-job.ts';
import { FlappyEnvironment } from './environment.ts';
import { createFlappyRenderer } from './renderer.ts';
import { advanceFlappyFrame } from './play-view.ts';
import { disclose } from '../ui/disclosure.ts';

export interface PracticeViewOptions {readonly onReset?:()=>void;readonly onSnapshot?:(snapshot:PolicySnapshot,progress:PracticeProgress)=>void;}
export async function mountFlappyPracticeView(root:HTMLElement,options:PracticeViewOptions={}) {
  root.innerHTML=`<section class="card practice-workspace"><p class="mode-badge learning-mode">Leren · gewichten veranderen</p><h2>Laat het model oefenen</h2>
    <p>Het model probeert zelf acties. Beloningen sturen het leren.</p>
    <div class="practice-layout"><div class="practice-training"><p id="practice-origin">Nog geen imitatiemodel. Verzamel voorbeelden en train eerst.</p>
    <div class="toolbar"><label>Pogingen <select id="practice-budget">${optionMarkup(WORKLOADS.practiceEpisodes,WORKLOADS.defaultPracticeEpisodes)}</select></label>
    <button id="practice-reset-baseline" class="secondary" disabled>Herstel imitatie als startpunt</button><button id="practice-start" disabled>Start zelfstandig oefenen</button><button id="practice-pause" class="secondary" disabled>Pauzeer oefenen</button><button id="practice-cancel" class="secondary" disabled>Stop oefenen</button></div>
    <p id="practice-status" role="status" aria-live="polite">Nog niet gestart.</p><p id="practice-counts"></p><p id="practice-scores"></p>
    <label id="practice-replay-label">Bekijk een eerdere poging <select id="practice-replay" disabled><option>Geen pogingen</option></select></label>
    <div class="toolbar"><button id="practice-watch" class="secondary" disabled>Bekijk poging</button><button id="replay-stop" class="secondary">Stop terugkijken</button></div>
    <canvas id="practice-canvas" aria-label="Terugkijken van een voltooide oefenpoging"></canvas>
    </div><div class="flock-host"></div></div></section>`;
  const q=<T extends Element>(s:string)=>root.querySelector<T>(s)!;
  const trainingRoot=root.querySelector<HTMLElement>('.practice-training')!;
  const replayDetails=disclose(trainingRoot,'Bekijk een eerdere poging',['#practice-replay-label','#practice-watch','#replay-stop','#practice-canvas']);
  disclose(trainingRoot,'Meetgegevens',['#practice-counts','#practice-scores']);
  const start=q<HTMLButtonElement>('#practice-start'),pause=q<HTMLButtonElement>('#practice-pause'),cancel=q<HTMLButtonElement>('#practice-cancel');
  const budget=q<HTMLSelectElement>('#practice-budget'),replay=q<HTMLSelectElement>('#practice-replay'),watch=q<HTMLButtonElement>('#practice-watch');
  const status=q<HTMLElement>('#practice-status'),canvas=q<HTMLCanvasElement>('#practice-canvas');
  const renderer=await createFlappyRenderer(canvas);canvas.style.width='min(100%,265px)';canvas.hidden=true;
  const session=new PracticeSession(()=>new Worker(new URL('../workers/practice.worker.ts',import.meta.url),{type:'module'}));
  let source:PolicySnapshot|undefined,latest:PracticeProgress|undefined,result:PracticeResult|undefined;
  let active=false,paused=false,disposed=false,epoch=0,raf:number|undefined;
  let baseSteps=0,baseElapsedMs=0;
  const stopReplay=()=>{if(raf!==undefined)cancelAnimationFrame(raf);raf=undefined;};
  q<HTMLButtonElement>('#practice-reset-baseline').onclick=()=>options.onReset?.();
  let flockView:Awaited<ReturnType<typeof mountFlappyFlockView>>|undefined;
  const buttons=()=>{flockView?.refresh();q<HTMLButtonElement>('#practice-reset-baseline').disabled=active||!options.onReset;start.disabled=active||!source;pause.disabled=!active;cancel.disabled=!active;budget.disabled=active;watch.disabled=!latest?.history.length;replay.disabled=!latest?.history.length;};
  const update=(p:PracticeProgress)=>{
    latest=Object.freeze({...p,cumulativeSteps:baseSteps+p.steps,cumulativeElapsedMs:baseElapsedMs+p.elapsedMs});options.onSnapshot?.(p.snapshot,latest);
    q('#practice-counts').textContent=`${p.episodes} voltooide pogingen · ${p.steps} stappen · ${p.simulatedSeconds.toFixed(1)} s simulatietijd · ${(p.elapsedMs/1000).toFixed(2)} s actieve rekentijd · ${Math.round(p.stepsPerSecond)} stappen/s · ${p.trainedEpisodes} pogingen gebruikt voor updates`;
    q('#practice-scores').textContent=`Pijpen per poging: ${p.scoreHistory.map(s=>s.pipesPassed).join(', ')||'nog geen'}. Dit zijn trainingsresultaten, geen onafhankelijke test.`;
    const selected=replay.value;
    replay.replaceChildren(...p.history.map((h,i)=>{const o=document.createElement('option');o.value=String(i);o.textContent=`Poging ${p.episodes-p.history.length+i+1}: ${h.result.pipesPassed} pijpen, ${h.result.survivalSteps} stappen`;return o;}));
    if([...replay.options].some(o=>o.value===selected))replay.value=selected;
    buttons();
  };
  start.onclick=()=>{
    if(!source||active)return;baseSteps=latest?.cumulativeSteps??latest?.steps??0;baseElapsedMs=latest?.cumulativeElapsedMs??latest?.elapsedMs??0;stopReplay();const token=++epoch;active=true;paused=false;result=undefined;buttons();
    status.textContent='Het model oefent. Je kunt pauzeren of stoppen.';
    const job=session.start({snapshot:source,episodeBudget:Number(budget.value),stepBudget:115200,environmentSeed:1100,actionSeed:17000},p=>{if(token===epoch&&!disposed)update(p);});
    void job.promise.then(r=>{if(token===epoch&&!disposed){source=r.snapshot;result=r;update(r);status.textContent=`${r.episodes} pogingen klaar. Het model is bewaard; vergelijk nu het resultaat.`;}})
      .catch(e=>{if(token===epoch&&!disposed){source=session.completedSnapshot??source;status.textContent=`Oefenen gestopt: ${e.message}. Het laatste volledig bijgewerkte model blijft bewaard.`;}})
      .finally(()=>{if(token===epoch&&!disposed){active=false;paused=false;pause.textContent='Pauzeer oefenen';buttons();}});
  };
  pause.onclick=()=>{if(!active)return;paused=!paused;if(paused)session.pause();else session.resume();pause.textContent=paused?'Hervat oefenen':'Pauzeer oefenen';status.textContent=paused?'Oefenen gepauzeerd.':'Oefenen hervat.';};
  cancel.onclick=()=>session.cancel();
  watch.onclick=()=>{
    const selected=latest?.history[Number(replay.value)];if(!selected)return;
    if(replayDetails){replayDetails.open=true;replayDetails.scrollIntoView({block:'nearest',behavior:'smooth'});}
    stopReplay();canvas.hidden=false;const env=new FlappyEnvironment();env.reset({seed:selected.seed});renderer.render(env.world);
    let index=0,previous:number|undefined,accumulator=0;
    const frame=(time:number)=>{const delta=previous===undefined?0:time-previous;previous=time;
      const next=advanceFlappyFrame(delta,accumulator,()=>selected.actions[index]??0,()=>{if(index<selected.actions.length){env.step(selected.actions[index++]!);renderer.render(env.world);}});accumulator=next.accumulatorMs;
      if(index<selected.actions.length&&!disposed)raf=requestAnimationFrame(frame);else{raf=undefined;status.textContent=`Terugkijken klaar: ${selected.result.pipesPassed} pijpen. Er is niet getraind.`;}};
    status.textContent='Terugkijken op speelsnelheid; gewichten blijven gelijk.';raf=requestAnimationFrame(frame);
  };
  q<HTMLButtonElement>('#replay-stop').onclick=()=>stopReplay();
  const blur=()=>{stopReplay();if(active&&!paused){session.pause();paused=true;pause.textContent='Hervat oefenen';status.textContent='Gepauzeerd bij verlaten van het venster.';}};
  window.addEventListener('blur',blur);
  flockView=await mountFlappyFlockView(root.querySelector<HTMLElement>('.flock-host')!,{getSnapshot:()=>latest?.snapshot??source});
  const env=new FlappyEnvironment();env.reset({seed:2000});renderer.render(env.world);buttons();
  return {
    setSource(snapshot:PolicySnapshot|undefined,force=false){if(force||source!==snapshot){epoch++;session.cancel();active=false;paused=false;source=snapshot;latest=undefined;result=undefined;stopReplay();canvas.hidden=true;replay.replaceChildren();baseSteps=0;baseElapsedMs=0;pause.textContent='Pauzeer oefenen';status.textContent=snapshot?'Klaar om te oefenen.':'Verzamel voorbeelden en train eerst een imitatie.';renderer.render(env.world);q('#practice-counts').textContent='';q('#practice-scores').textContent='';
    q('#practice-origin').textContent=snapshot?`Startmodel: ${snapshot.stage==='imitation'?'jouw imitatie':'model na zelfstandig oefenen'}.`:'Nog geen imitatiemodel. Verzamel voorbeelden en train eerst.';buttons();}},
    getResult:()=>result,getProgress:()=>latest,restoreProgress:(p:PracticeProgress)=>{if(!active){baseSteps=(p.cumulativeSteps??p.steps)-p.steps;baseElapsedMs=(p.cumulativeElapsedMs??p.elapsedMs)-p.elapsedMs;update(p);}},
    dispose(){if(disposed)return;disposed=true;epoch++;stopReplay();flockView?.dispose();session.dispose();renderer.dispose();window.removeEventListener('blur',blur);root.replaceChildren();}
  };
}
