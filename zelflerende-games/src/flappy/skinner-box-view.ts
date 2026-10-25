import { advanceSkinnerBox, createSkinnerBoxState, type SkinnerBoxState, type SkinnerStep } from './skinner-box-model.ts';
import '../styles/skinner-box.css';

const copy: Readonly<Record<SkinnerStep, { title: string; text: string; bird: string }>> = {
  observe: { title: '1. Waarnemen', text: 'De vogel staat in een kamer met een hendel en een schaaltje voor voer.', bird: 'translate(0 0)' },
  action: { title: '2. Actie', text: 'De vogel drukt op de hendel.', bird: 'translate(85 -92)' },
  feedback: { title: '3. Gevolg', text: 'Er valt voer in het schaaltje. +1 stelt de beloning voor in onze tekening.', bird: 'translate(60 6)' },
  next: { title: '4. Opnieuw', text: 'Een beloning kan dit gedrag versterken. Deze tekening herhaalt een vaste reeks; ze leert zelf niets.', bird: 'translate(12 5)' },
};

const svg = (birdAsset: string) => `<svg class="sb__drawing" viewBox="0 0 900 540" aria-hidden="true" focusable="false">
 <defs><pattern id="sb-paper" width="12" height="12" patternUnits="userSpaceOnUse"><path d="M1 3h1M8 9h1" stroke="#887f71" stroke-width="1" opacity=".16"/></pattern></defs>
 <path class="sb__chamber-shadow" d="m150 354 300-162 311 161-303 168z"/>
 <path class="sb__side" d="M170 330 450 180V50L170 200z"/>
 <path class="sb__back" d="M450 180 730 330V200L450 50z"/>
 <path class="sb__floor" d="m170 330 280-150 280 150-280 150z"/>
 <path class="sb__cutaway" d="m170 330 280-150 280 150-280 150z"/>
 <path class="sb__wire" d="M170 200v130l280 150 280-150V200L450 50z M450 50v130 M170 330l280-150 280 150"/>
 <path class="sb__floor-grid" d="m240 368 280-150m-210 188 280-150m-210 188 280-150M240 292l280 150M310 255l280 150M380 217l280 150"/>
 <g class="sb__hopper"><path d="m585 167 42-23 54 29-42 23z"/><path d="m585 167 54 29v63l-54-29z"/><path d="m639 196 42-23v63l-42 23z"/><path d="m606 186 24 13v32l-24-13z"/></g>
 <path class="sb__tray" d="m584 326 58-31 57 30-58 32z"/><path class="sb__tray-front" d="m584 326 57 31 58-32v15l-58 31-57-30z"/>
 <g class="sb__food"><ellipse cx="629" cy="324" rx="7" ry="4"/><ellipse cx="645" cy="329" rx="7" ry="4"/></g>
 <path class="sb__lever-base" d="m494 277 24-13 26 14-24 13z"/>
 <g class="sb__lever-arm"><path class="sb__lever" d="m518 275 0-45 21-12"/><ellipse class="sb__lever-knob" cx="539" cy="218" rx="14" ry="7"/></g>
 <ellipse class="sb__bird-shadow" cx="429" cy="343" rx="37" ry="12"/>
 <g class="sb__bird" transform="translate(0 0)"><image href="${birdAsset}" x="388" y="285" width="82" height="58" preserveAspectRatio="xMidYMid meet"/></g>
 <path class="sb__leader" d="M157 140h110l78 44M735 130h-48l-49 48M754 376h-37l-54-34M548 107v66l-9 35M134 420h165l92-81"/>
 <g class="sb__labels"><text x="156" y="127">KAMER</text><text x="726" y="117" text-anchor="end">VOERAUTOMAAT</text><text x="756" y="402" text-anchor="end">SCHAALTJE</text><text x="548" y="94" text-anchor="middle">HENDEL</text><text x="135" y="445">ONZE VOGEL</text></g>
 <g class="sb__reward" transform="translate(655 260)" hidden><rect x="0" y="0" width="68" height="34" rx="6"/><text x="34" y="23" text-anchor="middle">+1</text></g>
 </svg>`;

/** Mounts an illustrative Skinner-box loop. All controls affect the drawing only. */
export function mountSkinnerBox(root: HTMLElement): { dispose(): void } {
  const doc = root.ownerDocument;
  let state: SkinnerBoxState = createSkinnerBoxState();
  let playing = false;
  let disposed = false;
  let timer: number | undefined;
  const base = (import.meta as ImportMeta & { env?: { BASE_URL?: string } }).env?.BASE_URL ?? '/';
  const birdAsset = `${base}assets/flappy/redbird-midflap.png`;
  root.innerHTML = `<section class="skinner-box" aria-labelledby="sb-title">
    <header class="sb__header"><p class="sb__eyebrow">Bekijk het stap voor stap</p><h3 id="sb-title">Een Skinnerbox, met onze vogel.</h3><p>Laat de tekening lopen of ga zelf naar de volgende stap.</p></header>
    <figure class="sb__figure"><div class="sb__stage">${svg(birdAsset)}</div><div class="sb__key" role="group" aria-label="Bekijk een onderdeel"><button type="button" data-part="lever" aria-pressed="true">Hendel</button><button type="button" data-part="hopper" aria-pressed="false">Voerautomaat</button><button type="button" data-part="tray" aria-pressed="false">Schaaltje</button></div><figcaption class="sb__caption">Druk op de hendel: de voerautomaat geeft voer.</figcaption></figure>
    <div class="sb__readout" role="status" aria-live="polite" aria-atomic="true"><div><span class="sb__label">STAP</span><h3 class="sb__step-title"></h3></div><p class="sb__step-copy"></p><p class="sb__counter">Totaal in de tekening: <strong class="sb__total">0</strong></p></div>
    <div class="sb__controls" aria-label="Bediening van de illustratie"><button class="secondary sb__play" type="button">Afspelen</button><button class="secondary sb__next" type="button">Volgende stap</button><button class="secondary sb__reset" type="button">Opnieuw</button></div>
  </section>`;
  const view = root.querySelector<HTMLElement>('.skinner-box')!;
  const partButtons=[...view.querySelectorAll<HTMLButtonElement>('[data-part]')];view.dataset.part='lever';
  for(const button of partButtons)button.onclick=()=>{view.dataset.part=button.dataset.part;for(const b of partButtons)b.setAttribute('aria-pressed',String(b===button));};
  const title = view.querySelector<HTMLElement>('.sb__step-title')!;
  const text = view.querySelector<HTMLElement>('.sb__step-copy')!;
  const total = view.querySelector<HTMLElement>('.sb__total')!;
  const playButton = view.querySelector<HTMLButtonElement>('.sb__play')!;
  const nextButton = view.querySelector<HTMLButtonElement>('.sb__next')!;
  const resetButton = view.querySelector<HTMLButtonElement>('.sb__reset')!;
  const bird = view.querySelector<SVGGElement>('.sb__bird')!;
  const reward = view.querySelector<SVGGElement>('.sb__reward')!;

  const stop = (): void => { if (timer !== undefined) doc.defaultView?.clearInterval(timer); timer = undefined; playing = false; };
  const render = (): void => {
    const current = copy[state.step];
    title.textContent = current.title;
    text.textContent = current.text;
    total.textContent = String(state.illustrativeRewards);
    bird.setAttribute('transform', current.bird);
    reward.toggleAttribute('hidden', state.step !== 'feedback');
    playButton.textContent = playing ? 'Pauzeren' : 'Afspelen';
    playButton.setAttribute('aria-pressed', String(playing));
    view.dataset.step = state.step;
  };
  const advance = (): void => { if (disposed) return; state = advanceSkinnerBox(state); render(); };
  const onPlay = (): void => {
    if (playing) { stop(); render(); return; }
    if (doc.hidden) return;
    playing = true; render();
    timer = doc.defaultView?.setInterval(advance, 1900);
  };
  const onVisibility = (): void => { if (doc.hidden && playing) { stop(); render(); } };
  const onNext = (): void => { stop(); advance(); };
  const onReset = (): void => { stop(); state = createSkinnerBoxState(); render(); };
  playButton.addEventListener('click', onPlay);
  nextButton.addEventListener('click', onNext);
  resetButton.addEventListener('click', onReset);
  doc.addEventListener('visibilitychange', onVisibility);
  render();
  return { dispose() {
    if (disposed) return;
    disposed = true; stop();for(const b of partButtons)b.onclick=null;
    playButton.removeEventListener('click', onPlay);
    nextButton.removeEventListener('click', onNext);
    resetButton.removeEventListener('click', onReset);
    doc.removeEventListener('visibilitychange', onVisibility);
    root.replaceChildren();
  } };
}
