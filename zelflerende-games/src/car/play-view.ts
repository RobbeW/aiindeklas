import type { CircuitDocument } from '../tracks/document.ts';
import { CarEnvironment,type CarEpisodeResult } from './environment.ts';
import type { CarAction } from './config.ts';
import type { CarControl } from './physics.ts';
import type { EnvironmentStep } from '../core/contracts.ts';
import { advanceFixedFrame } from '../core/fixed-step.ts';
import { mountVehicleChoice } from './vehicle-art.ts';
import { createCarRenderer } from './renderer.ts';import { createCarInput } from '../input/car-input.ts';
import { readGamepad } from '../input/gamepad.ts';import { updateInputStatus } from '../input/input-status-view.ts';
export interface CarPlayOptions {
  readonly document:CircuitDocument;readonly getSeed?:()=>number;readonly humanSpeedControl?:boolean;
  readonly controller?:(observation:readonly number[])=>CarAction;readonly controllerLabel?:string;readonly controllerMode?:'policy'|'replay';
  readonly onEpisodeStart?:(seed:number)=>void;
  readonly onStep?:(observation:readonly number[],action:CarAction,transition:EnvironmentStep<CarEpisodeResult>)=>void;
  readonly onEpisode?:(result:CarEpisodeResult,seed:number)=>void;
}
let nextCarViewId=0;
export function mountCarPlayView(root:HTMLElement,options:CarPlayOptions){
  if(options.controller&&!options.controllerLabel)throw new Error('Automatic controller needs an explicit source label');
  const prefix=`car-view-${++nextCarViewId}-`;
  const env=new CarEnvironment(options.document);let seed=1000;
  root.innerHTML='<section class="card car-play"><h2>Rijd één auto</h2><p id="car-mode"></p><p class="car-instructions">Stuur met ← → of A/D. Geef gas met ↑ of W en rem met ↓ of S. Controller: stuur met stick of D-pad, gas met RT en rem met LT.</p><div class="toolbar"><button id="car-start">Start rijden</button><button id="car-pause" class="secondary" disabled>Pauzeer rijden</button><button id="car-reset" class="secondary">Nieuwe poging</button><label><input id="car-sensors" type="checkbox" checked> Toon sensoren</label></div><p id="car-status" role="status" aria-live="polite"></p><p id="car-score"></p><p id="car-input-status" class="muted"></p><canvas id="car-canvas" tabindex="0" aria-label="Continu rijdende auto op het gekozen tegelcircuit"></canvas></section>';
  root.innerHTML=root.innerHTML.replaceAll('id="car-',`id="${prefix}`);
  const q=<T extends HTMLElement>(s:string)=>root.querySelector<T>(s.replaceAll('#car-',`#${prefix}`))!;
  if(options.controller)root.querySelector('h2')!.textContent='Bekijk de vaste bestuurder';
  q('#car-mode').hidden=!options.controllerLabel;
  q('#car-mode').textContent=`${options.controllerLabel??'Jij rijdt'}`;
  if(!options.controller&&options.humanSpeedControl===false)q('.car-instructions').textContent='Stuur met ← → of A/D, of gebruik een controller. De auto geeft zelf gas.';
  if(options.controller)q('.car-instructions').textContent=options.controllerMode==='replay'?'Opgenomen poging · er wordt niet geleerd.':'Vast model · er wordt niet geleerd.';
  const canvas=q<HTMLCanvasElement>('#car-canvas'),start=q<HTMLButtonElement>('#car-start'),pause=q<HTMLButtonElement>('#car-pause'),status=q('#car-status');
  canvas.style.width=`min(100%,${60*options.document.width/options.document.height}vh,800px)`;const renderer=createCarRenderer(canvas,env.route);
  let phase:'ready'|'running'|'paused'|'finished'='ready',disposed=false,raf:number|undefined,last:number|undefined,accumulator=0;
  const input=createCarInput({canvas,enabled:()=>phase==='running'&&!options.controller});
  const stop=()=>{if(raf!==undefined)cancelAnimationFrame(raf);raf=undefined;last=undefined;accumulator=0;input.reset();};
  const render=()=>{renderer.render(env.world,q<HTMLInputElement>('#car-sensors').checked,env.completedResult);q('#car-score').textContent=`${env.world.progress.laps} ronde · ${(env.world.progress.bestDistance/env.route.length*100).toFixed(1)}% route · ${(env.world.steps/60).toFixed(1)} s · snelheid ${Math.round(env.world.car.speed)} eenheden/s`;if(options.controller)q('#car-input-status').textContent='Automatische besturing.';else updateInputStatus(q('#car-input-status'),readGamepad());};
  const fresh=()=>{stop();seed=options.getSeed?.()??1000;env.reset({seed});phase='ready';options.onEpisodeStart?.(seed);start.disabled=false;start.textContent='Start rijden';pause.disabled=true;pause.textContent='Pauzeer rijden';status.textContent='Klaar voor een nieuwe poging.';render();};
  const frame=(time:number)=>{if(phase!=='running'||disposed)return;const delta=last===undefined?0:time-last;last=time;
    let observation:readonly number[]=[];
    try{const next=advanceFixedFrame(delta,accumulator,()=>{if(phase!=='running')return {action:0} as {action:CarAction;pedals?:CarControl};observation=env.getObservation();if(options.controller)return {action:options.controller(observation)};if(options.humanSpeedControl===false)return {action:input.getAction()};const control=input.getControl();return {action:control.action,pedals:control};},control=>{
      if(phase!=='running')return;const action=control.action,t=env.step(action,control.pedals);options.onStep?.(observation,action,t);
      if(t.done&&t.result){phase='finished';stop();start.disabled=true;pause.disabled=true;status.textContent=t.result.laps?'Ronde voltooid. Resultaat blijft bewaard.':t.reason==='collision'?'Botsing. Bekijk de sensoren en pas je aanpak aan.':'Tijdslimiet bereikt.';options.onEpisode?.(t.result,seed);}
    });accumulator=next.accumulatorMs;render();}catch(e){stop();phase='paused';status.textContent=e instanceof Error?e.message:String(e);start.disabled=false;}
    if(phase==='running')raf=requestAnimationFrame(frame);
  };
  const begin=()=>{if(phase==='finished'||disposed)return;phase='running';input.reset();start.disabled=true;pause.disabled=false;pause.textContent='Pauzeer rijden';status.textContent='Poging loopt.';canvas.focus({preventScroll:true});canvas.scrollIntoView({block:'center',behavior:'auto'});last=undefined;raf=requestAnimationFrame(frame);};
  const pauseRun=()=>{if(phase==='running'){phase='paused';stop();start.disabled=false;start.textContent='Hervat rijden';pause.disabled=true;status.textContent='Gepauzeerd. Hervat dezelfde poging.';}};
  start.onclick=begin;pause.onclick=pauseRun;q<HTMLButtonElement>('#car-reset').onclick=fresh;q<HTMLInputElement>('#car-sensors').onchange=render;
  window.addEventListener('blur',pauseRun);const visibility=()=>{if(document.hidden)pauseRun();};document.addEventListener('visibilitychange',visibility);
  fresh();
  const vehicleChoice=mountVehicleChoice(root.querySelector('.car-play')!,render);canvas.before(root.querySelector('.car-play')!.lastElementChild!);
  const initialPaint=requestAnimationFrame(()=>{if(!disposed)render();});
  return{getEnvironment:()=>env,dispose(){disposed=true;cancelAnimationFrame(initialPaint);stop();input.dispose();vehicleChoice.dispose();renderer.dispose();window.removeEventListener('blur',pauseRun);document.removeEventListener('visibilitychange',visibility);root.replaceChildren();}};
}
