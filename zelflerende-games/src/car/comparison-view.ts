import { TRACK_CATALOG,loadReferenceTrack } from '../tracks/catalog.ts';
import { trackIdentity } from '../tracks/document.ts';
import type { CircuitDocument } from '../tracks/document.ts';
import type { CarSnapshot } from './policy-adapter.ts';
import { evaluateCar,carResultRecord } from './comparison-adapter.ts';
import { mountCarPlayView } from './play-view.ts';
import { stableIdentity,type EvaluationRecord } from '../evaluation/records.ts';
import { renderBarChart } from '../ui/result-chart.ts';
import type { BarChartItem } from '../ui/result-chart.ts';
export function mountCarComparisonView(root:HTMLElement,options:{models:readonly CarSnapshot[];records?:readonly EvaluationRecord[];onRecords?:(records:readonly EvaluationRecord[])=>void}){
  let records=[...(options.records??[])],disposed=false,play:ReturnType<typeof mountCarPlayView>|undefined;
  root.innerHTML='<section class="card"><h2>Test op een andere baan</h2><p>Laat de bewaarde modellen hetzelfde circuit rijden. Rijd daarna zelf. De modellen veranderen tijdens deze test niet.</p><label>Testcircuit <select class="car-eval-track"><option value="long-loop">Andere oefenlus</option></select></label><div class="toolbar"><button class="car-eval">Test de modellen</button><button class="secondary car-eval-human">Rijd zelf</button><button class="secondary car-eval-final">Test op onbekende bochten</button></div><p class="car-eval-status" role="status" aria-live="polite">Kies een circuit en test een model of rijd een menselijke controlepoging om de eerste meting te maken.</p><div class="car-eval-chart"></div><div class="car-eval-table" role="region" aria-label="Vergelijking autorijden" tabindex="0" style="overflow-x:auto"></div><div class="car-budget-table" hidden></div><div class="car-eval-drive"></div></section>';
  const q=<T extends HTMLElement>(s:string)=>root.querySelector<T>(s)!;const status=q('.car-eval-status');let finalUsed=records.some(r=>r.mode==='final');
  const finalButton=q<HTMLButtonElement>('.car-eval-final');finalButton.disabled=finalUsed||!options.models.length;q<HTMLButtonElement>('.car-eval').disabled=!options.models.length;if(!options.models.length)status.textContent='Laat eerst een generatie oefenen. Je kunt hier al zelf rijden.';
  const render=()=>{
    const label=(r:EvaluationRecord)=>`${({initial:'Beginmodel',imitation:'Imitatie',post_rl:'Na zelfstandig oefenen',evolution:'Evolutie',human:'Jij'} as Record<string,string>)[r.controller]??r.controller}${r.controller==='evolution'?` · generatie ${r.budget.generations??'?'}`:''} · ${TRACK_CATALOG.find(t=>t.identity===r.sequenceId)?.label??'Eigen circuit'} · poging ${r.attempt}`;
    const carRecords=records.filter(r=>r.game==='car');
    const table=(host:HTMLElement,headers:string[],rows:string[][],empty:string)=>{
      if(!rows.length){const message=document.createElement('p');message.className='muted';message.textContent=empty;host.replaceChildren(message);return;}
      const t=document.createElement('table'),head=document.createElement('thead'),tr=document.createElement('tr');for(const text of headers){const th=document.createElement('th');th.scope='col';th.textContent=text;tr.append(th);}head.append(tr);t.append(head);const body=document.createElement('tbody');for(const values of rows){const row=document.createElement('tr');for(const text of values){const td=document.createElement('td');td.textContent=text;row.append(td);}body.append(row);}t.append(body);host.replaceChildren(t);
    };
    table(q('.car-eval-table'),['Bestuurder / circuit','Rondes','Route','Botsing','Tijd'],carRecords.map(r=>[label(r),String(r.result.laps),`${((r.result.progress??0)*100).toFixed(1)}%`,r.result.crashed?'ja':'nee',`${(r.result.survivalSteps/60).toFixed(1)} s`]),'Nog geen metingen. Kies een circuit en test vaste modellen of rijd een menselijke controlepoging.');
    table(q('.car-budget-table'),['Bestuurder / circuit','Voorbeelden (ook synthetisch)','Updates / RL-pogingen / generaties','Interacties / rekentijd'],carRecords.map(r=>[label(r),`${r.budget.demonstrationSeconds.toFixed(1)} s`,`${r.budget.supervisedUpdates} / ${r.budget.trainingEpisodes} / ${r.budget.generations??0}`,`${r.budget.interactions} / ${r.budget.wallTimeMs>0?(r.budget.wallTimeMs/1000).toFixed(2)+' s':'niet gemeten'}`]),'Er zijn nog geen oefenbudgetten bij opgeslagen metingen.');
    const latestCircuit=carRecords.at(-1)?.sequenceId??TRACK_CATALOG.find(t=>t.id===q<HTMLSelectElement>('.car-eval-track').value)?.identity;
    const circuitName=TRACK_CATALOG.find(t=>t.identity===latestCircuit)?.label??'Eigen circuit';
    const circuitRecords=carRecords.filter(r=>r.sequenceId===latestCircuit);
    const items:BarChartItem[]=circuitRecords.slice(-8).map(r=>({label:`${({initial:'Beginmodel',imitation:'Imitatie',post_rl:'Na oefenen',evolution:'Evolutie',human:'Jij'} as Record<string,string>)[r.controller]??r.controller}${r.controller==='evolution'?` · generatie ${r.budget.generations??'?'}`:''} · poging ${r.attempt}${r.mode==='final'?' · eindtest':''}`,values:[r.result.progress??0],detail:`${r.result.laps} rondes · ${r.result.crashed?'botsing':'geen botsing'}`}));
    const testedModels=new Set(circuitRecords.map(r=>r.modelId));
    for(const model of options.models){if(!testedModels.has(stableIdentity(model)))items.push({label:`${({initial:'Beginmodel',imitation:'Imitatie',post_rl:'Na oefenen',evolution:'Evolutie'} as Record<string,string>)[model.stage]}${model.stage==='evolution'?` · generatie ${model.training.generations??'?'}`:''} · ${circuitName}`,values:[null],detail:model.stage==='initial'?'Niet getraind · nog niet getest':'Model bestaat · nog niet getest'});}
    if(!circuitRecords.some(r=>r.controller==='human'))items.push({label:`Menselijke controle · ${circuitName}`,values:[null],detail:'Nog niet getest'});
    renderBarChart(q('.car-eval-chart'),{title:`Routevoortgang · ${circuitName}`,description:'Elke balk toont een opgeslagen poging op dit ene circuit. De tabel bevat ook rondes, botsingen en tijd.',series:[{label:'Routevoortgang',color:'#5200ff'}],items,minimum:0,maximum:1,format:value=>`${(value*100).toFixed(0)}%`,emptyMessage:'Nog geen routevoortgang gemeten. Kies een circuit en test een model of rijd een menselijke controlepoging.'});
  };
  const publish=()=>{render();options.onRecords?.(Object.freeze([...records]));};
  const selected=()=>loadReferenceTrack(q<HTMLSelectElement>('.car-eval-track').value);
  const run=async(doc:CircuitDocument,final=false)=>{if(disposed)return;const rows=options.models.map(model=>evaluateCar(model,doc,{seed:final?3000:2005,allowFinal:final,attempt:1+records.filter(r=>r.modelId===stableIdentity(model)&&r.sequenceId===trackIdentity(doc)&&r.mode===(final?'final':'validation')).length}));records.push(...rows);status.textContent=`${rows.length} modellen getest.`;publish();};
  q<HTMLButtonElement>('.car-eval').onclick=()=>{void selected().then(doc=>run(doc)).catch(e=>{status.textContent=String(e);});};
  q<HTMLButtonElement>('.car-eval-human').onclick=()=>{void selected().then(doc=>{if(disposed)return;play?.dispose();play=mountCarPlayView(q('.car-eval-drive'),{document:doc,getSeed:()=>2005,controllerLabel:'menselijke controle · wordt nooit trainingsdata',onEpisode:r=>{records.push(carResultRecord(r,doc,2005,'human','human-full-scene',undefined,1+records.filter(x=>x.controller==='human'&&x.sequenceId===trackIdentity(doc)).length));publish();}});q('.car-eval-drive').scrollIntoView({block:'start'});}).catch(e=>{status.textContent=String(e);});};
  finalButton.onclick=()=>{if(finalUsed)return;finalUsed=true;finalButton.disabled=true;void loadReferenceTrack('unseen-bends').then(doc=>run(doc,true)).catch(e=>{if(!disposed){status.textContent=String(e);finalUsed=false;finalButton.disabled=false;}});};
  render();return{getRecords:()=>Object.freeze([...records]),dispose(){disposed=true;play?.dispose();root.replaceChildren();}};
}
