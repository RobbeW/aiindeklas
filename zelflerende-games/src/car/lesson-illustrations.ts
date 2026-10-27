import '../styles/car-illustrations.css';
import { validateCircuit,TRACK_VERSION } from '../tracks/document.ts';
import { createRoadGeometry } from '../tracks/geometry.ts';
import { tileSvgPath } from '../tracks/renderer.ts';
import { carSensors } from './sensors.ts';
import { CAR_CONFIG } from './config.ts';
type Scene='play'|'edit'|'tracks'|'compare';
const model=()=>`<div class="cl-model" aria-label="AI-model"><svg viewBox="0 0 150 100" aria-hidden="true"><g stroke="#716382" fill="none">${[25,50,75].flatMap(y=>[20,40,60,80].map(z=>`<path d="M20 ${y} 75 ${z}"/>`)).join('')}${[20,40,60,80].flatMap(y=>[32,68].map(z=>`<path d="M75 ${y} 130 ${z}"/>`)).join('')}</g><g fill="#5200ff">${[25,50,75].map(y=>`<circle cx="20" cy="${y}" r="5"/>`).join('')}${[20,40,60,80].map(y=>`<circle cx="75" cy="${y}" r="6"/>`).join('')}${[32,68].map(y=>`<circle cx="130" cy="${y}" r="6"/>`).join('')}</g></svg><strong>AI-model</strong></div>`;
const map=(kind=0)=>`<svg viewBox="0 0 200 150" aria-hidden="true"><path d="m12 118 88 24 88-24v7l-88 25-88-25z" fill="#b5a998" stroke="#25221d"/><rect x="12" y="9" width="176" height="116" rx="9" fill="#f8f4eb" stroke="#25221d" stroke-width="2"/><path d="${kind===1?'M44 100V34H156V65H112V100Z':kind===2?'M48 100V32H152V100Z':'M38 96V38H162V96Z'}" fill="none" stroke="#625b70" stroke-width="24" stroke-linejoin="round"/><path d="M90 26v24" stroke="white" stroke-width="9"/><path d="M86 27h8m-8 8h8m-8 8h8" stroke="#160033" stroke-width="4"/></svg>`;
function sensorScene(){
 const document=validateCircuit({version:TRACK_VERSION,width:4,height:3,cells:[{x:0,y:1,kind:'straight',rotation:1},{x:1,y:1,kind:'straight',rotation:1},{x:2,y:1,kind:'turn',rotation:3},{x:2,y:0,kind:'straight',rotation:0}]});
 const car={x:120,y:150,heading:0,speed:2},distances=carSensors(createRoadGeometry(document,false),car);
 const tiles=document.cells.map(tile=>`<g transform="translate(${tile.x*100} ${tile.y*100}) rotate(${tile.rotation*90} 50 50)"><path d="${tileSvgPath(tile.kind)}" fill="none" stroke="#625B70" stroke-width="52"/><path d="${tileSvgPath(tile.kind)}" fill="none" stroke="#E2DDEA" stroke-width="2" stroke-dasharray="7 7"/></g>`).join('');
 const rays=distances.map((distance,i)=>{const angle=CAR_CONFIG.rayAngles[i]!*Math.PI/180,x=car.x+Math.cos(angle)*distance,y=car.y+Math.sin(angle)*distance;return `<path d="M${car.x} ${car.y} L${x} ${y}"/><circle cx="${x}" cy="${y}" r="2.5"/>`;}).join('');
 return `<div class="cl-panel cl-road"><svg viewBox="0 0 310 225" aria-hidden="true"><rect x="1" y="1" width="308" height="223" rx="12" fill="#F8F7F3" stroke="#B9B1A4"/>${tiles}<g class="cl-sensors" stroke="#3DFFD0" fill="#3DFFD0" stroke-width="2">${rays}</g><ellipse cx="120" cy="150" rx="23" ry="13" fill="white" opacity=".9"/><image href="${import.meta.env.BASE_URL}assets/car/car.png" x="100" y="141" width="40" height="18"/></svg><strong>Vijf afstanden tot de rand</strong><span class="cl-speed-label">En de snelheid van de auto</span></div>`;
}
const scenes:Record<Scene,{label:string;body:string}>={
 play:{label:'Van sensoren naar sturen',body:`${sensorScene()}<span class="cl-arrow" aria-hidden="true">→</span>${model()}<span class="cl-arrow" aria-hidden="true">→</span><div class="cl-decisions"><strong>Stuurkeuze</strong><span>Rechtdoor</span><span>Links</span><span>Rechts</span></div>`},
 edit:{label:'Meer ruimte voor jouw circuit',body:`<div class="cl-panel">${map()}<strong>Rechte stukken en bochten</strong></div><span class="cl-arrow" aria-hidden="true">→</span><div class="cl-panel cl-expanded">${map(1)}<strong>Een groter raster</strong></div>`},
 tracks:{label:'Elke auto rijdt de hele oefenreeks',body:`<div class="cl-panel">${map()}<strong>Een oefenlus</strong></div><span class="cl-arrow" aria-hidden="true">→</span><div class="cl-panel">${map(1)}<strong>Jouw circuit</strong></div><span class="cl-arrow" aria-hidden="true">→</span><div class="cl-panel">${map(2)}<strong>Andere bochten</strong></div>`},
 compare:{label:'Oefenen en testen op verschillende circuits',body:`<div class="cl-panel">${map()}<strong>Oefencircuit</strong></div><span class="cl-arrow" aria-hidden="true">→</span>${model()}<span class="cl-arrow" aria-hidden="true">→</span><div class="cl-panel">${map(1)}<strong>Andere testbaan</strong></div>`}
};
/** Illustrative scenes only; no synthetic scores or model updates are presented as experiment results. */
export function mountCarLessonIllustration(root:HTMLElement,scene:Scene){
 const data=scenes[scene],win=root.ownerDocument.defaultView,media=win?.matchMedia('(prefers-reduced-motion: reduce)');let paused=false,disposed=false,visible=true;
 root.innerHTML=`<figure class="car-illustration" aria-label="${data.label}"><div class="cl-scene">${data.body}</div><figcaption>${scene==='play'?'Het AI-model krijgt afstanden en snelheid, en kiest rechtdoor, links of rechts.':scene==='edit'?'Vergroot de bouwruimte zonder je bestaande tegels te wissen.':scene==='tracks'?'Alle modellen krijgen dezelfde circuits, in dezelfde volgorde.':'Tijdens de test blijft het AI-model gelijk.'}</figcaption>${scene==='play'?'<button type="button" class="secondary cl-pause">Pauzeer beeld</button>':''}</figure>`;
 const figure=root.querySelector<HTMLElement>('figure')!,button=root.querySelector<HTMLButtonElement>('.cl-pause');
 const update=()=>{const reduced=media?.matches??false;figure.classList.toggle('cl-paused',paused||reduced||!visible||root.ownerDocument.hidden);if(button){button.hidden=reduced;button.disabled=reduced;button.textContent=reduced?'Stilstaand beeld':paused?'Speel beeld af':'Pauzeer beeld';}};
 if(button)button.onclick=()=>{paused=!paused;update();};
 const observer=win?.IntersectionObserver?new win.IntersectionObserver(entries=>{visible=entries[0]?.isIntersecting??true;update();}):undefined;observer?.observe(figure);
 root.ownerDocument.addEventListener('visibilitychange',update);media?.addEventListener('change',update);update();
 return{dispose(){if(disposed)return;disposed=true;observer?.disconnect();media?.removeEventListener('change',update);root.ownerDocument.removeEventListener('visibilitychange',update);root.replaceChildren();}};
}
