import content from '../content/landing.nl.json';
import '../styles/landing.css';
const esc=(text:string)=>text.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
const trackPreview=()=>`<svg viewBox="0 0 260 230" aria-hidden="true">
 <rect x="31" y="32" width="198" height="166" rx="38" fill="none" stroke="#625B70" stroke-width="30"/>
 <rect x="31" y="32" width="198" height="166" rx="38" fill="none" stroke="#E2DDEA" stroke-width="1.5" stroke-dasharray="6 7"/>
 <path d="M76 17h16v30H76z" fill="white"/><path d="M76 17h8v8h-8zm8 8h8v8h-8zm-8 8h8v7h-8zm8 7h8v7h-8" fill="#160033"/>
 <g stroke="#3DFFD0" stroke-width="1.4" opacity=".9"><path d="M128 32l38-12m-38 12h43m-43 0 38 12"/></g>
 ${[[117,32,0,1],[172,32,0,.7],[229,104,90,.65],[173,198,180,.7],[76,198,180,.5],[31,103,-90,.45]].map(([x,y,angle,opacity])=>`<g transform="translate(${x} ${y}) rotate(${angle})" opacity="${opacity}"><rect x="-12" y="-7" width="24" height="14" rx="3" fill="#5200FF" stroke="white" stroke-width="1.2"/><rect x="3" y="-5" width="5" height="10" rx="1" fill="#E2DDEA"/><path d="M-7-5v10" stroke="#3700B3" stroke-width="2"/></g>`).join('')}
 </svg>`;
const birdPreview=()=>`<div class="lp-bird-scene" aria-hidden="true"><span class="lp-pipe lp-pipe-top"></span><span class="lp-pipe lp-pipe-bottom"></span>${['redbird-downflap.png','redbird-midflap.png','redbird-upflap.png'].map((sprite,index)=>`<img class="lp-bird lp-bird-${index}" src="${import.meta.env.BASE_URL}assets/flappy/${sprite}" width="68" height="48" alt=""/>`).join('')}<span class="lp-ground"></span></div>`;
export function mountLandingView(root:HTMLElement,options:{onChoose:(game:'flappy'|'car')=>void;onStart:()=>void}){
 root.innerHTML=`<div class="landing-page">
 <a class="lp-skip" href="#landing-main">Spring naar de inhoud</a>
 <header class="lp-header"><nav class="lp-nav" aria-label="Hoofdnavigatie">
 <a class="lp-brand" href="#top"><strong>Zelflerend in de Klas</strong><span>AI in de Klas · Robbe Wulgaert</span></a>
 <button type="button" class="lp-menu" aria-expanded="false" aria-controls="landing-links" aria-label="Open navigatiemenu"><span aria-hidden="true">☰</span></button>
 <div class="lp-nav-panel" id="landing-links"><div class="lp-nav-links"><a href="#spellen">De spellen</a><a href="#leerlijn">Leerlijn</a><a href="#leerkrachten">Leerkrachten</a></div><a class="lp-button lp-primary" href="?view=flappy&amp;step=play" data-game="flappy">Begin met Flappy Bird</a></div>
 </nav></header>
 <main id="landing-main" tabindex="-1">
 <section class="lp-section lp-hero" id="top" aria-labelledby="landing-title"><div class="lp-hero-copy"><p class="lp-kicker">Zelflerend in de Klas</p><h1 id="landing-title">${content.titleLines.map(line=>`<span>${esc(line)}</span>`).join(' ')}</h1><p>${esc(content.intro)}</p><div class="lp-actions"><a class="lp-button lp-primary" href="?view=flappy&amp;step=play" data-game="flappy">Begin met Flappy Bird</a><a class="lp-button lp-secondary" href="?view=car&amp;step=play" data-game="car">Verken de raceauto</a></div></div>
 <figure class="lp-preview" aria-label="Flappy Bird en raceauto"><div class="lp-window"><div class="lp-window-bar"><span class="lp-window-dots" aria-hidden="true"><i></i><i></i><i></i></span><span>Flappy Bird · Raceauto</span></div><div class="lp-window-games">${birdPreview()}<div class="lp-track-scene">${trackPreview()}</div></div><div class="lp-preview-route"><span>Voorbeelden</span><span>Beloningen</span><span>Generaties</span></div></div></figure></section>
 <section class="lp-section lp-game-section" id="spellen" aria-labelledby="games-title"><p class="lp-kicker">Twee spellen</p><h2 id="games-title">Van één knop naar een eigen circuit.</h2><div class="lp-game-cards">${content.games.map(game=>`<article class="lp-card lp-game-card"><div class="lp-game-art">${game.id==='flappy'?birdPreview():`<div class="lp-track-scene">${trackPreview()}</div>`}</div><div class="lp-game-copy">${game.id==='flappy'?'<span class="lp-small-note">Begin hier</span>':''}<h3>${esc(game.title)}</h3><p>${esc(game.body)}</p><a href="?view=${game.id}&amp;step=play" class="lp-button ${game.id==='flappy'?'lp-primary':'lp-secondary'}" data-game="${game.id}">${game.id==='flappy'?'Begin met Flappy Bird':'Verken de raceauto'}</a></div></article>`).join('')}</div></section>
 <section class="lp-section" id="leerlijn" aria-labelledby="path-title"><span id="werking" class="lp-anchor" aria-hidden="true"></span><p class="lp-kicker">De leerlijn</p><h2 id="path-title">Van jouw voorbeelden naar nieuwe generaties.</h2><ol class="lp-path">${content.path.map((step,index)=>`<li><span class="lp-step-number">0${index+1} · ${esc(step.game)}</span><h3>${esc(step.title)}</h3><p>${esc(step.body)}</p></li>`).join('')}</ol></section>
 <section class="lp-section" id="leerkrachten" aria-labelledby="teacher-title"><div class="lp-teacher-grid"><article class="lp-card"><p class="lp-kicker">Voor leerkrachten</p><h2 id="teacher-title">Praktisch voor in de klas.</h2><p class="lp-lede">${esc(content.teacher.intro)}</p><ul class="lp-teacher-points">${content.teacher.points.map(point=>`<li>${esc(point)}</li>`).join('')}</ul></article><aside class="lp-classroom"><h3>In de klas</h3><p>${esc(content.teacher.classroom)}</p><p>De leskaarten geven een paar vragen om mee te beginnen. Je kunt ze ook afdrukken.</p><div class="lp-actions"><a class="lp-button lp-primary" href="${import.meta.env.BASE_URL}leskaarten.html">Open leskaarten</a><a class="lp-button lp-secondary" href="?view=games" data-start>Start leerplatform</a></div></aside></div></section>
 <section class="lp-section lp-literacy" id="ai-geletterdheid" aria-labelledby="literacy-title"><p class="lp-kicker">AI-geletterdheid</p><h2 id="literacy-title">${esc(content.literacy.title)}</h2><p class="lp-lede">${esc(content.literacy.intro)}</p><ul class="lp-literacy-goals">${content.literacy.goals.map(goal=>`<li><h3>${esc(goal.title)}</h3><p>${esc(goal.body)}</p><span class="lp-goal-reference">${esc(goal.competences)}</span></li>`).join('')}</ul><a class="lp-framework-source" href="${esc(content.literacy.sourceUrl)}" target="_blank" rel="noopener">${esc(content.literacy.sourceLabel)}</a></section>
 <section class="lp-section lp-last-section" aria-labelledby="closing-title"><div class="lp-closing"><h2 id="closing-title">${esc(content.closing.title)}</h2><a class="lp-button lp-light" href="?view=flappy&amp;step=play" data-game="flappy">Begin met Flappy Bird</a></div></section>
 </main><footer class="lp-footer"><div><strong>Zelflerend in de Klas</strong><p>Robbe Wulgaert · AI in de Klas<br>© 2026 Robbe Wulgaert</p></div><nav aria-label="Meer informatie"><a href="#leerkrachten">Voor leerkrachten</a><a href="${import.meta.env.BASE_URL}credits.json">Bronnen en credits</a><a href="https://www.aiindeklas.be" target="_blank" rel="noopener">AI in de Klas</a><a href="https://www.robbewulgaert.be" target="_blank" rel="noopener">robbewulgaert.be</a></nav></footer></div>`;
 const menu=root.querySelector<HTMLButtonElement>('.lp-menu')!,panel=root.querySelector<HTMLElement>('.lp-nav-panel')!;
 const close=(returnFocus=false)=>{panel.classList.remove('is-open');menu.setAttribute('aria-expanded','false');menu.setAttribute('aria-label','Open navigatiemenu');if(returnFocus)menu.focus();};
 const toggle=()=>{const open=menu.getAttribute('aria-expanded')!=='true';panel.classList.toggle('is-open',open);menu.setAttribute('aria-expanded',String(open));menu.setAttribute('aria-label',open?'Sluit navigatiemenu':'Open navigatiemenu');};
 menu.addEventListener('click',toggle);
 const key=(e:KeyboardEvent)=>{if(e.key==='Escape'&&menu.getAttribute('aria-expanded')==='true'){e.preventDefault();close(true);}};
 const outside=(e:MouseEvent)=>{if(e.target instanceof Node&&!menu.contains(e.target)&&!panel.contains(e.target))close();};
 const resize=()=>{if(innerWidth>900)close();};
 document.addEventListener('keydown',key);document.addEventListener('click',outside);window.addEventListener('resize',resize);
 for(const link of root.querySelectorAll<HTMLAnchorElement>('a'))link.addEventListener('click',event=>{
  if(event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;
  if(link.hasAttribute('data-start')){event.preventDefault();options.onStart();window.scrollTo({top:0,behavior:'instant'});}
  else if(link.dataset.game){event.preventDefault();options.onChoose(link.dataset.game as 'flappy'|'car');window.scrollTo({top:0,behavior:'instant'});}
  else if(link.getAttribute('href')?.startsWith('#'))close();
 });
 // Native anchor restoration occurs before an asynchronously mounted page is ready.
 const hash=location.hash;if(hash){const target=root.querySelector<HTMLElement>(`[id="${CSS.escape(hash.slice(1))}"]`);target?.scrollIntoView({block:'start'});}
 return{dispose(){document.removeEventListener('keydown',key);document.removeEventListener('click',outside);window.removeEventListener('resize',resize);root.replaceChildren();}};
}
