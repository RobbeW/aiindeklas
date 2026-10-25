import { evaluateFlappy } from './runner.ts';
import { summarizeEvaluations,validateEvaluationRecord,type EvaluationRecord,type EvaluationBudget } from './records.ts';
import type { PolicySnapshot } from '../learning/policy-snapshot.ts';
import { FlappyEnvironment,FLAPPY_WORLD_CONFIG_VERSION,FLAPPY_OBSERVATION_VERSION,FLAPPY_SEQUENCE_VERSION } from '../flappy/environment.ts';
import { createFlappyRenderer } from '../flappy/renderer.ts';
import { createFlappyInput } from '../input/flappy-input.ts';
import { advanceFlappyFrame } from '../flappy/play-view.ts';
import { renderBarChart } from '../ui/result-chart.ts';
export const COMPARISON_SEEDS=Object.freeze([2030,2031,2032]);
export interface ComparisonInput {
  readonly initial:PolicySnapshot;readonly imitation?:PolicySnapshot;readonly postRl?:PolicySnapshot;
  readonly demonstrationSeconds:number;readonly practiceSteps?:number;readonly practiceElapsedMs?:number;
  readonly modelRecords?:readonly EvaluationRecord[];
  readonly onModelRecords?:(records:readonly EvaluationRecord[])=>void;
  readonly humanRecords?:readonly EvaluationRecord[];
  readonly onHumanRecords?:(records:readonly EvaluationRecord[])=>void;
}
const label={human:'Mens',initial:'Beginmodel',imitation:'Imitatie',post_rl:'Na zelfstandig oefenen',evolution:'Evolutie'};
export async function mountComparisonView(root:HTMLElement,input:ComparisonInput) {
  root.innerHTML=`<section class="card"><p class="eyebrow">Eerlijke vergelijking</p><h1>Wat veranderde er echt?</h1>
    <p>Mens en bewaarde modellen krijgen dezelfde drie reeksen openingen. Hier wordt niet getraind. De mens ziet het hele veld; het model krijgt vijf getallen.</p>
    <button id="compare-run">Test de bewaarde modellen</button><p id="compare-status" role="status" aria-live="polite">Nog geen nieuwe meting.</p>
    <div id="compare-chart"></div><details><summary>Resultaten per poging</summary><div id="compare-table" tabindex="0" aria-label="Vergelijking" style="overflow-x:auto"></div><div id="compare-details"></div></details>
    <h2>Jouw drie testpogingen</h2><p>Je acties worden niet opgeslagen als trainingsvoorbeelden. Elk model krijgt één poging per reeks.</p>
    <div class="toolbar"><button id="human-start">Speel testpoging</button><button id="human-pause" class="secondary" disabled>Pauzeer testpoging</button><button id="human-flap" class="secondary" disabled>Flap</button></div>
    <p id="human-status" role="status" aria-live="polite"></p><canvas id="human-canvas" tabindex="0" aria-label="Menselijke testpoging; Spatie of pijltje omhoog om te flappen"></canvas>
    <p class="muted">Vergelijk alle drie de testpogingen.</p></section>`;
  const q=<T extends HTMLElement>(s:string)=>root.querySelector<T>(s)!;
  const canvas=q<HTMLCanvasElement>('#human-canvas'),start=q<HTMLButtonElement>('#human-start'),pause=q<HTMLButtonElement>('#human-pause'),flap=q<HTMLButtonElement>('#human-flap');
  const status=q<HTMLElement>('#human-status');const renderer=await createFlappyRenderer(canvas);canvas.style.width='min(100%,265px)';
  const control=createFlappyInput({canvas,button:flap});
  let human=[...(input.humanRecords??[])],modelRecords:EvaluationRecord[]=[...(input.modelRecords??[])];
  let env:FlappyEnvironment|undefined,active=false,disposed=false,raf:number|undefined,last:number|undefined,accumulator=0;
  const stop=()=>{active=false;if(raf!==undefined)cancelAnimationFrame(raf);raf=undefined;last=undefined;accumulator=0;control.reset();flap.disabled=true;pause.disabled=true;};
  function renderTable(){
    const snapshots={initial:input.initial,imitation:input.imitation,post_rl:input.postRl};
    const flappyHuman=human.filter(r=>r.game==='flappy'),flappyModels=modelRecords.filter(r=>r.game==='flappy');
    const rowsFor=(kind:'human'|'initial'|'imitation'|'post_rl')=>kind==='human'?flappyHuman:flappyModels.filter(r=>r.controller===kind);
    const emptyState=(kind:'human'|'initial'|'imitation'|'post_rl')=>{
      if(kind==='human')return 'Nog niet getest';
      if(kind==='initial')return 'Niet getraind · nog niet getest';
      return snapshots[kind]?'Model bestaat · nog niet getest':'Geen model';
    };
    const table=document.createElement('table');table.style.width='100%';table.style.borderCollapse='collapse';
    const caption=document.createElement('caption');caption.textContent='Resultaten op dezelfde openingen';table.append(caption);
    const header=document.createElement('tr');
    for(const text of ['Besturing','Pogingen','Punten gemiddeld (min–max)','Overleving gemiddeld']){const h=document.createElement('th');h.scope='col';h.textContent=text;h.style.padding='10px';header.append(h);}
    const head=document.createElement('thead');head.append(header);table.append(head);const body=document.createElement('tbody');
    for(const kind of ['human','initial','imitation','post_rl'] as const){
      const rows=rowsFor(kind);const summary=summarizeEvaluations(rows);
      const tr=document.createElement('tr');const heading=document.createElement('th');heading.scope='row';heading.textContent=label[kind];tr.append(heading);
      for(const text of [String(summary.attempts),summary.mean===null?emptyState(kind):`${summary.mean.toFixed(1)} (${summary.min}–${summary.max})`,summary.meanSurvivalSteps===null?'—':`${(summary.meanSurvivalSteps/60).toFixed(1)} s`]){
        const td=document.createElement('td');td.textContent=text;td.style.padding='10px';tr.append(td);
      }body.append(tr);
    }table.append(body);q('#compare-table').replaceChildren(table);
    q('#compare-details').replaceChildren(...[...flappyHuman,...flappyModels].map(r=>{const p=document.createElement('p');const b=r.budget;p.textContent=`${label[r.controller]} · reeks ${r.seed} · poging ${r.attempt}: ${r.result.pipesPassed} punten, ${r.result.survivalSteps} stappen, ${r.result.terminationReason}. Voorbeelden ${b.demonstrationSeconds}s; updates ${b.supervisedUpdates}; oefenpogingen ${b.trainingEpisodes}; interacties ${b.interactions}; rekentijd ${b.wallTimeMs}ms. Model ${r.modelId} · ${r.sequenceId}.`;return p;}));
    renderBarChart(q('#compare-chart'),{
      title:'Gemiddelde score',
      description:'Elke balk is het gemiddelde van de opgeslagen testpogingen. Pogingen gebruiken dezelfde drie reeksen.',
      series:[{label:'Punten gemiddeld',color:'#5200ff'}],minimum:0,
      format:value=>value.toFixed(1),emptyMessage:'Er zijn nog geen testpogingen gemeten.',
      items:(['human','initial','imitation','post_rl'] as const).map(kind=>{
        const rows=rowsFor(kind),summary=summarizeEvaluations(rows);
        return{label:label[kind],values:[summary.mean],detail:summary.mean===null?emptyState(kind):`${summary.attempts} pogingen`};
      })
    });
    status.textContent=human.length<3?`${human.length}/3 testpogingen klaar. Maak alle pogingen voor een eerlijke vergelijking.`:'Drie testpogingen klaar voor vergelijking.';
    start.disabled=human.length>=3||active;
  }
  q<HTMLButtonElement>('#compare-run').onclick=()=>{
    const records:EvaluationRecord[]=[];
    for(const snapshot of [input.initial,input.imitation,input.postRl])if(snapshot){
      const budget:Partial<EvaluationBudget>={demonstrationSeconds:snapshot.stage==='initial'?0:input.demonstrationSeconds,
        interactions:snapshot.stage==='post_rl'?input.practiceSteps??0:0,wallTimeMs:snapshot.stage==='post_rl'?input.practiceElapsedMs??0:0};
      records.push(...evaluateFlappy(snapshot,COMPARISON_SEEDS,{budget}));
    }
    modelRecords=records;input.onModelRecords?.(Object.freeze([...modelRecords]));renderTable();q('#compare-status').textContent='De testresultaten staan in de grafiek.';
  };
  const frame=(time:number)=>{
    if(!active||!env||disposed)return;
    const delta=last===undefined?0:time-last;last=time;
    const next=advanceFlappyFrame(delta,accumulator,()=>control.consumeAction(),action=>{
      if(!active||!env)return;const t=env.step(action);renderer.render(env.world);
      if(t.done&&t.result){
        const seed=COMPARISON_SEEDS[human.length]!;
        human.push(validateEvaluationRecord({schemaVersion:1,game:'flappy',controller:'human',modelId:'human-no-identity',sequenceId:`${FLAPPY_SEQUENCE_VERSION}:${seed}`,seed,attempt:human.length+1,mode:'validation',configVersion:FLAPPY_WORLD_CONFIG_VERSION,observationVersion:FLAPPY_OBSERVATION_VERSION,budget:{demonstrationSeconds:0,supervisedUpdates:0,trainingEpisodes:0,interactions:0,wallTimeMs:0},result:t.result}));
        stop();env=undefined;input.onHumanRecords?.(Object.freeze([...human]));renderTable();start.textContent='Speel volgende testpoging';
      }
    });accumulator=next.accumulatorMs;if(active)raf=requestAnimationFrame(frame);
  };
  start.onclick=()=>{
    if(active||human.length>=3)return;
    if(!env){env=new FlappyEnvironment();env.reset({seed:COMPARISON_SEEDS[human.length]!});renderer.render(env.world);}
    control.reset();active=true;start.disabled=true;pause.disabled=false;flap.disabled=false;canvas.focus({preventScroll:true});last=undefined;raf=requestAnimationFrame(frame);
    status.textContent=`Testpoging ${human.length+1}/3 gestart. Er worden geen voorbeelden opgeslagen.`;
  };
  const pauseRun=()=>{if(active){stop();start.disabled=false;start.textContent='Hervat testpoging';status.textContent='Testpoging gepauzeerd; hervat om dezelfde poging voort te zetten.';}};
  pause.onclick=pauseRun;window.addEventListener('blur',pauseRun);
  const visibility=()=>{if(document.hidden)pauseRun();};document.addEventListener('visibilitychange',visibility);
  const first=new FlappyEnvironment();first.reset({seed:COMPARISON_SEEDS[0]!});renderer.render(first.world);renderTable();
  return{getRecords:()=>Object.freeze([...human,...modelRecords]),dispose(){disposed=true;stop();control.dispose();renderer.dispose();window.removeEventListener('blur',pauseRun);document.removeEventListener('visibilitychange',visibility);root.replaceChildren();}};
}
