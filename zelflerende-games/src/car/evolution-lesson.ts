import '../styles/car-evolution-lesson.css';
import {evolutionDiagramWeights,EXAMPLE_PARENTS} from './evolution-lesson-model.ts';

const colors = ['#5200FF', '#16845B', '#C05221', '#176D9C', '#A32E62', '#716000'];


function car(index: number): string {
  const distance=[8,25,11,7,21,10][index]!;
  return `<svg style="--drive-x:${40+distance}px;--drive-y:${34-distance*.6}px" viewBox="0 0 132 92" role="img" aria-label="Auto ${index + 1} op het oefencircuit">
    <path d="m7 57 55-31 62 32-57 32z" fill="#d9d1c2" stroke="#25221d" stroke-width="1.5"/>
    <path d="m7 57 60 33v-7L7 50z" fill="#b5a998" stroke="#25221d" stroke-width="1.3"/><path d="m67 83 57-32v7L67 90z" fill="#978b79" stroke="#25221d" stroke-width="1.3"/>
    <path d="m15 57 47-26 48 25-48 27z" fill="none" stroke="#8b8275" stroke-width="1" stroke-dasharray="2 3"/>
    <g class="el__car" transform="translate(40 34)">
      <path d="m2 10 5-7q1-2 4-2h10q3 0 4 3l4 6v10q0 3-3 3H5q-3 0-3-3z" fill="${colors[index]}" stroke="#25221d" stroke-width="2"/>
      <path d="m9 5 2-2h8l3 6H7z" fill="#d8d3ca" stroke="#25221d" stroke-width="1.4"/><path d="M2 12h27" stroke="#25221d" stroke-width="1.5"/>
      <circle cx="7" cy="22" r="2" fill="#25221d"/><circle cx="24" cy="22" r="2" fill="#25221d"/>
      <path class="el__sensor" d="m28 7 15-11m-13 15 20 0m-22 4 15 10"/>
    </g>
  </svg>`;
}

// Every model has the same 4-4-2 topology; line weight and dash style illustrate different weights.
function network(index: number): string {
  const weights = evolutionDiagramWeights(index);
  const inputs=[14,26,38,50],hidden=[14,26,38,50],outputs=[21,43];
  const edge=(id:number,d:string)=>{
    const w=weights[id]!,child=index-6,changed=child>=0&&id===2+child*5;
    const origin=index<6?index:EXAMPLE_PARENTS[(id+child)%2]!;
    return `<path d="${d}" stroke="${changed?'#5200FF':colors[origin]}" stroke-width="${Math.abs(w)}" data-origin="${origin+1}" ${changed?'data-mutated="true"':''} ${w<0?'stroke-dasharray="2 2"':''}/>`;
  };
  const paths=inputs.flatMap((y,from)=>hidden.map((hy,to)=>edge(from*4+to,`M13 ${y} L42 ${hy}`)))
    .concat(hidden.flatMap((y,from)=>outputs.map((oy,to)=>edge(16+from*2+to,`M42 ${y} L65 ${oy}`)))).join('');
  return `<svg viewBox="0 0 68 64" aria-hidden="true" data-weights="${weights.join(',')}"><g class="el__links">${paths}</g><g class="el__nodes">${inputs.map(y => `<circle cx="13" cy="${y}" r="3"/>`).join('')}${hidden.map(y => `<circle cx="42" cy="${y}" r="4"/>`).join('')}${outputs.map(y => `<circle cx="65" cy="${y}" r="4"/>`).join('')}</g></svg>`;
}

const childModels = [6, 7, 8].map((pattern, i) => `<div class="el__child-model">${network(pattern)}<span>Variant ${i + 1}</span></div>`).join('');
const unselectedFlame = `<span class="el__not-selected"><svg viewBox="0 0 26 34" aria-hidden="true"><path d="M13 32C0 29 0 16 8 9L9 16C13 12 14 7 14 1C20 8 27 15 24 24C23 29 18 33 13 32Z" fill="#e95300" stroke="#fffdf7" stroke-width="2"/><path d="M13 29C6 27 8 22 13 17C14 21 19 23 17 27C16 29 14 30 13 29Z" fill="#ffdb36"/></svg><span>Niet gekozen</span></span>`;
function pairsMarkup(compact: boolean): string {
  return Array.from({ length: 6 }, (_, i) => `<article class="el__pair" data-car="${i + 1}">
    <div class="el__car-view">${car(i)}${compact ? '' : `<span>Auto ${i + 1}</span>`}</div><span class="el__pair-arrow" aria-hidden="true">↔</span>
    <div class="el__model">${network(i)}${compact ? '' : `<span>AI-model ${i + 1}</span>`}</div>${compact ? '' : '<span class="el__selected">Geselecteerd</span>'}${compact ? unselectedFlame.replace('<span>Niet gekozen</span>', '') : unselectedFlame}
  </article>`).join('');
}

const phases = [
  { title: 'Verschillen', text: 'Elke auto heeft een eigen AI-model met een andere aanpak.' },
  { title: 'Rijden', text: 'De modellen rijden hetzelfde oefencircuit. Hun aanpak blijft tijdens het rijden vast.' },
  { title: 'Ouders kiezen', text: 'Modellen die goed rijden op de gekozen oefencircuits krijgen meer kans om hun aanpak door te geven.' },
  { title: 'Nieuwe generatie', text: 'Het beste model bewaren we. Van de geselecteerde modellen maken we nieuwe versies met kleine veranderingen.' },
];
const compactCaptions = ['Elke auto heeft een eigen AI-model.', 'Alle modellen rijden hetzelfde circuit.', 'De beste modellen krijgen nakomelingen.', 'Nieuwe modellen. Kleine verschillen.'];

/** Drawing-only explanation of selection and inheritance; it does not measure learning. */
export function mountEvolutionLesson(root: HTMLElement, options: { onContinue: () => void; manualTimeline?:boolean; compact?:boolean }): { setActive(active: boolean): void; setPhase(phase:number):void; dispose(): void } {
  const compact = options.compact === true;
  const doc = root.ownerDocument;
  const win = doc.defaultView;
  const media = win?.matchMedia('(prefers-reduced-motion: reduce)');
  let reducedMotion = media?.matches ?? false;
  root.innerHTML = `<section class="evolution-lesson${compact ? ' evolution-lesson--compact' : ''}" ${compact ? 'aria-label="Auto-evolutie"' : 'aria-labelledby="el-title"'} data-phase="0">
    ${compact ? '' : `<header class="el__header"><p class="el__eyebrow">Van Flappy Bird naar auto's</p><h2 id="el-title" tabindex="-1">Wat zou Darwin doen?</h2>
      <p>Charles Darwin beschreef evolutie door natuurlijke selectie. Welke aanpak blijft over als auto's steeds opnieuw racen?</p></header>
    <p class="el__contrast"><strong>Bij Flappy Bird</strong> gebruikten alle vogels hetzelfde AI-model. <strong>Hier</strong> heeft elke auto een eigen AI-model. Goed rijden hangt af van de gekozen oefencircuits.</p>`}
    <div class="el__phase" aria-live="off" aria-atomic="true"><span class="el__step"${compact ? ' hidden' : ''}></span><div>${compact ? '' : '<h3 class="el__phase-title"></h3>'}<p class="el__phase-copy"></p></div></div>
    <div class="el__scene"><div class="el__population" aria-label="Zes auto's met elk een eigen AI-model">${pairsMarkup(compact)}</div>
    <section class="el__family" aria-label="${compact ? 'Ouders, nakomelingen en beste model' : 'Van geselecteerde ouders naar een nieuwe generatie'}">
      <div class="el__parents"><span class="el__family-tag">${compact ? 'Ouders' : 'Geselecteerde ouders'}</span><div class="el__parent-chip el__parent-one">${network(1)}${compact ? '' : '<span>Model 2</span>'}</div><div class="el__parent-chip el__parent-two">${network(4)}${compact ? '' : '<span>Model 5</span>'}</div></div>
      <span class="el__branch" aria-hidden="true">→</span>
      <div class="el__children"><span class="el__family-tag">${compact ? 'Nakomelingen' : 'Nieuwe varianten'}</span>${compact ? [6,7,8].map(pattern => `<div class="el__child-model">${network(pattern)}</div>`).join('') : childModels}</div>
      <div class="el__best"><span aria-hidden="true">★</span><div><strong>${compact ? 'Beste model' : 'Beste model: 2'}</strong>${compact ? '' : '<small>Ongewijzigd naar de volgende generatie</small>'}${network(1)}</div></div>
    ${compact ? '' : '<p class="el__inheritance-key"><span>Van model 2</span><span>Van model 5</span><span>Kleine verandering</span></p>'}</section></div>
    ${compact ? '' : '<p class="el__note">Zo werkt een generatie.</p>'}
    <div class="el__actions"${compact ? ' hidden' : ''}><button class="el__phase-control" type="button"></button><button class="el__continue" type="button">Laat de auto's rijden</button></div>
  </section>`;
  const view = root.querySelector<HTMLElement>('.evolution-lesson')!;
  const phaseButton = view.querySelector<HTMLButtonElement>('.el__phase-control')!;
  const phasePanel = view.querySelector<HTMLElement>('.el__phase')!;
  const phaseTitle = view.querySelector<HTMLElement>('.el__phase-title')!;
  const phaseCopy = view.querySelector<HTMLElement>('.el__phase-copy')!;
  const step = view.querySelector<HTMLElement>('.el__step')!;
  let phase = 0;
  let active = true;
  let onscreen = !(win && typeof win.IntersectionObserver === 'function');
  let disposed = false;
  let timer: number | undefined;
  let playing = !reducedMotion&&!options.manualTimeline;
  const stop = (): void => { if (timer !== undefined) win?.clearTimeout(timer); timer = undefined; view.dataset.animation = 'paused'; };
  const render = (manual = false): void => {
    view.dataset.phase = String(phase);
    if (!compact) phaseTitle!.textContent = phases[phase].title;
    phaseCopy.textContent = compact ? compactCaptions[phase]! : phases[phase].text;
    step.textContent = `${phase + 1} / 4`;
    phasePanel.setAttribute('aria-live', manual ? 'polite' : 'off');
    if (compact) return;
    phaseButton.textContent = reducedMotion ? 'Volgende stap' : playing ? 'Pauzeren' : 'Verder';
    phaseButton.setAttribute('aria-label', reducedMotion ? 'Toon volgende stap' : playing ? 'Animatie pauzeren' : 'Animatie hervatten');
    if(reducedMotion)phaseButton.removeAttribute('aria-pressed');else phaseButton.setAttribute('aria-pressed', String(playing));
  };
  const advance = (): void => { phase = (phase + 1) % phases.length; };
  const schedule = (): void => {
    stop();
    if (!disposed && active && onscreen && playing && !doc.hidden && !reducedMotion) { view.dataset.animation='playing';timer = win?.setTimeout(() => { advance(); render(); schedule(); }, 5200); }
  };
  const onControl = (): void => {
    if (reducedMotion) { advance(); render(true); return; }
    playing = !playing; render(); schedule();
  };
  const onVisibility = (): void => { if (doc.hidden) stop(); else schedule(); };
  const onMotionChange = (): void => { reducedMotion = media?.matches ?? false; if (reducedMotion) { playing = false; stop(); } render(); schedule(); };
  const observer = win && typeof win.IntersectionObserver === 'function' ? new win.IntersectionObserver(entries => {
    onscreen = Boolean(entries[0]?.isIntersecting);
    if (onscreen) schedule(); else stop();
  }, { threshold: .05 }) : undefined;
  const onContinue = (): void => options.onContinue();
  phaseButton.addEventListener('click', onControl);
  view.querySelector<HTMLButtonElement>('.el__continue')!.addEventListener('click', onContinue);
  doc.addEventListener('visibilitychange', onVisibility);
  media?.addEventListener('change', onMotionChange);
  observer?.observe(view);
  render(); schedule();
  return {
    setPhase(next:number):void {if(!Number.isInteger(next)||next<0||next>=phases.length)throw new RangeError('Unknown explanation phase');if(disposed||phase===next)return;phase=next;render();},
    setActive(next: boolean): void { if (disposed || active === next) return; active = next; if (active) schedule(); else stop(); },
    dispose(): void {
      if (disposed) return;
      disposed = true; stop(); phaseButton.removeEventListener('click', onControl);
      view.querySelector<HTMLButtonElement>('.el__continue')!.removeEventListener('click', onContinue);
      doc.removeEventListener('visibilitychange', onVisibility); media?.removeEventListener('change', onMotionChange); observer?.disconnect(); root.replaceChildren();
    },
  };
}
