import { createCoverageCollections,coverageKinds,coverageNames,type CoverageKind } from './schematic-data.ts';
import { diagramNote,number } from './schematic-elements.ts';
import { PHYSICS } from './physics.ts';
import '../styles/extended-schematics.css';
import '../styles/schematic-common.css';
export function mountCoverageExplainer(root:HTMLElement){
 const collections=createCoverageCollections();let mode:'waiting'|'varied'='waiting',selected:CoverageKind='rising';
 root.innerHTML=`<section class="se-explainer coverage-explainer" aria-labelledby="coverage-scene-title"><h2 id="coverage-scene-title">Welke situaties ontbreken?</h2><p>Veel voorbeelden kunnen toch steeds dezelfde situatie tonen.</p><div class="se-controls"><button type="button" class="secondary se-waiting" aria-pressed="true">Vooral wachten</button><button type="button" class="secondary se-varied" aria-pressed="false">Gevarieerde voorbeelden</button></div><p class="se-source"></p><div class="se-coverage-grid" role="group" aria-label="Bekijk een situatie">${coverageKinds.map(k=>`<button type="button" class="se-coverage-item" data-kind="${k}"><span class="sch-label">${coverageNames[k]}</span><span class="sch-platform"><span class="se-stack" aria-hidden="true">▱<br>▱<br>▱</span><span class="se-count"></span></span></button>`).join('')}</div><div class="se-readout" role="status" aria-live="polite" aria-atomic="true"></div><details><summary>Wat telt als een situatie?</summary><p>Hoog en laag zijn het bovenste en onderste derde van het veld. Stijgend en dalend volgen de bewegingsrichting. Dichtbij is maximaal 120 pixels vóór de opening. Eén moment kan bij meerdere situaties horen.</p><p>Deze telling toont welke situaties voorkomen. Ze voorspelt geen spelscore.</p></details>${diagramNote}</section>`;
 const q=<T extends HTMLElement>(s:string)=>root.querySelector<T>(s)!,buttons=[...root.querySelectorAll<HTMLButtonElement>('[data-kind]')],waiting=q<HTMLButtonElement>('.se-waiting'),varied=q<HTMLButtonElement>('.se-varied');
 const render=()=>{const c=collections[mode];q('.se-source').textContent=`Synthetische voorbeelden · ${c.episodes} ${c.episodes===1?'opname':'opnamen'} · ${c.total.toLocaleString('nl-BE')} momenten`;
  for(const b of buttons){const k=b.dataset.kind as CoverageKind,count=c.counts[k];b.setAttribute('aria-pressed',String(selected===k));b.dataset.present=String(count>0);b.querySelector<HTMLElement>('.se-count')!.textContent=count?`${count.toLocaleString('nl-BE')} momenten`:'Ontbreekt';}
  const frame=c.examples[selected];q('.se-readout').textContent=frame?`${coverageNames[selected]} komt voor. Voorbeeld: hoogte ${number((frame.observation[0]!+1)*PHYSICS.groundY/2)} px, verticale snelheid ${number(frame.observation[1]!*PHYSICS.maxFallVelocity)} px/s.`:`${coverageNames[selected]} ontbreekt in deze opnamen. Neem zo’n situatie ook op.`;
  waiting.setAttribute('aria-pressed',String(mode==='waiting'));varied.setAttribute('aria-pressed',String(mode==='varied'));
 };
 for(const b of buttons)b.onclick=()=>{selected=b.dataset.kind as CoverageKind;render();};waiting.onclick=()=>{mode='waiting';render();};varied.onclick=()=>{mode='varied';render();};render();
 return{dispose(){for(const b of buttons)b.onclick=null;waiting.onclick=varied.onclick=null;root.replaceChildren();}};
}
