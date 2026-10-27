import {DemoTimeline,DEMO_SCENES} from './timeline.ts';
import {DemoBirdSession} from './bird-session.ts';
import {DemoCarSession} from './car-session.ts';
import {DemoInputs,advanceDemoInputs} from './inputs.ts';
import {createDemoTraining,demoExamples,demoInitial} from './training.ts';
import type {RacePad} from '../input/car-race-input.ts';
import type {DemonstrationEpisode} from '../data/demonstrations.ts';
import type {PolicySnapshot} from '../learning/policy-snapshot.ts';
import {CarPolicy,createCarSnapshot,type CarSnapshot} from '../car/policy-adapter.ts';
import type {ParallelPracticeProgress} from '../learning/parallel-practice.ts';
import type {EvolutionProgress} from '../evolution/generation-job.ts';
import {createInitialLibrary,getTrainingDocuments} from '../tracks/library.ts';
import {trackIdentity,type CircuitDocument} from '../tracks/document.ts';
import {drawTrack} from '../tracks/renderer.ts';
import {drawVehicle,drawCollisionFlame} from '../car/vehicle-art.ts';
import {createFlappyRenderer,createFlappyFlockRenderer,type BirdColour} from '../flappy/renderer.ts';
import {FlappyFlock} from '../flappy/flock.ts';
import {mountLessonIllustration} from '../flappy/lesson-illustrations.ts';
import {mountEvolutionLesson} from '../car/evolution-lesson.ts';
import {mountGameFullscreen} from '../ui/game-fullscreen.ts';
import '../styles/show-floor.css';

const colours=['#be4300','#006aaa','#9b7200','#5200ff'],birdColours:BirdColour[]=['red','blue','yellow','purple'];
const matrix=()=>`<svg class="demo-matrix" viewBox="0 0 320 180" aria-label="AI-model"><rect x="3" y="3" width="314" height="174" rx="18" fill="#fffdf7" stroke="#5200ff" stroke-width="3"/><g stroke="#a28bbf" stroke-width="2">${[40,80,120,160].flatMap(y=>[35,70,105,140].map(z=>`<path d="M45 ${y} 158 ${z}"/>`)).join('')}${[35,70,105,140].flatMap(y=>[60,120].map(z=>`<path d="M158 ${y} 275 ${z}"/>`)).join('')}</g><g fill="#5200ff">${[40,80,120,160].map(y=>`<circle cx="45" cy="${y}" r="8"/>`).join('')}${[35,70,105,140].map(y=>`<circle cx="158" cy="${y}" r="9"/>`).join('')}${[60,120].map(y=>`<circle cx="275" cy="${y}" r="10"/>`).join('')}</g></svg>`;
const pads=():readonly(RacePad|null)[]=>{try{return navigator.getGamepads?[...navigator.getGamepads()]:[];}catch{return[];}};
const clockText=(ms:number)=>{const seconds=Math.ceil(Math.max(0,ms)/1000);return `${Math.floor(seconds/60)}:${String(seconds%60).padStart(2,'0')}`;};
const esc=(text:string)=>text.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;');

/** A separate, session-only presentation; it never opens or writes the experiment store. */
export async function mountShowFloor(root:HTMLElement,options:{timeline?:DemoTimeline}={}){
 const timeline=options.timeline??new DemoTimeline(),inputs=new DemoInputs(),training=createDemoTraining(),documents=getTrainingDocuments(createInitialLibrary());
 let disposed=false,epoch=0,frame=0,last=0,accumulator=0,countdown=3000,roundWait=0,operatorPaused=false,hold=false,fault='',faultMs=0,jobMs=0,loop=-1;
 let bird:DemoBirdSession|undefined,car:DemoCarSession|undefined,examples:readonly DemonstrationEpisode[]=[],imitation:PolicySnapshot|undefined,learned:PolicySnapshot|undefined,bestCar:CarSnapshot|undefined;
 let birdProgress:ParallelPracticeProgress|undefined,carProgress:EvolutionProgress|undefined,jobDone=false,flock:FlappyFlock|undefined,sceneStamp='',mountedId='',round=0,lastHud='';
 let renderers:Awaited<ReturnType<typeof createFlappyRenderer>>[]=[],flockRenderer:Awaited<ReturnType<typeof createFlappyFlockRenderer>>|undefined,art:{dispose():void;setActive?(active:boolean):void;setPhase?(phase:number):void}|undefined;
 const held=new Set<string>();
 root.innerHTML=`<main class="show-floor"><div class="demo-presentation"><header class="demo-header"><a class="demo-brand" href="./">AI in de Klas</a><p class="demo-chapter"></p><div class="demo-operators"><button type="button" class="secondary demo-fullscreen">Volledig scherm</button><button type="button" class="secondary demo-pause">Pauzeer</button><details><summary>Bediening</summary><div><button type="button" class="secondary demo-next">Volgende scène</button><button type="button" class="secondary demo-keyboard">Toetsenbord testen</button><button type="button" class="secondary demo-restart">Opnieuw beginnen</button><a href="./">Verlaat demonstratie</a></div></details></div></header><div class="demo-heading"><h1></h1><p class="demo-body"></p></div><div class="demo-track"><div class="demo-progress" role="progressbar" aria-label="Tijd van deze scène" aria-valuemin="0" aria-valuemax="100"><span></span></div><span class="demo-time"></span></div><p class="demo-status" role="status" aria-live="polite"></p><section class="demo-screen" aria-label="Demonstratie"></section><footer class="demo-footer"><p class="demo-controls"></p><p class="demo-next-label"></p></footer></div></main>`;
 const q=<T extends HTMLElement=HTMLElement>(s:string)=>root.querySelector<T>(s)!;
 const stage=q('.demo-screen'),status=q('.demo-status'),toggle=q<HTMLButtonElement>('.demo-pause');
 const fullscreen=mountGameFullscreen(q('.demo-presentation'),q<HTMLButtonElement>('.demo-fullscreen'),message=>tell(message));
 function tell(text:string){if(status.textContent!==text)status.textContent=text;}
 function dropScene(){art?.dispose();art=undefined;for(const r of renderers)r.dispose();renderers=[];flockRenderer?.dispose();flockRenderer=undefined;bird=undefined;car=undefined;flock=undefined;}
 function readyToLeave(){const id=timeline.snapshot.scene.id;return id==='f-imitation'?!!imitation:id==='f-training'?!!learned:id==='c-training'?!!bestCar:true;}
 function fail(error:unknown){if(disposed)return;fault=`Deze poging lukt niet. We starten de demonstratie opnieuw. ${error instanceof Error?error.message:''}`;faultMs=0;training.cancel();timeline.pause('fault');tell(fault);}
 function restart(){loop=-1;epoch++;training.cancel();dropScene();timeline.reset();hold=false;fault='';faultMs=0;operatorPaused=false;toggle.textContent='Pauzeer';sceneStamp='';last=0;void enter();}
 function syncPeople(){if(bird)inputs.humans.forEach((human,i)=>bird!.setHuman(i,human));}
 function captureExamples(){if(bird&&mountedId==='f-examples')examples=[...examples,...bird.takeExamples()].slice(-64);}
 function newRound(){
  const id=timeline.snapshot.scene.id;countdown=3000;roundWait=0;accumulator=0;round++;inputs.barrier(pads());held.clear();
  if(bird){bird.resetRound();syncPeople();}
  if(car){car=new DemoCarSession(documents[0]!,(id==='c-match'||id==='c-training'&&jobDone)?bestCar!:createCarSnapshot(new CarPolicy(1701),'initial'));}
 }
 function guardSnapshot(token:number,fn:()=>void){if(!disposed&&token===epoch)fn();}
 async function enter(){
  const before=timeline.snapshot,scene=before.scene,token=++epoch;training.cancel();dropScene();hold=false;timeline.resume('learning');timeline.resume('assets');jobDone=false;jobMs=0;birdProgress=undefined;carProgress=undefined;lastHud='';countdown=3000;roundWait=0;accumulator=0;round=0;
  if(loop!==before.loop){loop=before.loop;examples=[];imitation=undefined;learned=undefined;bestCar=undefined;inputs.reset(pads());}
  mountedId=scene.id;sceneStamp=`${before.loop}:${before.index}`;q('h1').textContent=scene.title;q('.demo-body').textContent=scene.body;q('.demo-chapter').textContent=`${scene.game==='flappy'?'Flappy Bird':'Raceauto'} · demonstratie`;q('.demo-next-label').textContent=`Hierna: ${DEMO_SCENES[(before.index+1)%DEMO_SCENES.length]!.title}`;
  q('.show-floor').dataset.scene=scene.id;q('.show-floor').dataset.kind=scene.kind;stage.replaceChildren();tell('Pak een controller en druk op A om mee te doen. Voorbeeldspel houdt de demonstratie ondertussen in beweging.');
  q('.demo-controls').textContent=scene.game==='flappy'?'A = meedoen en flappen · spelers 1, 2 en 3':'A = meedoen · linker stick = sturen · RT = gas · LT = rem';
  if(scene.kind==='splash'){
   stage.innerHTML='<div class="demo-splash-art"></div>';const host=q('.demo-splash-art');
   if(scene.id==='f-example-info')art=mountLessonIllustration(host,'teach',{hasHumanExamples:examples.some(e=>e.source==='human')});
   else if(scene.id==='c-darwin')art=mountEvolutionLesson(host,{onContinue:()=>advance(),manualTimeline:true});
   else if(scene.id==='c-circuits'){
    host.className+=' demo-circuits';for(const [i,doc]of documents.entries()){const panel=document.createElement('figure'),canvas=document.createElement('canvas'),caption=document.createElement('figcaption');canvas.width=doc.width*100;canvas.height=doc.height*100;drawTrack(canvas.getContext('2d')!,doc);caption.textContent=`Oefencircuit ${i+1}`;panel.append(canvas,caption);host.append(panel);}
   }else if(scene.id==='f-reward-info')host.innerHTML=`<div class="demo-reward-visual"><span class="demo-feedback positive">Beloning<br>Blijven vliegen</span>${matrix()}<span class="demo-feedback negative">Straf<br>Botsen</span></div><p>Alles voordoen kost tijd. Het AI-model kan ook zelf oefenen: probeer, krijg feedback en pas de aanpak aan. Het probeert zoveel mogelijk beloning te verzamelen.</p>`;
   else if(scene.id.includes('match-info'))host.innerHTML=`<div class="demo-lineup">${[0,1,2,3].map(i=>`<div style="--seat:${colours[i]}"><span>${scene.game==='flappy'?'●':'▰'}</span><strong>${i===3?'AI-model':`Speler ${i+1}`}</strong></div>`).join('')}</div><p>Drie minuten spelen. Nieuwe bezoekers kunnen met A meedoen. Zonder spelers loopt het voorbeeldspel door.</p>`;
   else host.innerHTML=`<div class="demo-learning-art"><span class="demo-icon"><img alt="${scene.game==='flappy'?'Flappy Bird':'Raceauto'}" src="${import.meta.env.BASE_URL}assets/${scene.game==='flappy'?'flappy/redbird-midflap.png':'car/car.png'}"></span><span aria-hidden="true">→</span>${matrix()}<span aria-hidden="true">→</span><span class="demo-icon">★</span></div>`;
  }
  if(scene.id==='f-imitation'){
   const data=demoExamples(examples),human=data.filter(e=>e.source==='human').length;examples=data;
   tell(`${human} voltooide spelerspogingen + 2 duidelijk gemarkeerde voorbeeldpogingen. Het model leert nu van die acties.`);
   void training.imitation(data,p=>guardSnapshot(token,()=>tell(`Leren van voorbeelden · ${p.completedUpdates} van ${p.updateBudget} updates · ${human} spelerspogingen + 2 voorbeeldpogingen`))).then(result=>guardSnapshot(token,()=>{imitation=result.snapshot;jobDone=true;tell('Het model heeft met de voorbeelden geoefend. Straks oefent het zelf verder.');})).catch(e=>guardSnapshot(token,()=>fail(e)));
  }
  if(scene.kind==='activity'){
   if(scene.id==='f-training'){
    if(!imitation){fail(new Error('Eerst zijn geleerde voorbeelden nodig.'));return;}
    stage.innerHTML=`<div class="demo-training-layout"><canvas class="demo-flock" aria-label="Twaalf vogels oefenen met echte beloningen en straffen"></canvas><div class="demo-training-story">${matrix()}<h2>Twaalf vogels, één AI-model</h2><p>Elke vogel probeert het. Beloning en straf sturen samen de volgende update.</p><p class="demo-training-counts"></p></div></div>`;
    timeline.pause('assets');try{const r=await createFlappyFlockRenderer(q<HTMLCanvasElement>('.demo-flock'));if(disposed||token!==epoch){r.dispose();return;}flockRenderer=r;}catch(e){if(!disposed&&token===epoch)fail(e);return;}finally{if(token===epoch)timeline.resume('assets');}
    void training.reward(imitation,p=>guardSnapshot(token,()=>{birdProgress=p;if(p.snapshot.stage==='post_rl')learned=p.snapshot;tell(`${p.completedRounds} ${p.completedRounds===1?'oefenronde':'oefenrondes'} · ${p.episodes} voltooide pogingen · ${p.updates} ${p.updates===1?'update':'updates'}. Beloningen veranderen het model.`);})).then(result=>guardSnapshot(token,()=>{learned=result.snapshot;jobDone=true;flock=new FlappyFlock(learned,12,2005,5000);tell(`Oefenen afgerond: ${result.episodes} pogingen. Zo speelt het model nu; tijdens dit kijken leert het niet verder.`);})).catch(e=>guardSnapshot(token,()=>fail(e)));
   }else if(scene.game==='flappy'){
    const mode=scene.id==='f-examples'?'examples':scene.id==='f-match'?'match':'untrained';if(mode==='match'&&!learned){fail(new Error('Zelfstandig oefenen is nog niet afgerond.'));return;}
    bird=new DemoBirdSession({mode,snapshot:mode==='match'?learned:demoInitial(),seed:4000+before.loop*100});syncPeople();
    stage.innerHTML=`<div class="demo-bird-fields">${[0,1,2,3].map(i=>`<article class="demo-bird-panel" data-seat="${i}" style="--seat:${colours[i]}"><div class="demo-field"><canvas aria-label="${i===3?'AI-model':`Speler ${i+1}`}" tabindex="${i===0?0:-1}"></canvas><span class="demo-player-out" hidden>Nieuwe ronde volgt</span></div><footer><strong>${i===3?'AI-model':`Speler ${i+1}`}</strong><span class="demo-source"></span><span class="demo-score"></span></footer></article>`).join('')}</div><div class="demo-round-banner" hidden></div>`;
    timeline.pause('assets');try{const rs=await Promise.all([...stage.querySelectorAll<HTMLCanvasElement>('canvas')].map((canvas,i)=>createFlappyRenderer(canvas,{birdColour:birdColours[i]})));if(disposed||token!==epoch){rs.forEach(r=>r.dispose());return;}renderers=rs;}catch(e){if(!disposed&&token===epoch)fail(e);return;}finally{if(token===epoch)timeline.resume('assets');}
   }else{
    stage.innerHTML='<canvas class="demo-car-canvas" tabindex="0" aria-label="Gezamenlijk circuit met menselijke en computerbestuurders"></canvas><div class="demo-car-hud"></div><div class="demo-round-banner" hidden></div>';
    if(scene.id==='c-training'){
     void training.cars(documents,p=>guardSnapshot(token,()=>{carProgress=p;if(p.champion)bestCar=p.champion;tell(`${p.completedGenerations} generaties · ${p.evaluatedEpisodes} complete ritten. Elke auto heeft zijn eigen AI-model.`);})).then(result=>guardSnapshot(token,()=>{bestCar=result.champion;jobDone=true;if(!bestCar){fail(new Error('Geen volledige generatie afgerond.'));return;}car=new DemoCarSession(documents[0]!,bestCar);tell(`Na ${result.completedGenerations} generaties rijdt hier het beste model. Het verandert tijdens deze rit niet.`);})).catch(e=>guardSnapshot(token,()=>fail(e)));
    }else{if(scene.id==='c-match'&&!bestCar){fail(new Error('Er is nog geen getraind automodel.'));return;}car=new DemoCarSession(documents[0]!,(scene.id==='c-match'||scene.id==='c-training'&&jobDone)?bestCar!:createCarSnapshot(new CarPolicy(1701),'initial'));}
   }
  }
  inputs.barrier(pads());held.clear();if(operatorPaused||document.hidden||!document.hasFocus())training.pause();art?.setActive?.(!timeline.snapshot.paused);last=0;
 }
 function advance(){if(fault){restart();return;}if(!readyToLeave()){tell('De computer oefent nog. Even wachten op de echte update.');return;}captureExamples();timeline.next();void enter();}
 function people(){return inputs.humans;}
 function paint(){
  if(mountedId==='c-darwin')art?.setPhase?.(Math.min(3,Math.floor(timeline.snapshot.elapsedMs/4000)));
  if(bird){const participants=bird.participants;for(const p of participants){renderers[p.id]?.render(p.world);const panel=stage.querySelector<HTMLElement>(`[data-seat="${p.id}"]`);if(!panel)continue;panel.querySelector('.demo-source')!.textContent=p.source==='human'?'Speler aan de knoppen':p.source==='synthetic_reference'?'Voorbeeldspel · druk op A':'AI-model';panel.querySelector('.demo-score')!.textContent=`${p.score} punten`;panel.querySelector<HTMLElement>('.demo-player-out')!.hidden=!p.result;}
   if(timeline.snapshot.scene.id==='f-examples'){const complete=[...examples,...bird.examples].filter(e=>e.source==='human').length;tell(`De computer kijkt naar jullie acties · ${complete} complete spelerspogingen. Voorbeeldspel is apart gemarkeerd.`);}
  }
  if(flockRenderer){if(jobDone&&flock){flockRenderer.render(flock.birds);}else if(birdProgress?.birds.length)flockRenderer.render(birdProgress.birds.map(b=>({id:b.id,world:b.world,done:b.done,pipesPassed:b.score})));q('.demo-training-counts').textContent=birdProgress?`${birdProgress.episodes} pogingen · ${birdProgress.updates} ${birdProgress.updates===1?'update':'updates'}`:'De vogels beginnen…';}
  const canvas=stage.querySelector<HTMLCanvasElement>('.demo-car-canvas');if(canvas){const ctx=canvas.getContext('2d')!;let doc:CircuitDocument=documents[0]!,agents=car?.participants??[];
   if(carProgress?.liveFrame&&!jobDone){doc=documents.find(d=>trackIdentity(d)===carProgress!.liveFrame!.trackId)??doc;agents=carProgress.liveFrame.agents.map((a,i)=>({id:i,world:a.world,result:a.result,score:a.world.progress.bestDistance/(a.result?.routeLength??1)}));}
   if(canvas.width!==doc.width*100)canvas.width=doc.width*100;if(canvas.height!==doc.height*100)canvas.height=doc.height*100;drawTrack(ctx,doc);
   for(const a of agents){if(jobDone&&timeline.snapshot.scene.id==='c-training'&&a.id!==3)continue;const c=a.world.car;drawVehicle(ctx,c.x,c.y,c.heading,a.result?.crashed ? .5 : 1);ctx.strokeStyle=colours[a.id%4]!;ctx.lineWidth=3;ctx.beginPath();ctx.arc(c.x,c.y,20+a.id%4*3,0,Math.PI*2);ctx.stroke();if(a.result?.crashed)drawCollisionFlame(ctx,c.x,c.y);if(agents.length===4){ctx.font='bold 15px system-ui';ctx.fillStyle=colours[a.id]!;ctx.fillText(a.id===3?'AI':String(a.id+1),c.x-8,Math.max(18,c.y-30));}}
   const hud=car?car.participants.map(p=>`${p.id===3?'AI-model':`Speler ${p.id+1}${people()[p.id]?'':' · voorbeeldspel'}`} · ${(p.score*100).toFixed(0)}%${p.result?.crashed?' · botsing':''}`).join('   |   '):carProgress?`Generatie ${carProgress.completedGenerations+1} · ${carProgress.evaluatedEpisodes} ritten`:'';if(hud!==lastHud){q('.demo-car-hud').textContent=hud;lastHud=hud;}
  }
  const banner=stage.querySelector<HTMLElement>('.demo-round-banner');if(banner){banner.hidden=countdown<=0&&roundWait<=0;banner.textContent=roundWait>0?'Ronde klaar · de volgende begint zo':`Klaar? ${Math.max(1,Math.ceil(countdown/1000))}`;}
 }
 function setPaused(reason:string,on:boolean){if(on){timeline.pause(reason);if(reason!=='learning')training.pause();}else{timeline.resume(reason);if(!operatorPaused&&!document.hidden&&document.hasFocus())training.resume();}held.clear();inputs.barrier(pads());accumulator=0;art?.setActive?.(!timeline.snapshot.paused);q('.show-floor').dataset.paused=String(operatorPaused||document.hidden||!document.hasFocus());last=0;}
 toggle.onclick=()=>{operatorPaused=!operatorPaused;setPaused('operator',operatorPaused);toggle.textContent=operatorPaused?'Hervat':'Pauzeer';};
 q<HTMLButtonElement>('.demo-next').onclick=advance;q<HTMLButtonElement>('.demo-restart').onclick=restart;q<HTMLButtonElement>('.demo-keyboard').onclick=()=>{inputs.keyboard();syncPeople();countdown=3000;tell('Toetsenbordtest: F/J/L flappen. Auto’s: pijltjes, WASD en IJKL.');};
 const keydown=(event:KeyboardEvent)=>{if(event.defaultPrevented||event.repeat||event.target instanceof HTMLInputElement||event.target instanceof HTMLTextAreaElement)return;const key=event.key.toLowerCase();if(['f','j','l','arrowleft','arrowright','arrowup','arrowdown','a','d','w','s','i','k'].includes(key)){held.add(key);inputs.tapKey(key);event.preventDefault();}};
 const keyup=(event:KeyboardEvent)=>held.delete(event.key.toLowerCase());const visibility=()=>setPaused('hidden',document.hidden);const blur=()=>setPaused('focus',true),focus=()=>setPaused('focus',false);
 window.addEventListener('keydown',keydown);window.addEventListener('keyup',keyup);window.addEventListener('blur',blur);window.addEventListener('focus',focus);document.addEventListener('visibilitychange',visibility);
 function tick(now:number){if(disposed)return;const delta=last?Math.max(0,now-last):0;last=now;const read=pads(),changed=inputs.poll(read);if(changed.joined.length||changed.left.length){syncPeople();countdown=3000;roundWait=0;accumulator=0;inputs.barrier(read);if(car)car=new DemoCarSession(documents[0]!,(timeline.snapshot.scene.id==='c-match'||timeline.snapshot.scene.id==='c-training'&&jobDone)?bestCar!:createCarSnapshot(new CarPolicy(1701),'initial'));tell(changed.left.length?'Een controller is los. Voorbeeldspel neemt die plek over; druk op A om opnieuw mee te doen.':'Nieuwe spelers doen mee. We starten samen opnieuw.');}
  const s=timeline.snapshot,canRun=!operatorPaused&&!document.hidden&&document.hasFocus();
  if(fault){if(canRun){faultMs+=delta;if(faultMs>=8000)restart();}}
  else{
   if(hold&&readyToLeave()){hold=false;timeline.resume('learning');}
   if(!s.paused&&s.remainingMs<=delta&&!readyToLeave()){timeline.advance(Math.max(0,s.remainingMs-1));timeline.pause('learning');hold=true;}
   else timeline.advance(delta);
   const current=timeline.snapshot;if(`${current.loop}:${current.index}`!==sceneStamp){captureExamples();void enter();}
   if((s.scene.id==='f-imitation'||s.scene.id==='f-training'||s.scene.id==='c-training')&&canRun){jobMs+=delta;if(jobMs>100000&&!readyToLeave())fail(new Error('Deze computer heeft langer nodig; we proberen een nieuwe ronde.'));}
   if(!timeline.snapshot.paused){
    if(countdown>0){countdown=Math.max(0,countdown-delta);inputs.barrier(read);}else if(roundWait>0){inputs.barrier(read);roundWait=Math.max(0,roundWait-delta);if(roundWait===0)newRound();}
    else{const clock=advanceDemoInputs(inputs,Math.min(delta,100),accumulator,actions=>{bird?.step(actions);car?.step(people(),inputs.carControls(held,read));if(flock){if(flock.done)flock=new FlappyFlock(learned!,12,2005,5000+round++);else flock.step();}});accumulator=clock.accumulatorMs;if(bird?.finished||car?.finished)roundWait=2500;}
   }
  }
  paint();const current=timeline.snapshot;q('.demo-progress span').style.width=`${current.fraction*100}%`;q('.demo-progress').setAttribute('aria-valuenow',String(Math.round(current.fraction*100)));q('.demo-time').textContent=hold?'Computer oefent…':clockText(current.remainingMs);frame=requestAnimationFrame(tick);
 }
 await enter();if(document.hidden)setPaused('hidden',true);if(!document.hasFocus())setPaused('focus',true);frame=requestAnimationFrame(tick);
 return{dispose(){disposed=true;epoch++;cancelAnimationFrame(frame);training.dispose();dropScene();fullscreen.dispose();window.removeEventListener('keydown',keydown);window.removeEventListener('keyup',keyup);window.removeEventListener('blur',blur);window.removeEventListener('focus',focus);document.removeEventListener('visibilitychange',visibility);root.replaceChildren();}};
}
