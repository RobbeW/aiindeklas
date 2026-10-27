import { mountGameFullscreen } from '../ui/game-fullscreen.ts';
import {ArenaControllers,type ArenaInputMode,type ArenaPad} from '../input/arena-controllers.ts';
import {advanceFixedFrame} from '../core/fixed-step.ts';
import type {PolicySnapshot} from '../learning/policy-snapshot.ts';
import {FlappyArenaSession,type ArenaPlayerId} from './arena-session.ts';
import {createFlappyRenderer,type BirdColour} from './renderer.ts';
import '../styles/flappy-arena.css';

const names:Record<ArenaPlayerId,string>={p1:'Speler 1',p2:'Speler 2',p3:'Speler 3',ai:'AI-model'};
const ids=['p1','p2','p3','ai'] as const,colours:readonly BirdColour[]=['red','blue','yellow','purple'];
const keys=['f','j','l'];
export async function mountFlappyArenaView(root:HTMLElement,options:{snapshot?:PolicySnapshot;onPractice:()=>void}){
 if(!options.snapshot||options.snapshot.stage!=='post_rl'){
  root.innerHTML='<section class="card arena-missing"><p class="eyebrow">5 · Daag het AI-model uit</p><h1>Bijna klaar voor de wedstrijd</h1><p>Laat je AI-model eerst zelfstandig oefenen. Daarna kunnen drie spelers het uitdagen.</p><button type="button">Ga naar zelfstandig oefenen</button></section>';
  root.querySelector('button')!.onclick=options.onPractice;return{dispose(){root.replaceChildren();}};
 }
 const trained=options.snapshot;
 root.innerHTML=`<section class="flappy-arena" aria-labelledby="arena-title"><header class="arena-header"><div><p class="eyebrow">5 · Daag het AI-model uit</p><h1 id="arena-title">Drie spelers tegen jullie AI-model</h1></div><button type="button" class="secondary arena-fullscreen">Volledig scherm</button></header><div class="arena-toolbar"><p class="arena-status" role="status" aria-live="polite" aria-atomic="true">De vogels laden…</p><div class="arena-actions"><button type="button" class="arena-start" disabled>Start wedstrijd</button><button type="button" class="secondary arena-pause" hidden>Pauzeer</button></div></div><section class="arena-results" hidden aria-labelledby="arena-result-title"><h2 id="arena-result-title" tabindex="-1"></h2><ol class="arena-standings"></ol><div class="toolbar"><button type="button" class="arena-new">Nieuwe spelers</button><button type="button" class="secondary arena-rematch">Nog een ronde</button></div></section><div class="arena-stage"><div class="arena-fields">${ids.map((id,i)=>`<article class="arena-panel arena-${colours[i]}" data-player="${id}" aria-labelledby="arena-label-${id}"><div class="arena-field"><canvas class="arena-canvas" aria-label="Speelveld ${names[id]}"></canvas><div class="arena-seat"><canvas class="arena-bird" aria-hidden="true"></canvas><strong class="arena-seat-title">${id==='ai'?'Jullie AI-model':'Druk op A'}</strong><span class="arena-seat-detail">${id==='ai'?'Klaar voor de wedstrijd':'om mee te doen'}</span></div><span class="arena-out" hidden>Klaar</span></div><footer class="arena-player-marker"><h2 id="arena-label-${id}"><span class="arena-colour-dot" aria-hidden="true"></span>${names[id]}</h2><p class="arena-score">0 punten · 0,0 s</p></footer></article>`).join('')}</div><div class="arena-overlay" hidden><div><p class="arena-overlay-label"></p><h2 class="arena-count" tabindex="-1"></h2><p class="arena-pause-detail"></p><button type="button" class="arena-resume" hidden>Verder spelen</button></div></div></div><div class="arena-bottom"><p class="arena-control-hint">A = flappen · Start = pauze</p><details class="arena-options"><summary>Zonder controllers proberen</summary><p>Gebruik één toetsenbord: Speler 1 = F, Speler 2 = J, Speler 3 = L.</p><button type="button" class="secondary arena-keyboard">Probeer met toetsenbord</button><p class="arena-mapping-note">Geen A-knop? Gebruik de onderste actieknop. Bij een onbekende controller kies je zelf een knop door erop te drukken.</p></details></div></section>`;
 const q=<T extends HTMLElement=HTMLElement>(s:string)=>root.querySelector<T>(s)!;
 const arena=q('.flappy-arena'),status=q('.arena-status'),start=q<HTMLButtonElement>('.arena-start'),pauseButton=q<HTMLButtonElement>('.arena-pause'),overlay=q('.arena-overlay'),count=q('.arena-count'),pauseDetail=q('.arena-pause-detail'),resume=q<HTMLButtonElement>('.arena-resume'),results=q('.arena-results');
 const panels=ids.map(id=>q(`[data-player="${id}"]`));
 const controls=new ArenaControllers();let session=new FlappyArenaSession(trained,4000),round=0;
 let phase:'lobby'|'countdown'|'running'|'paused'|'finished'='lobby',disposed=false,loaded=false,keyboard=false,last=0,accumulator=0,countdownAt=0,countdownResume=false,frame=0,seatStamp='',lastCount='',lastWing=-1,pauseReason='';
 const held=new Set<string>(),tapped=new Set<string>(),startHeld=new Set<number>();
 let renderers:Awaited<ReturnType<typeof createFlappyRenderer>>[]=[];
 const media=matchMedia('(prefers-reduced-motion: reduce)');
 const readPads=():readonly (ArenaPad|null)[]=>{
  if(keyboard)return keys.map((key,i)=>({index:100+i,id:`keyboard-${i}`,connected:true,mapping:'standard',buttons:[{pressed:held.has(key)||tapped.has(key)}]}));
  try{return navigator.getGamepads?[...navigator.getGamepads()]:[];}catch{return[];}
 };
 const tell=(text:string)=>{if(status.textContent!==text)status.textContent=text;};
 const clearInput=()=>{controls.barrier(readPads());tapped.clear();accumulator=0;last=0;};
 const showSeats=()=>{
  const seats=controls.seats,next=JSON.stringify(seats);if(next===seatStamp)return;seatStamp=next;
  seats.forEach((seat,i)=>{const panel=panels[i]!,joined=!!seat?.connected;panel.classList.toggle('is-joined',joined);panel.classList.toggle('is-ready',!!seat?.ready&&joined);
   panel.querySelector('.arena-seat-title')!.textContent=!joined?'Druk op '+(keyboard?keys[i]!.toUpperCase():'A'):seat.ready?'Klaar!':'Je doet mee!';
   panel.querySelector('.arena-seat-detail')!.textContent=!joined?'om mee te doen':seat.ready?'Wacht op de andere spelers':`Druk nog eens op ${keyboard?keys[i]!.toUpperCase():seat.standard?'A / ×':`knop ${seat.button+1}`} als je klaar bent`;
  });
 };
 const paint=()=>{
  const snapshot=session.snapshot;
  snapshot.participants.forEach((p,i)=>{const panel=panels[i]!;renderers[i]?.render(p.world);panel.dataset.steps=String(p.world.steps);panel.querySelector('.arena-score')!.textContent=`${p.score} ${p.score===1?'punt':'punten'} · ${(p.world.steps/60).toFixed(1).replace('.',',')} s`;panel.classList.toggle('is-out',!!p.result);(panel.querySelector('.arena-out') as HTMLElement).hidden=!p.result;});
  arena.dataset.phase=phase;arena.dataset.seed=String(snapshot.seed);
 };
 const enterLobby=(newPlayers:boolean)=>{
  round++;session=new FlappyArenaSession(trained,4000+round);phase='lobby';arena.dataset.phase=phase;
  if(newPlayers)controls.reset(readPads());else controls.barrier(readPads());
  results.hidden=true;overlay.hidden=true;pauseButton.hidden=true;start.hidden=false;start.disabled=!controls.allReady;seatStamp='';showSeats();paint();
  tell(newPlayers?(keyboard?'Nieuwe spelers: druk op F, J of L om mee te doen.':'Nieuwe spelers: pak een controller en druk op A.'):'Klaar voor nog een ronde? Kies Start wedstrijd.');
  if(newPlayers){const heading=q('#arena-title');heading.tabIndex=-1;heading.focus({preventScroll:true});}else start.focus({preventScroll:true});
 };
 const finish=()=>{
  phase='finished';arena.dataset.phase=phase;pauseButton.hidden=true;overlay.hidden=true;results.hidden=false;
  const snapshot=session.snapshot,winners=snapshot.standings.filter(s=>s.rank===1);
  const title=winners.length>1?'Gelijkspel!':`${names[winners[0]!.id]} wint deze ronde!`;
  q('#arena-result-title').textContent=title;tell(title);
  q('.arena-standings').replaceChildren(...snapshot.standings.map(row=>{const li=document.createElement('li');li.className=`arena-result-${row.id}`;const strong=document.createElement('strong');strong.textContent=`${row.rank}. ${names[row.id]}`;const detail=document.createElement('span');detail.textContent=`${row.score} ${row.score===1?'punt':'punten'} · ${(row.survivalSteps/60).toFixed(1).replace('.',',')} s`;li.append(strong,detail);return li;}));
  q('#arena-result-title').focus({preventScroll:true});clearInput();
 };
 const pause=(reason:string)=>{
  if(phase!=='running'&&phase!=='countdown')return;
  if(session.snapshot.phase==='running')session.pause();phase='paused';pauseReason=reason;arena.dataset.phase=phase;overlay.hidden=false;count.textContent='Pauze';q('.arena-overlay-label').textContent='Even wachten';resume.hidden=false;resume.disabled=!controls.allReady;pauseButton.hidden=true;clearInput();tell(reason);resume.focus({preventScroll:true});
 };
 const beginCountdown=()=>{
  if(!loaded||!controls.allReady||(phase!=='lobby'&&phase!=='paused'))return;
  if(document.hidden)return;
  countdownResume=session.snapshot.phase==='paused';phase='countdown';arena.dataset.phase=phase;countdownAt=performance.now();lastCount='';overlay.hidden=false;resume.hidden=true;pauseDetail.textContent='';start.hidden=true;pauseButton.hidden=false;pauseButton.textContent='Pauzeer';q('.arena-overlay-label').textContent='Iedereen klaar?';clearInput();tell('We beginnen over drie seconden.');
 };
 const keyboardToggle=()=>{
  if(phase!=='lobby')return;
  keyboard=!keyboard;held.clear();tapped.clear();controls.reset(readPads());seatStamp='';showSeats();
  q('.arena-keyboard').textContent=keyboard?'Gebruik controllers':'Probeer met toetsenbord';
  q('.arena-control-hint').textContent=keyboard?'Speler 1: F · Speler 2: J · Speler 3: L · Esc = pauze':'A = flappen · Start = pauze';
  tell(keyboard?'Druk op F, J of L om mee te doen.':'Pak een controller en druk op A.');
 };
 start.onclick=beginCountdown;resume.onclick=beginCountdown;pauseButton.onclick=()=>pause('De wedstrijd is gepauzeerd.');
 q<HTMLButtonElement>('.arena-new').onclick=()=>enterLobby(true);q<HTMLButtonElement>('.arena-rematch').onclick=()=>enterLobby(false);q<HTMLButtonElement>('.arena-keyboard').onclick=keyboardToggle;
 const fullscreen=q<HTMLButtonElement>('.arena-fullscreen');const game=document.createElement('div');game.className='game-fullscreen';arena.append(game);game.append(fullscreen,q('.arena-toolbar'),q('.arena-results'),q('.arena-stage'),q('.arena-bottom'));const fullscreenControl=mountGameFullscreen(game,fullscreen,tell);
 const keydown=(e:KeyboardEvent)=>{
  if(e.key==='Escape'&&(phase==='running'||phase==='countdown')){if(document.fullscreenElement!==game)e.preventDefault();pause('De wedstrijd is gepauzeerd.');return;}
  const key=e.key.toLowerCase();if(!keyboard||!keys.includes(key)||e.repeat)return;
  if((e.target as HTMLElement)?.matches('input,textarea,select'))return;held.add(key);tapped.add(key);e.preventDefault();
 };
 const keyup=(e:KeyboardEvent)=>held.delete(e.key.toLowerCase());
 const onBlur=()=>{held.clear();tapped.clear();pause('Het spelvenster was niet actief. Klaar om verder te spelen?');controls.barrier(readPads());};
 const onVisibility=()=>{if(document.hidden)onBlur();};
 const tick=(timestamp:number)=>{
  if(disposed)return;
  try{
   const pads=readPads(),inputMode:ArenaInputMode=phase==='running'?'game':phase;
   const events=controls.poll(pads,inputMode);tapped.clear();showSeats();
   if(events.missing.length&&(phase==='running'||phase==='countdown'))pause('Een controller is losgekoppeld.');
   const starts=pads.filter((p):p is ArenaPad=>!!p?.connected&&controls.seats.some(s=>s?.connected&&s.standard&&s.index===p.index)&&!!p.buttons[9]?.pressed);
   const freshStart=starts.some(p=>!startHeld.has(p.index));startHeld.clear();starts.forEach(p=>startHeld.add(p.index));
   if(freshStart){if(phase==='running'||phase==='countdown')pause('De wedstrijd is gepauzeerd.');else if(phase==='lobby'||phase==='paused')beginCountdown();}
   if(phase==='lobby'){
    start.disabled=!loaded||!controls.allReady;
    const joined=controls.seats.filter(s=>s?.connected).length;
    if(controls.allReady)tell(keyboard?'Iedereen klaar! Kies Start wedstrijd.':'Iedereen klaar! Kies Start wedstrijd of druk op Start op je controller.');
    else if(joined)tell(`${joined} van de 3 spelers doen mee. Druk nog eens op je actieknop als je klaar bent.`);
    const wing=media.matches?1:Math.floor(timestamp/170)%3;
    if(wing!==lastWing){lastWing=wing;renderers.forEach((renderer,i)=>renderer.renderBird(panels[i]!.querySelector<HTMLCanvasElement>('.arena-bird')!,wing));}
   }else if(phase==='paused'){
    const missing=controls.seats.flatMap((s,i)=>!s?.connected?[`Speler ${i+1}`]:[]);
    pauseDetail.textContent=missing.length?`${missing.join(', ')}: verbind je controller en druk op A om terug mee te doen.`:pauseReason;
    resume.disabled=!controls.allReady;
   }else if(phase==='countdown'){
    const elapsed=timestamp-countdownAt,label=String(Math.max(1,3-Math.floor(elapsed/1000)));
    if(label!==lastCount){lastCount=label;count.textContent=label;count.dataset.number=label;}
    if(elapsed>=3000){if(countdownResume)session.resume();else session.start();phase='running';arena.dataset.phase=phase;overlay.hidden=true;clearInput();tell(keyboard?'F, J en L = flappen. Succes!':'A = flappen. Succes!');}
   }else if(phase==='running'){
    const delta=last?timestamp-last:0;
    const next=advanceFixedFrame(delta,accumulator,()=>controls.consume(),actions=>{if(session.snapshot.phase==='running')session.step(actions);});accumulator=next.accumulatorMs;
    paint();if(session.snapshot.phase==='finished')finish();
   }
   q<HTMLButtonElement>('.arena-keyboard').disabled=phase!=='lobby';
   last=phase==='running'?timestamp:0;
  }catch(error){if(session.snapshot.phase==='running')session.pause();phase='paused';arena.dataset.phase=phase;overlay.hidden=false;count.textContent='Spelen lukt niet';pauseDetail.textContent=error instanceof Error?error.message:String(error);resume.hidden=true;pauseButton.hidden=true;tell('Spelen lukt niet. Ga terug naar een andere oefening en probeer opnieuw.');return;}
  frame=requestAnimationFrame(tick);
 };
 window.addEventListener('keydown',keydown);window.addEventListener('keyup',keyup);window.addEventListener('blur',onBlur);document.addEventListener('visibilitychange',onVisibility);
 try{
  const loadedRenderers=await Promise.allSettled(panels.map((p,i)=>createFlappyRenderer(p.querySelector<HTMLCanvasElement>('.arena-canvas')!,{birdColour:colours[i]})));
  renderers=loadedRenderers.flatMap(result=>result.status==='fulfilled'?[result.value]:[]);
  const failed=loadedRenderers.find(r=>r.status==='rejected');if(failed?.status==='rejected')throw failed.reason;
  loaded=true;panels.forEach((panel,i)=>panel.querySelector('.arena-canvas')!.setAttribute('aria-label',`Speelveld ${names[ids[i]!]}`));panels[3]!.classList.add('is-ready','is-joined');showSeats();paint();tell('Pak een controller en druk op A om mee te doen.');frame=requestAnimationFrame(tick);
 }catch(e){fullscreenControl.dispose();renderers.forEach(r=>r.dispose());window.removeEventListener('keydown',keydown);window.removeEventListener('keyup',keyup);window.removeEventListener('blur',onBlur);document.removeEventListener('visibilitychange',onVisibility);throw e;}
 return{dispose(){disposed=true;cancelAnimationFrame(frame);renderers.forEach(r=>r.dispose());window.removeEventListener('keydown',keydown);window.removeEventListener('keyup',keyup);window.removeEventListener('blur',onBlur);document.removeEventListener('visibilitychange',onVisibility);fullscreenControl.dispose();root.replaceChildren();}};
}
