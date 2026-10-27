import { mountGameFullscreen } from '../ui/game-fullscreen.ts';
import {CarRaceSession} from './race-session.ts';
import type {CarSnapshot} from './policy-adapter.ts';
import {CarRaceInput,type RacePad} from '../input/car-race-input.ts';
import {drawTrack} from '../tracks/renderer.ts';
import {loadReferenceTrack} from '../tracks/catalog.ts';
import {trackIdentity,type CircuitDocument} from '../tracks/document.ts';
import {drawVehicle,drawCollisionFlame,mountVehicleChoice} from './vehicle-art.ts';
import '../styles/car-race.css';

const colours=['#be4300','#006aaa','#9b7200','#5200ff'];
const name=(id:number,humans:number)=>id===humans?'AI-model':`Speler ${id+1}`;
const decimal=(n:number)=>n.toFixed(1).replace('.',',');
export function mountCarRaceView(root:HTMLElement,options:{document:CircuitDocument;circuits?:readonly {name:string;document:CircuitDocument}[];model?:CarSnapshot;onTrain:()=>void}){
 if(!options.model||options.model.stage==='initial'){
  root.innerHTML='<section class="card"><h2>Klaar om het AI-model uit te dagen?</h2><p>Laat eerst een generatie oefenen. Daarna race je alleen of met drie spelers tegen het beste AI-model.</p><button type="button">Ga naar Evolueer</button></section>';
  root.querySelector('button')!.onclick=options.onTrain;return{pause(){},dispose(){root.replaceChildren();}};
 }
 const model=options.model;
 root.innerHTML=`<section class="car-race"><header class="car-race-header"><div><h2>Wie rijdt het beste?</h2><p>Race tegen het beste AI-model uit je training.</p></div><button type="button" class="secondary race-fullscreen">Volledig scherm</button></header><div class="race-legacy card" hidden><p>Dit bewaarde AI-model rijdt met de eerdere rijsnelheid. Jullie gebruiken in deze race allemaal dezelfde snelheid.</p><button type="button" class="secondary race-upgrade">Train met de nieuwe snelheid</button></div><div class="race-setup card"><label>Wedstrijd<select class="race-mode"><option value="1">Jij tegen AI · 2 auto's</option><option value="3">Drie spelers tegen AI · 4 auto's</option></select></label><label>Circuit<select class="race-track"></select></label><div class="race-seats"></div><p class="race-join">Druk op A op een Xbox-controller om een vrije plek te kiezen. Kies ‘Wacht op controller’ om een toetsenbordplek vrij te maken.</p><p class="race-controls">← → / A D = sturen · ↑ / W = gas · ↓ / S = rem. Xbox: linker stick of D-pad = sturen · RT = gas · LT = rem.</p><button type="button" class="race-start">Start wedstrijd</button></div><div class="race-vehicle"></div><div class="toolbar"><p class="race-status" role="status" aria-live="polite"></p><button type="button" class="secondary race-pause" hidden>Pauzeer</button></div><div class="race-stage"><canvas class="race-canvas" tabindex="0" aria-label="Gezamenlijk racecircuit. Gebruik de gekozen toetsen of controller om te sturen, gas te geven en te remmen."></canvas><div class="race-overlay" hidden><div><strong class="race-count"></strong><p class="race-pause-reason"></p><button type="button" class="race-resume" hidden>Verder spelen</button></div></div></div><div class="race-hud"></div><p class="muted race-fairness">Jij regelt gas en rem. Het AI-model geeft automatisch gas. Jullie starten tegelijk; auto's rijden door elkaar heen.</p><section class="race-results card" hidden><h2 tabindex="-1" class="race-result-title"></h2><ol class="race-ranking"></ol><div class="toolbar"><button type="button" class="race-again">Nog een race</button><button type="button" class="secondary race-new">Nieuwe spelers</button></div></section></section>`;
 const q=<T extends HTMLElement=HTMLElement>(s:string)=>root.querySelector<T>(s)!;
 const area=q('.car-race'),canvas=q<HTMLCanvasElement>('.race-canvas'),ctx=canvas.getContext('2d')!;
 const setup=q('.race-setup'),overlay=q('.race-overlay'),start=q<HTMLButtonElement>('.race-start'),resume=q<HTMLButtonElement>('.race-resume'),pauseButton=q<HTMLButtonElement>('.race-pause');
 q('.race-legacy').hidden=model.worldVersion!=='car-world-v1';q<HTMLButtonElement>('.race-upgrade').onclick=options.onTrain;
 let humans:1|3=1,input=new CarRaceInput(humans),circuit=options.document,session=new CarRaceSession(circuit,model,humans);
 let phase:'lobby'|'countdown'|'running'|'paused'|'finished'='lobby',disposed=false,frame=0,last=0,accumulator=0,countdown=0,loadToken=0,loading=false,stamp='';
 const held=new Set<string>(),readPads=():readonly (RacePad|null)[]=>{try{return navigator.getGamepads?[...navigator.getGamepads()]:[];}catch{return[];}};
 const tell=(text:string)=>{if(q('.race-status').textContent!==text)q('.race-status').textContent=text;};
 const clear=()=>{held.clear();last=0;accumulator=0;};
 const tracks=[{name:'Huidig circuit',document:circuit},...(options.circuits??[]).filter(c=>trackIdentity(c.document)!==trackIdentity(circuit))];
 const trackSelect=q<HTMLSelectElement>('.race-track');tracks.forEach((t,i)=>{const o=document.createElement('option');o.value=String(i);o.textContent=t.name;trackSelect.append(o);});
 const controlOption=document.createElement('option');controlOption.value='control';controlOption.textContent='Andere baan · controlelus';trackSelect.append(controlOption);
 function paint(){
  if(disposed)return;if(canvas.width!==circuit.width*100)canvas.width=circuit.width*100;if(canvas.height!==circuit.height*100)canvas.height=circuit.height*100;drawTrack(ctx,circuit);
  for(const r of session.racers){const c=r.world.car,colour=r.ai?colours[3]!:colours[r.id]!;
   ctx.save();ctx.strokeStyle=colour;ctx.lineWidth=3;ctx.beginPath();ctx.arc(c.x,c.y,19+r.id*3,0,Math.PI*2);ctx.stroke();ctx.restore();
   drawVehicle(ctx,c.x,c.y,c.heading,r.result?.crashed ? .65 : 1);
   if(r.result?.crashed)drawCollisionFlame(ctx,c.x,c.y);
   const peers=session.racers.filter(other=>Math.hypot(other.world.car.x-c.x,other.world.car.y-c.y)<8),offset=(peers.findIndex(other=>other.id===r.id)-(peers.length-1)/2)*26;
   const label=r.ai?'AI':String(r.id+1),lx=Math.max(16,Math.min(canvas.width-16,c.x+offset)),ly=Math.max(18,c.y-32);ctx.save();ctx.font='bold 15px system-ui';ctx.textAlign='center';ctx.lineWidth=4;ctx.strokeStyle='#fffdf7';ctx.strokeText(label,lx,ly);ctx.fillStyle=colour;ctx.fillText(label,lx,ly);ctx.restore();
  }
  for(const r of session.racers){const cell=q(`[data-racer="${r.id}"] .race-progress`);const result=r.result;cell.textContent=`${decimal(100*r.world.progress.bestDistance/session.route.length)}% · ${decimal(r.world.steps/60)} s${result?.laps?' · Finish!':result?.crashed?' · Gebotst':result?' · Tijd om':''}`;}
  area.dataset.phase=phase;area.dataset.steps=String(session.elapsedSteps);
 }
 function renderSeats(){
  stamp=JSON.stringify(input.bindings);
  q('.race-seats').replaceChildren();
  input.bindings.forEach((binding,i)=>{
   const label=document.createElement('label');label.textContent=`Speler ${i+1}`;label.className='race-seat';label.style.setProperty('--racer-colour',colours[i]!);
   const select=document.createElement('select');select.dataset.seat=String(i);select.setAttribute('aria-label',`Bediening speler ${i+1}`);
   for(const [value,text]of [['none','Wacht op controller'],['arrows','Pijltjestoetsen'],['wasd','WASD']]){const o=document.createElement('option');o.value=value!;o.textContent=text!;select.append(o);}
   if(binding?.kind==='pad'){const o=document.createElement('option');o.value='pad';o.textContent='Xbox-controller';select.append(o);}
   select.value=binding?.kind??'none';select.onchange=()=>{if(select.value==='pad')return;const kind=select.value==='none'?undefined:select.value as 'arrows'|'wasd';if(!input.setKeyboard(i,kind))tell('Deze toetsen zijn al gekozen door een andere speler.');stamp='';renderSeats();q<HTMLSelectElement>(`[data-seat="${i}"]`).focus();};
   const state=document.createElement('span');state.className='race-seat-state';label.append(select,state);q('.race-seats').append(label);
  });
  q('.race-hud').innerHTML=session.racers.map(r=>`<article data-racer="${r.id}" style="--racer-colour:${r.ai?colours[3]:colours[r.id]}"><strong>${name(r.id,humans)}</strong><span class="race-progress"></span></article>`).join('');paint();
 }
 function updateSeats(pads:readonly (RacePad|null)[]){
  const next=JSON.stringify(input.bindings);if(next!==stamp){stamp=next;renderSeats();}
  input.bindings.forEach((b,i)=>{const label=q(`[data-seat="${i}"]`).parentElement!;label.querySelector('.race-seat-state')!.textContent=input.connected(i,pads)?'Klaar':b?'Controller losgekoppeld':'Druk op A om mee te doen';});
  start.disabled=loading||!input.ready(pads);resume.disabled=loading||!input.ready(pads);
 }
 function lobby(newPlayers=false){
  phase='lobby';start.hidden=false;if(newPlayers)input=new CarRaceInput(humans);session=new CarRaceSession(circuit,model,humans);clear();
  setup.hidden=false;overlay.hidden=true;q('.race-results').hidden=true;pauseButton.hidden=true;stamp='';renderSeats();updateSeats(readPads());tell('Kies de bediening en start de wedstrijd.');
 }
 function pause(reason='Even pauze.'){if(phase!=='running'&&phase!=='countdown')return;session.pause();phase='paused';clear();overlay.hidden=false;q('.race-count').textContent='Pauze';q('.race-pause-reason').textContent=reason;resume.hidden=false;pauseButton.hidden=true;setup.hidden=false;start.hidden=true;updateSeats(readPads());tell(reason);resume.focus({preventScroll:true});}
 function begin(){if(loading||document.hidden||!input.ready(readPads())||!['lobby','paused'].includes(phase))return;phase='countdown';countdown=performance.now();clear();setup.hidden=true;start.hidden=false;overlay.hidden=false;resume.hidden=true;q('.race-pause-reason').textContent='Klaar?';q('.race-count').textContent='3';pauseButton.hidden=false;canvas.focus({preventScroll:true});tell('De race start over drie seconden.');}
 function finish(){
  phase='finished';clear();pauseButton.hidden=true;overlay.hidden=true;q('.race-results').hidden=false;
  const rows=session.standings,winners=rows.filter(r=>r.rank===1),title=winners.length>1?'Gelijkspel!':`${name(winners[0]!.id,humans)} wint!`;
  q('.race-result-title').textContent=title;q('.race-ranking').replaceChildren(...rows.map(r=>{const li=document.createElement('li');li.textContent=`${r.rank}. ${name(r.id,humans)} · ${r.result?.laps?'finish':decimal(r.world.progress.bestDistance/session.route.length*100)+'% van het circuit'} · ${decimal(r.world.steps/60)} s`;return li;}));
  tell(title);q('.race-result-title').focus({preventScroll:true});paint();
 }
 q<HTMLSelectElement>('.race-mode').onchange=e=>{humans=(e.currentTarget as HTMLSelectElement).value==='3'?3:1;lobby(true);};
 trackSelect.onchange=async()=>{const token=++loadToken;loading=true;updateSeats(readPads());tell('Circuit laden…');try{const doc=trackSelect.value==='control'?await loadReferenceTrack('long-loop'):tracks[Number(trackSelect.value)]!.document;if(disposed||token!==loadToken)return;circuit=doc;loading=false;lobby();}catch(e){if(!disposed&&token===loadToken){loading=false;trackSelect.value=String(tracks.findIndex(t=>trackIdentity(t.document)===trackIdentity(circuit)));tell(`Circuit niet geladen: ${String(e)}`);updateSeats(readPads());}}};
 start.onclick=begin;resume.onclick=begin;pauseButton.onclick=()=>pause();q<HTMLButtonElement>('.race-again').onclick=()=>{lobby();start.focus();};q<HTMLButtonElement>('.race-new').onclick=()=>{lobby(true);q<HTMLSelectElement>('[data-seat="0"]').focus();};
 const game=document.createElement('div');game.className='game-fullscreen';area.append(game);const fullscreen=q<HTMLButtonElement>('.race-fullscreen');game.append(fullscreen,setup,q('.race-status').parentElement!,q('.race-stage'),q('.race-hud'),q('.race-results'));const fullscreenControl=mountGameFullscreen(game,fullscreen,tell);
 const keys=new Set(['arrowleft','arrowright','arrowup','arrowdown','a','d','w','s']);
 const onDown=(e:KeyboardEvent)=>{if(e.key==='Escape'){pause();return;}const key=e.key.toLowerCase();if(phase!=='running'||!keys.has(key)||e.defaultPrevented||document.activeElement!==canvas&&document.activeElement!==document.body)return;held.add(key);e.preventDefault();};
 const onUp=(e:KeyboardEvent)=>held.delete(e.key.toLowerCase());const blur=()=>{clear();pause('Het venster verloor de focus. Ga verder als iedereen klaar is.');};const hidden=()=>{if(document.hidden)blur();};
 window.addEventListener('keydown',onDown);window.addEventListener('keyup',onUp);window.addEventListener('blur',blur);document.addEventListener('visibilitychange',hidden);
 function tick(now:number){
  if(disposed)return;const pads=readPads(),join=phase==='lobby'||phase==='paused';const event=input.poll(pads,join);updateSeats(pads);
  if(event.pause)pause('Pauze via controller.');
  if((phase==='running'||phase==='countdown')&&!input.ready(pads))pause('Controller losgekoppeld. Sluit hem opnieuw aan of druk op A op een vervangende controller.');
  if(phase==='countdown'){const elapsed=now-countdown;q('.race-count').textContent=String(Math.max(1,3-Math.floor(elapsed/1000)));if(elapsed>=3000){session.start();phase='running';overlay.hidden=true;clear();last=now;tell('Rijden maar!');}}
  if(phase==='running'){
   accumulator+=Math.min(.1,last?(now-last)/1000:0);last=now;
   while(accumulator>=1/60&&session.phase==='running'){session.step(input.controls(held,pads));accumulator-=1/60;}
   paint();if(session.phase==='finished')finish();
  }
  frame=requestAnimationFrame(tick);
 }
 lobby();const choice=mountVehicleChoice(q('.race-vehicle'),paint);frame=requestAnimationFrame(tick);
 return{pause:()=>pause(),dispose(){disposed=true;loadToken++;cancelAnimationFrame(frame);clear();choice.dispose();window.removeEventListener('keydown',onDown);window.removeEventListener('keyup',onUp);window.removeEventListener('blur',blur);document.removeEventListener('visibilitychange',hidden);fullscreenControl.dispose();root.replaceChildren();}};
}
