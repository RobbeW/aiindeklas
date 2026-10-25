import { createRewardAttempt } from './schematic-data.ts';
import { gameSnapshot,diagramNote,money } from './schematic-elements.ts';
import '../styles/extended-schematics.css';
import '../styles/schematic-common.css';
export function mountRewardExplainer(root:HTMLElement){
 const attempt=createRewardAttempt();let index=0;
 root.innerHTML=`<section class="se-explainer reward-explainer" aria-labelledby="reward-scene-title"><h2 id="reward-scene-title">Waarvoor krijgt de vogel punten?</h2><p>De agent probeert de totale beloning te maximaliseren.</p><div class="se-content"></div><div class="se-readout" role="status" aria-live="polite" aria-atomic="true"></div><div class="se-controls"><button type="button" class="secondary se-prev">Vorig moment</button><button type="button" class="secondary se-next">Volgend moment</button><button type="button" class="secondary se-reset">Opnieuw</button></div><p class="se-note">Drie momenten uit één poging. Het totaal telt ook de tussenstappen mee.</p>${diagramNote}</section>`;
 const q=<T extends HTMLElement>(s:string)=>root.querySelector<T>(s)!;
 const prev=q<HTMLButtonElement>('.se-prev'),next=q<HTMLButtonElement>('.se-next'),reset=q<HTMLButtonElement>('.se-reset');
 const render=()=>{const m=attempt.moments[index]!;
  q('.se-content').innerHTML=`<div class="sch-flow sch-flow--three"><div class="sch-object"><span class="sch-label">Spelmoment</span><div class="sch-platform">${gameSnapshot(m.world)}<span class="sch-small">Stap ${m.step}</span></div></div><span class="sch-arrow" aria-hidden="true">→</span><div class="sch-object is-active"><span class="sch-label">Beloning op deze stap</span><div class="sch-platform"><span class="sch-big">${m.reward>=0?'+':''}${money(m.reward)}</span><span class="sch-small">${m.event==='collision'?'Botsing':m.event==='opening'?'Opening gepasseerd':'Vliegen'}</span></div></div><span class="sch-arrow" aria-hidden="true">→</span><div class="sch-object"><span class="sch-label">Trainingsbeloning</span><div class="sch-platform"><span class="sch-big">${money(m.total)}</span><span class="sch-small">Alles opgeteld</span></div><span class="sch-label se-score">Spelscore: ${m.score}</span></div></div>`;
  q('.se-readout').textContent=m.event==='flying'?'+0,01 voor een stap blijven vliegen.':m.event==='opening'?'+0,01 voor vliegen en +1 voor de opening: samen +1,01.':'−1 bij een botsing. De poging stopt.';
  prev.disabled=index===0;next.disabled=index===attempt.moments.length-1;
 };
 prev.onclick=()=>{index=Math.max(0,index-1);render();};next.onclick=()=>{index=Math.min(2,index+1);render();};reset.onclick=()=>{index=0;render();};render();
 return{dispose(){prev.onclick=next.onclick=reset.onclick=null;root.replaceChildren();}};
}
