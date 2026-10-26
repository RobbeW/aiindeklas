import { dataRoles,type DataRole } from './schematic-data.ts';
import { diagramNote,chipIcon } from './schematic-elements.ts';
import '../styles/extended-schematics.css';
import '../styles/schematic-common.css';
export function mountTestingExplainer(root:HTMLElement){
 let selected:DataRole='training';
 root.innerHTML=`<section class="se-explainer testing-explainer" aria-labelledby="testing-scene-title"><h2 id="testing-scene-title">Oefenen en testen</h2><p>Bij training oefent het AI-model om beter te worden in de taak. Een beetje zoals jij studeert voor een toets wiskunde.</p><div class="se-benches" role="group" aria-label="Kies Training, Controle of Test">${(['training','control','test'] as const).map(role=>`<button type="button" class="se-bench sch-object" data-role="${role}" aria-pressed="${role===selected}"><span class="sch-label">${dataRoles[role].name}</span><span class="sch-platform">${chipIcon}<span class="sch-small">${dataRoles[role].action}</span></span></button>`).join('')}</div><div class="se-readout" role="status" aria-live="polite" aria-atomic="true"></div><p class="se-fixed-tests">Testreeksen 2030, 2031 en 2032 blijven gelijk. Een herhaalde test is geen nieuwe reeks.</p>${diagramNote}</section>`;
 const buttons=[...root.querySelectorAll<HTMLButtonElement>('[data-role]')],status=root.querySelector<HTMLElement>('.se-readout')!;
 const render=()=>{const role=dataRoles[selected];status.innerHTML=`<strong>${role.name}: ${role.action.toLowerCase()}.</strong><p>${role.copy}</p>`;for(const b of buttons){const active=b.dataset.role===selected;b.setAttribute('aria-pressed',String(active));b.classList.toggle('is-active',active);}};
 for(const b of buttons)b.onclick=()=>{selected=b.dataset.role as DataRole;render();};render();
 return{dispose(){for(const b of buttons)b.onclick=null;root.replaceChildren();}};
}
