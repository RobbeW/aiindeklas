import { mountGameFullscreen } from '../ui/game-fullscreen.ts';
import { summarizeEvaluations, type EvaluationRecord } from '../evaluation/records.ts';
import type { PolicySnapshot } from '../learning/policy-snapshot.ts';
import { createFlappyRenderer, type BirdColour } from './renderer.ts';
import { ModelMatchSession, modelMatchAvailable, type MatchPlayerId } from './model-match.ts';
import '../styles/model-match.css';

export interface ModelMatchOptions {
  readonly initial: PolicySnapshot; readonly imitation?: PolicySnapshot; readonly postRl?: PolicySnapshot;
  readonly humanRecords?: readonly EvaluationRecord[]; readonly modelRecords?: readonly EvaluationRecord[];
  readonly onModelRecords?: (records: readonly EvaluationRecord[]) => void; readonly onHumanRecords?: (records: readonly EvaluationRecord[]) => void;
  readonly demonstrationSeconds: number; readonly practiceSteps?: number; readonly practiceElapsedMs?: number;
  readonly onGoTeach?: () => void; readonly onGoPractice?: () => void;
}
const ids: readonly MatchPlayerId[] = ['A','B','C','D'];
const labels: Record<MatchPlayerId,string> = { A:'Beginmodel', B:'Jouw voorbeelden', C:'Zelfstandig geoefend', D:'Jij' };
const colours: Record<MatchPlayerId,BirdColour> = { A:'red', B:'blue', C:'yellow', D:'purple' };
const controller = (id: MatchPlayerId): EvaluationRecord['controller'] => ({ A:'initial',B:'imitation',C:'post_rl',D:'human' } as const)[id];

export async function mountModelMatchView(root: HTMLElement, options: ModelMatchOptions) {
  const models = Object.freeze([{id:'A' as const,snapshot:options.initial,available:true},{id:'B' as const,snapshot:options.imitation,available:!!options.imitation},{id:'C' as const,snapshot:options.postRl,available:!!options.postRl}]);
  const ready = modelMatchAvailable(models);
  root.innerHTML = `<section class="model-match" aria-labelledby="model-match-title"><header><p class="eyebrow">Vier vogels · dezelfde reeks</p><h1 id="model-match-title">Wie overleeft het langst?</h1><p>Drie bewaarde modellen en jij spelen tegelijk. Eén druk op Spatie, ↑ of de actieknop laat jouw vogel flappen.</p></header><div class="model-match-controls"><p class="model-match-status" role="status" aria-live="polite" aria-atomic="true">${ready?'Klaar voor test 1 van 3.':'Vul eerst de ontbrekende modellen aan.'}</p><button class="model-match-start" type="button" ${ready?'':'disabled'}>Start test 1</button><button class="secondary model-match-pause" type="button" hidden>Pauzeer</button><button class="secondary model-match-action" type="button" aria-label="Jij: flap" ${ready?'':'disabled'}>Flap</button><button class="secondary model-match-next" type="button" hidden>Volgende test</button><button class="secondary model-match-restart" type="button" hidden>Nieuwe ronde</button></div>${ready?'':`<div class="model-match-missing" role="status"><strong>Ontbrekende modellen</strong><p>${options.imitation?'':'B · Jouw voorbeelden — maak eerst voorbeelden en train het model.'} ${options.postRl?'':'C · Zelfstandig geoefend — rond eerst zelfstandig oefenen af.'}</p>${options.imitation?'':'<button type="button" class="secondary model-match-teach">Ga naar voorbeelden</button>'} ${options.postRl?'':'<button type="button" class="secondary model-match-practice">Ga naar zelfstandig oefenen</button>'}</div>`}<section class="model-match-results" hidden aria-live="polite"></section><div class="model-match-fields" ${ready?'':'hidden'}>${ids.map(id=>`<article class="model-match-player model-match-${colours[id]}" data-player="${id}"><div class="model-match-field"><canvas aria-label="Speelveld ${labels[id]}"></canvas><span class="model-match-out" hidden>Deze vogel is klaar</span></div><footer><strong><span aria-hidden="true" class="model-match-dot"></span>${id} · ${labels[id]}</strong><span class="model-match-score">0 punten · 0,0 s</span><span class="model-match-state"></span></footer></article>`).join('')}</div><p class="model-match-hint">Toetsenbord: Spatie of pijltje omhoog · controller: actieknop</p></section>`;
  const q=<T extends HTMLElement=HTMLElement>(selector:string)=>root.querySelector<T>(selector)!;
  const game=document.createElement('div');game.className='game-fullscreen';const section=q('.model-match');section.append(game);const fullscreen=document.createElement('button');fullscreen.type='button';fullscreen.className='secondary game-fullscreen-button';game.append(fullscreen,q('.model-match-controls'));const missing=root.querySelector<HTMLElement>('.model-match-missing');if(missing)game.append(missing);game.append(q('.model-match-results'),q('.model-match-fields'),q('.model-match-hint'));const fullscreenControl=mountGameFullscreen(game,fullscreen,message=>{q('.model-match-status').textContent=message;});
  const start=q<HTMLButtonElement>('.model-match-start'), pause=q<HTMLButtonElement>('.model-match-pause'), next=q<HTMLButtonElement>('.model-match-next'),restart=q<HTMLButtonElement>('.model-match-restart'), flap=q<HTMLButtonElement>('.model-match-action'), status=q<HTMLElement>('.model-match-status'),results=q<HTMLElement>('.model-match-results');
  q<HTMLButtonElement>('.model-match-teach')?.addEventListener('click',()=>options.onGoTeach?.()); q<HTMLButtonElement>('.model-match-practice')?.addEventListener('click',()=>options.onGoPractice?.());
  let human=[...(options.humanRecords??[])], stored=[...(options.modelRecords??[])],roundHuman:EvaluationRecord[]=[],roundModels:EvaluationRecord[]=[];
  const byId=new Map<MatchPlayerId,Awaited<ReturnType<typeof createFlappyRenderer>>>();
  const session=ready?new ModelMatchSession(models,{demonstrationSeconds:options.demonstrationSeconds,practiceSteps:options.practiceSteps??0,practiceElapsedMs:options.practiceElapsedMs??0}):undefined;
  let dead=false, mode:'ready'|'countdown'|'running'|'paused'|'completed'='ready', raf=0,last=0,acc=0,countdownTimer=0,humanQueued=0,padDown=false;
  try { for(const id of ids){const canvas=q<HTMLCanvasElement>(`[data-player="${id}"] canvas`); byId.set(id,await createFlappyRenderer(canvas,{birdColour:colours[id]}));canvas.setAttribute('aria-label',`${id} · ${labels[id]}`);if(id==='D')canvas.tabIndex=0;} } catch(error){for(const renderer of byId.values())renderer.dispose();fullscreenControl.dispose();throw error;}
  const paint=()=>{if(!session)return;for(const p of session.snapshot.players){const card=q<HTMLElement>(`[data-player="${p.id}"]`);byId.get(p.id)!.render(p.world);card.querySelector('.model-match-score')!.textContent=`${p.score} ${p.score===1?'punt':'punten'} · ${(p.world.steps/60).toFixed(1).replace('.',',')} s`;card.querySelector('.model-match-state')!.textContent=p.result?'Klaar':'';card.classList.toggle('is-out',!!p.result);(card.querySelector('.model-match-out') as HTMLElement).hidden=!p.result;}};
  const publish=()=>{options.onModelRecords?.(Object.freeze(stored.slice(-100)));options.onHumanRecords?.(Object.freeze(human.slice(-100)));};
  const appendRecords=()=>{for(const record of session!.recordsForCompletedTest()){if(record.controller==='human'){human.push(record);roundHuman.push(record);}else{stored.push(record);roundModels.push(record);}}human=human.slice(-100);stored=stored.slice(-100);publish();};
  const stop=()=>{if(raf)cancelAnimationFrame(raf);raf=0;last=0;acc=0;humanQueued=0;padDown=false;};
  const finish=()=>{
    mode='completed';stop();pause.hidden=true;start.hidden=true;flap.disabled=true;appendRecords();
    status.textContent=`Test ${session!.snapshot.test+1} klaar.`;
    if(session!.snapshot.test<2){results.hidden=true;next.hidden=false;next.focus({preventScroll:true});}
    else {
      const items=ids.map(id=>{
        const records=(id==='D'?roundHuman:roundModels).filter(r=>r.controller===controller(id));
        const sum=summarizeEvaluations(records);
        const seconds=records.reduce((n,r)=>n+r.result.survivalSteps,0)/Math.max(1,records.length)/60;
        return `<li><strong>${id} · ${labels[id]}</strong> ${sum.mean?.toFixed(1).replace('.',',')??'—'} punten · ${seconds.toFixed(1).replace('.',',')} s</li>`;
      }).join('');
      results.hidden=false;results.innerHTML=`<strong>Gemiddeld na drie tests</strong><ul>${items}</ul>`;
      status.textContent='Drie tests klaar.';restart.hidden=false;restart.focus({preventScroll:true});
    }
  };
  const frame=(time:number)=>{if(dead||mode!=='running')return;const delta=last?Math.min(100,Math.max(0,time-last)):0;last=time;acc+=delta;const stepMs=1000/60;while(acc>=stepMs&&mode==='running'){const snap=session!.step(humanQueued?1:0);humanQueued=0;acc-=stepMs;if(snap.phase==='completed'){paint();finish();return;}}paint();pollPad();raf=requestAnimationFrame(frame);};
  function padPressed(){let down=false;try{const pads=navigator.getGamepads?.()??[];for(const p of pads){if(p?.connected&&p.mapping==='standard'){down=!!p.buttons[0]?.pressed;break;}}}catch{/* gamepad API unavailable */}return down;}
  function pollPad(){const down=padPressed();if(down&&!padDown&&mode==='running')humanQueued=1;padDown=down;}
  const begin=()=>{if(!session||dead||mode!=='ready')return;mode='countdown';start.disabled=true;flap.disabled=true;status.textContent='3';let count=3;countdownTimer=window.setInterval(()=>{count--;if(count>0){status.textContent=String(count);return;}clearInterval(countdownTimer);humanQueued=0;padDown=padPressed();last=0;session.start();mode='running';flap.disabled=false;flap.focus({preventScroll:true});pause.hidden=false;pause.textContent='Pauzeer';start.hidden=true;status.textContent=`Test ${session.snapshot.test+1} van 3 · ${session.snapshot.seed}`;paint();raf=requestAnimationFrame(frame);},1000);};
  start.addEventListener('click',begin);
  flap.addEventListener('click',()=>{if(mode==='running')humanQueued=1;});
  const keydown=(event:KeyboardEvent)=>{if(document.activeElement!==document.body&&document.activeElement!==flap&&!document.activeElement?.matches('[data-player="D"] canvas'))return;if(mode==='running'&&(event.code==='Space'||event.code==='ArrowUp')){event.preventDefault();if(!event.repeat)humanQueued=1;}};window.addEventListener('keydown',keydown);
  const pauseRun=()=>{if(mode==='countdown'){clearInterval(countdownTimer);mode='ready';start.disabled=false;status.textContent='Aftellen gestopt. Start opnieuw wanneer je klaar bent.';}else if(mode==='running'){session!.pause();mode='paused';stop();pause.textContent='Verder spelen';status.textContent='Gepauzeerd. Hervat om verder te spelen.';}};
  const resume=()=>{if(mode==='paused'){humanQueued=0;padDown=padPressed();last=0;session!.resume();mode='running';pause.textContent='Pauzeer';status.textContent='Verder spelen.';flap.focus({preventScroll:true});raf=requestAnimationFrame(frame);}};
  pause.addEventListener('click',()=>mode==='paused'?resume():pauseRun());window.addEventListener('blur',pauseRun);const visibility=()=>{if(document.hidden)pauseRun();};document.addEventListener('visibilitychange',visibility);
  next.addEventListener('click',()=>{if(mode!=='completed')return;session!.nextTest();mode='ready';next.hidden=true;results.hidden=true;start.hidden=false;start.disabled=false;start.textContent=`Start test ${session!.snapshot.test+1}`;flap.disabled=false;status.textContent=`Klaar voor test ${session!.snapshot.test+1} van 3.`;paint();start.focus({preventScroll:true});});
  restart.addEventListener('click',()=>{if(mode!=='completed')return;session!.restart();mode='ready';restart.hidden=true;results.hidden=true;start.hidden=false;start.disabled=false;start.textContent='Start test 1';flap.disabled=false;roundHuman=[];roundModels=[];status.textContent='Nieuwe ronde klaar. Dezelfde eerlijke reeksen worden opnieuw gespeeld.';paint();start.focus({preventScroll:true});});
  paint();
  return {getRecords:()=>Object.freeze([...human,...stored]),dispose(){fullscreenControl.dispose();dead=true;clearInterval(countdownTimer);stop();window.removeEventListener('keydown',keydown);window.removeEventListener('blur',pauseRun);document.removeEventListener('visibilitychange',visibility);for(const renderer of byId.values())renderer.dispose();root.replaceChildren();}};
}
