import content from '../content/landing.nl.json';
import curriculum from '../content/curriculum.json';
import translations from '../content/landing.en.json';
import seo from '../content/seo.generated.json';
const esc=(text:string)=>text.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
const trackPreview=()=>`<svg viewBox="0 0 260 230" aria-hidden="true">
 <rect x="31" y="32" width="198" height="166" rx="38" fill="none" stroke="#625B70" stroke-width="30"/>
 <rect x="31" y="32" width="198" height="166" rx="38" fill="none" stroke="#E2DDEA" stroke-width="1.5" stroke-dasharray="6 7"/>
 <path d="M76 17h16v30H76z" fill="white"/><path d="M76 17h8v8h-8zm8 8h8v8h-8zm-8 8h8v7h-8zm8 7h8v7h-8" fill="#160033"/>
 <g stroke="#3DFFD0" stroke-width="1.4" opacity=".9"><path d="M128 32l38-12m-38 12h43m-43 0 38 12"/></g>
 ${[[117,32,0,1],[172,32,0,.7],[229,104,90,.65],[173,198,180,.7],[76,198,180,.5],[31,103,-90,.45]].map(([x,y,angle,opacity])=>`<g transform="translate(${x} ${y}) rotate(${angle})" opacity="${opacity}"><rect x="-12" y="-7" width="24" height="14" rx="3" fill="#5200FF" stroke="white" stroke-width="1.2"/><rect x="3" y="-5" width="5" height="10" rx="1" fill="#E2DDEA"/><path d="M-7-5v10" stroke="#3700B3" stroke-width="2"/></g>`).join('')}
 </svg>`;
const birdPreview=(baseUrl:string)=>`<div class="lp-bird-scene" aria-hidden="true"><span class="lp-pipe lp-pipe-top"></span><span class="lp-pipe lp-pipe-bottom"></span>${['redbird-downflap.png','redbird-midflap.png','redbird-upflap.png'].map((sprite,index)=>`<img class="lp-bird lp-bird-${index}" src="${baseUrl}assets/flappy/${sprite}" width="68" height="48" alt=""/>`).join('')}<span class="lp-ground"></span></div>`;
type TreeNode = (typeof curriculum.platforms)[number];
const treeNode=(node:TreeNode)=>`<a class="lp-tree-node ${node.id==='games'?'current':''} ${node.id==='dodona'?'dodona':''}" href="${esc(node.href)}" target="_blank" rel="noopener" ${node.id==='games'?'aria-current="page"':''}><strong>${esc(node.title.nl)}</strong><span>${esc(node.description.nl)}</span></a>`;
export type LandingLocale = 'nl'|'en';
export function landingLocale(pathname:string):LandingLocale { return pathname.endsWith('/en.html')?'en':'nl'; }
export function renderLandingMarkup(locale:LandingLocale,baseUrl:string):string {
 let markup=`<div class="landing-page">
 <a class="lp-skip" href="#landing-main">Spring naar de inhoud</a>
 <header class="lp-header"><nav class="lp-nav" aria-label="Hoofdnavigatie">
 <a class="lp-brand" href="#top"><strong>Zelflerende games</strong><span>AI in de Klas · Robbe Wulgaert</span></a>
 <div class="lp-language" role="group" aria-label="Taalkeuze"><a href="./" data-language-choice="nl" ${locale==='nl'?'aria-current="page"':''}>NL</a><a href="en.html" data-language-choice="en" ${locale==='en'?'aria-current="page"':''}>ENG</a></div><button type="button" class="lp-menu" aria-expanded="false" aria-controls="landing-links" aria-label="Open navigatiemenu"><span aria-hidden="true">☰</span></button>
 <div class="lp-nav-panel" id="landing-links"><div class="lp-nav-links"><a href="#spellen">De spellen</a><a href="#leerlijn">Leerlijn</a><a href="#groeipad">Platformen en projecten</a><a href="#leerkrachten">Leerkrachten</a></div><a class="lp-button lp-primary" href="?view=flappy&amp;step=play" data-game="flappy">Begin met Flappy Bird</a></div>
 </nav></header>
 <main id="landing-main" tabindex="-1">
 <section class="lp-section lp-hero" id="top" aria-labelledby="landing-title"><div class="lp-hero-copy"><p class="lp-kicker">Zelflerende games</p><h1 id="landing-title">${content.titleLines.map(line=>`<span>${esc(line)}</span>`).join(' ')}</h1><p>${esc(seo.locales.nl.definition)}</p><dl class="lp-facts">${seo.locales.nl.facts.map(f=>`<div><dt>${esc(f.label)}</dt><dd>${esc(f.value)}</dd></div>`).join('')}</dl><div class="lp-actions"><a class="lp-button lp-primary" href="?view=flappy&amp;step=play" data-game="flappy">Begin met Flappy Bird</a><a class="lp-button lp-secondary" href="?view=car&amp;step=play" data-game="car">Verken de raceauto</a></div></div>
 <figure class="lp-preview" aria-label="Flappy Bird en raceauto"><div class="lp-window"><div class="lp-window-bar"><span class="lp-window-dots" aria-hidden="true"><i></i><i></i><i></i></span><span>Flappy Bird · Raceauto</span></div><div class="lp-window-games">${birdPreview(baseUrl)}<div class="lp-track-scene">${trackPreview()}</div></div><div class="lp-preview-route"><span>Voorbeelden</span><span>Beloningen</span><span>Generaties</span></div></div></figure></section>
 <section class="lp-section lp-game-section" id="spellen" aria-labelledby="games-title"><p class="lp-kicker">Twee spellen</p><h2 id="games-title">Van één knop naar een eigen circuit.</h2><div class="lp-game-cards">${content.games.map(game=>`<article class="lp-card lp-game-card"><div class="lp-game-art">${game.id==='flappy'?birdPreview(baseUrl):`<div class="lp-track-scene">${trackPreview()}</div>`}</div><div class="lp-game-copy">${game.id==='flappy'?'<span class="lp-small-note">Begin hier</span>':''}<h3>${esc(game.title)}</h3><p>${esc(game.body)}</p><a href="?view=${game.id}&amp;step=play" class="lp-button ${game.id==='flappy'?'lp-primary':'lp-secondary'}" data-game="${game.id}">${game.id==='flappy'?'Begin met Flappy Bird':'Verken de raceauto'}</a></div></article>`).join('')}</div></section>
 <section class="lp-section" id="leerlijn" aria-labelledby="path-title"><span id="werking" class="lp-anchor" aria-hidden="true"></span><p class="lp-kicker">De leerlijn</p><h2 id="path-title">Van jouw voorbeelden naar nieuwe generaties.</h2><ol class="lp-path">${content.path.map((step,index)=>`<li><span class="lp-step-number">0${index+1} · ${esc(step.game)}</span><h3>${esc(step.title)}</h3><p>${esc(step.body)}</p></li>`).join('')}</ol></section>
 <section class="lp-section" id="leerkrachten" aria-labelledby="teacher-title"><div class="lp-teacher-grid"><article class="lp-card"><p class="lp-kicker">Voor leerkrachten</p><h2 id="teacher-title">Praktisch voor in de klas.</h2><p class="lp-lede">${esc(content.teacher.intro)}</p><ul class="lp-teacher-points">${content.teacher.points.map(point=>`<li>${esc(point)}</li>`).join('')}</ul></article><aside class="lp-classroom"><h3>In de klas</h3><p>${esc(content.teacher.classroom)}</p><p>De leskaarten geven een paar vragen om mee te beginnen. Je kunt ze ook afdrukken.</p><div class="lp-actions"><a class="lp-button lp-primary" href="${baseUrl}leskaarten.html">Open leskaarten</a><a class="lp-button lp-secondary" href="?view=games" data-start>Start leerplatform</a></div></aside></div></section>
 <section class="lp-section lp-literacy" id="ai-geletterdheid" aria-labelledby="literacy-title"><p class="lp-kicker">AI-geletterdheid</p><h2 id="literacy-title">${esc(content.literacy.title)}</h2><p class="lp-lede">${esc(content.literacy.intro)}</p><ul class="lp-literacy-goals">${content.literacy.goals.map(goal=>`<li><h3>${esc(goal.title)}</h3><p>${esc(goal.body)}</p><span class="lp-goal-reference">${esc(goal.competences)}</span></li>`).join('')}</ul><a class="lp-framework-source" href="${esc(content.literacy.sourceUrl)}" target="_blank" rel="noopener">${esc(content.literacy.sourceLabel)}</a></section>
    <section class="lp-section lp-curriculum" id="groeipad" aria-labelledby="curriculum-title">
      <p class="lp-kicker">${esc(curriculum.section.kicker.nl)}</p><h2 id="curriculum-title">${esc(curriculum.section.title.nl)}</h2><p class="lp-lede">${esc(curriculum.section.intro.nl)}</p>
      <div class="lp-family-tree" aria-label="${esc(curriculum.section.ariaLabel.nl)}"><div class="lp-tree-root"><a class="lp-tree-node root" href="${esc(curriculum.root.href)}" target="_blank" rel="noopener"><strong>${esc(curriculum.root.title.nl)}</strong><span>${esc(curriculum.root.description.nl)}</span></a></div>
      <div class="lp-tree-branches"><div class="lp-tree-branch"><div class="lp-branch-title">${esc(curriculum.labels.platforms.nl)}</div><div class="lp-tree-stack">${curriculum.platforms.slice(0,3).map(node=>treeNode(node)).join('')}<div class="lp-delphi-dodona-pair" aria-label="${esc(curriculum.labels.dodonaPair.nl)}">${curriculum.platforms.slice(3).map(node=>treeNode(node)).join('')}</div></div></div>
      <div class="lp-tree-branch"><div class="lp-branch-title">${esc(curriculum.labels.projects.nl)}</div><div class="lp-tree-stack">${curriculum.projects.map(node=>treeNode(node)).join('')}</div></div></div></div>
    </section>

 <section class="lp-section" id="privacy-license" aria-labelledby="privacy-license-title">
  <h2 id="privacy-license-title">Privacy en licentie</h2>
  <div class="lp-privacy-list">
   <details class="lp-card lp-privacy-details">
    <summary>Privacy</summary>
    <div class="lp-privacy-content">
     <p>De spellen en het trainen van modellen gebeuren in je browser. Je voorbeelden, modellen, antwoorden en resultaten worden lokaal op dit toestel bewaard zolang browseropslag beschikbaar is. Ze worden niet naar een eigen server gestuurd. Een bestand importeren of exporteren doe je zelf via het platform. Dit project gebruikt geen eigen analytics of advertentiecookies.</p>
     <p>Gebruik je een gedeeld toestel? Exporteer je werk als je het wilt bewaren en verwijder daarna je experiment via Mijn experiment. Bij gewiste of onbeschikbare browseropslag kan lokaal werk verloren gaan.</p>
     <p>GitHub Pages registreert het IP-adres van bezoekers voor beveiligingsdoeleinden. Open je een externe link, dan geldt het privacybeleid van die aanbieder.</p>
     <p><a href="https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages#data-collection" target="_blank" rel="noopener">Lees hoe GitHub Pages technische bezoekgegevens verwerkt.</a></p>
    </div>
   </details>
   <details class="lp-card lp-privacy-details">
    <summary>Licentie</summary>
    <div class="lp-privacy-content">
     <p>Het oorspronkelijke projectmateriaal van Robbe Wulgaert mag gratis worden gebruikt, gekopieerd en aangepast voor onderwijs, op voorwaarde dat “Robbe Wulgaert – AI in de Klas” duidelijk zichtbaar wordt vermeld, waar redelijkerwijs mogelijk met een link naar het oorspronkelijke project. Commerciële verkoop, betaalde verspreiding, sublicentiëring of herverpakking als commercieel product is niet toegestaan zonder voorafgaande schriftelijke toestemming. Voor ander gebruik buiten onderwijs is ook voorafgaande schriftelijke toestemming nodig. Componenten van derden blijven onder hun eigen licenties vallen.</p>
     <p><a href="${baseUrl}LICENSE.md">Lees de volledige licentievoorwaarden.</a> <a href="${baseUrl}credits.json">Bekijk bronnen en credits.</a> <a href="${baseUrl}licenses/flappy-source-MIT.txt">Lees de meegeleverde softwarelicentie.</a></p>
    </div>
   </details>
  </div>
 </section>
 <section class="lp-section lp-last-section" aria-labelledby="closing-title"><div class="lp-closing"><h2 id="closing-title">${esc(content.closing.title)}</h2><a class="lp-button lp-light" href="?view=flappy&amp;step=play" data-game="flappy">Begin met Flappy Bird</a></div></section>
 </main><footer class="lp-footer"><div><strong>Zelflerende games</strong><p>Robbe Wulgaert · AI in de Klas<br>© 2026 Robbe Wulgaert</p></div><nav aria-label="Meer informatie"><a href="#privacy-license">Privacy en licentie</a><a href="#leerkrachten">Voor leerkrachten</a><a href="${baseUrl}credits.json">Bronnen en credits</a><a href="https://www.aiindeklas.be" target="_blank" rel="noopener">AI in de Klas</a><a href="https://www.robbewulgaert.be" target="_blank" rel="noopener">robbewulgaert.be</a></nav></footer></div>`;
 if(locale==='en'){
  const dictionary:Record<string,string>={...translations};
  const addPairs=(value:unknown)=>{if(!value||typeof value!=='object')return;const obj=value as Record<string,unknown>;if(typeof obj.nl==='string'&&typeof obj.en==='string')dictionary[obj.nl]=obj.en;else Object.values(obj).forEach(addPairs);};
  addPairs(curriculum);
  dictionary[seo.locales.nl.definition]=seo.locales.en.definition;
  seo.locales.nl.facts.forEach((f,i)=>{dictionary[f.label]=seo.locales.en.facts[i].label;dictionary[f.value]=seo.locales.en.facts[i].value;});
  markup=markup.replace(/>([^<>]+)</g,(_match,text:string)=>{const trimmed=text.trim();const translated=dictionary[trimmed]??(/^0[1-9] · Raceauto$/.test(trimmed)?trimmed.replace('Raceauto','Racing car'):undefined);return `>${translated?text.replace(trimmed,esc(translated)) : text}<`;});
  markup=markup.replace(/aria-label="([^"]*)"/g,(match,value:string)=>dictionary[value]?`aria-label="${esc(dictionary[value])}"`:match);
 }
 return markup;
}
