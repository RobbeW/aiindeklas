import {createRewardAttempt} from './schematic-data.ts';
import {gameSnapshot,money} from './schematic-elements.ts';
import '../styles/extended-schematics.css';
export function mountRewardExplainer(root:HTMLElement){
 const attempt=createRewardAttempt(),reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;let index=reduced?205:0,timer:ReturnType<typeof setInterval>|undefined;
 root.innerHTML='<section class="se-explainer reward-explainer"><h2>Zo telt de beloning op</h2><div class="reward-rules"><p><strong>Blijven vliegen: +0,01 per spelstap</strong><br>Het spel zet 60 stappen per seconde. Eén seconde vliegen levert dus 60 × 0,01 = 0,60 op.</p><p><strong>Een opening voorbij: +1 extra</strong></p><p><strong>Botsing: −1</strong><br>De poging stopt. Op die laatste stap vervalt de vliegbonus.</p></div><div class="reward-live"></div><p class="reward-formula"></p><p class="reward-totals"></p></section>';
 const render=()=>{const m=attempt.frames[index]!,flying=m.step-(m.event==='collision'?1:0);root.querySelector('.reward-live')!.innerHTML=gameSnapshot(m.world);root.querySelector('.reward-formula')!.textContent=`${flying} stappen × 0,01 + ${m.score} ${m.event==='collision'?'− 1 ':''}= ${money(m.total)}`;root.querySelector('.reward-totals')!.textContent=`Spelscore: ${m.score} · Trainingsbeloning: ${money(m.total)}`;};
 const stop=()=>{if(timer)clearInterval(timer);timer=undefined;};
 const start=()=>{stop();if(!document.hidden&&!reduced)timer=setInterval(()=>{index=index>=attempt.frames.length-1?0:Math.min(attempt.frames.length-1,index+3);render();},50);};
 const visibility=()=>{if(document.hidden)stop();else start();};document.addEventListener('visibilitychange',visibility);render();start();
 return{dispose(){stop();document.removeEventListener('visibilitychange',visibility);root.replaceChildren();}};
}
