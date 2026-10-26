import { BernoulliPolicy, createInitialPolicyParameters } from '../learning/policy.ts';
import { restorePolicySnapshot, type PolicySnapshot } from '../learning/policy-snapshot.ts';
import { createObservationExamples, renderObservationGeometry, type ObservationExample } from './observation-examples.ts';
import '../styles/observation-explainer.css';
import '../styles/schematic-common.css';

const measures = [
  { name: 'Hoogte', unit: 'px', field: 'height' },
  { name: 'Verticale snelheid', unit: 'px/s', field: 'verticalSpeed' },
  { name: 'Afstand tot opening', unit: 'px', field: 'distance' },
  { name: 'Bovenkant opening', unit: 'px', field: 'gapTop' },
  { name: 'Onderkant opening', unit: 'px', field: 'gapBottom' },
] as const;

function observationScene(example: ObservationExample, selected: number): string {
  const base = (import.meta as ImportMeta & { env?: { BASE_URL?: string } }).env?.BASE_URL ?? '/';
  return renderObservationGeometry(example, selected, `${base}assets/flappy/redbird-midflap.png`);
}

/** Shows real pre-action measurements and inference from a frozen policy snapshot. */
export function mountObservationExplainer(root: HTMLElement, options: { snapshot?: PolicySnapshot } = {}): { dispose(): void } {
  const examples = createObservationExamples();
  const policy = options.snapshot
    ? restorePolicySnapshot(options.snapshot)
    : new BernoulliPolicy(1222, createInitialPolicyParameters(1222));
  let index = 0;
  let selected = 0;
  root.innerHTML = `<section class="observation-explainer" aria-labelledby="oe-title">
    <header class="oe__header"><p class="oe__eyebrow">Vooraf · Waarnemen</p><h2 id="oe-title">Wat ziet het AI-model?</h2><p>Vlak vóór een actie leest het AI-model vijf getallen uit het spel.</p></header>
    <figure class="oe__figure"><div class="oe__stage">${observationScene(examples[0]!, selected)}</div><figcaption>Synthetisch voorbeeld · kies een meting.</figcaption></figure>
    <div class="oe__readout" aria-live="polite" aria-atomic="true"><div><span class="oe__label">VOORBEELD</span><h3 class="oe__case"></h3></div><p class="oe__action"></p><p class="oe__model"></p></div>
    <div class="oe__measurements" role="group" aria-label="Kies een meting">${measures.map((m, i) => `<button type="button" class="secondary oe__measure" data-index="${i}" aria-pressed="${i === 0}">${m.name}</button>`).join('')}</div>
    <div class="oe__value" role="status" aria-live="polite" aria-atomic="true"><p class="oe__value-title"></p><p class="oe__raw"></p><p class="oe__meaning"></p><p class="oe__chance"></p></div>
    <details class="oe__detail"><summary>Getal dat het model ontvangt</summary><p class="oe__normalized"></p></details>
    <div class="oe__controls"><button type="button" class="secondary oe__previous">Vorig spelmoment</button><button type="button" class="secondary oe__next">Volgend spelmoment</button><button type="button" class="secondary oe__reset">Opnieuw</button></div>
    <p class="oe__note">Uitlegvoorbeeld · je experiment blijft ongewijzigd.</p>
  </section>`;
  const view = root.querySelector<HTMLElement>('.observation-explainer')!;
  const caseTitle = view.querySelector<HTMLElement>('.oe__case')!;
  const action = view.querySelector<HTMLElement>('.oe__action')!;
  const valueTitle = view.querySelector<HTMLElement>('.oe__value-title')!;
  const raw = view.querySelector<HTMLElement>('.oe__raw')!;
  const normalized = view.querySelector<HTMLElement>('.oe__normalized')!;
  const chance = view.querySelector<HTMLElement>('.oe__chance')!;
  const model = view.querySelector<HTMLElement>('.oe__model')!;
  const buttons = [...view.querySelectorAll<HTMLButtonElement>('.oe__measure')];
  const example = (): ObservationExample => examples[index]!;
  const fmt = (n: number): string => new Intl.NumberFormat('nl-BE', { maximumFractionDigits: 2 }).format(n);
  const render = (): void => {
    const current = example();
    const measure = measures[selected]!;
    const actual = current[measure.field];
    const p = policy.probability(current.observation);
    caseTitle.textContent = `Spelmoment ${index + 1} van ${examples.length}`;
    action.textContent = `Voorbeeldactie: ${current.action === 1 ? 'flap' : 'wachten'} (stap ${current.step})`;
    const stages: Record<PolicySnapshot['stage'], string> = { initial: 'startmodel', imitation: 'imitatiemodel', post_rl: 'model na oefenen met beloning' };
    model.textContent = options.snapshot ? `Kans van je ${stages[options.snapshot.stage]}` : 'Startmodel · vaste flapkans van 8%';
    valueTitle.textContent = measure.name;
    view.querySelector<HTMLElement>('.oe__meaning')!.textContent=['Gemeten vanaf de bovenrand: een groter getal staat lager in beeld.','Positief is omlaag, negatief is omhoog.','Horizontaal van de vogel tot het begin van de volgende opening.','De afstand van de bovenrand tot de bovenkant van de opening.','De afstand van de bovenrand tot de onderkant van de opening.'][selected]!;
    raw.textContent = `In het spel: ${fmt(actual)} ${measure.unit}`;
    normalized.textContent = `Getal voor het model: ${fmt(current.observation[selected]!)} (genormaliseerd)`;
    chance.textContent = `Kans op flappen: ${fmt(p * 100)}%`;
    buttons.forEach((button, i) => button.setAttribute('aria-pressed', String(i === selected)));
    view.dataset.measure = String(selected);
    view.querySelector<HTMLElement>('.oe__stage')!.innerHTML = observationScene(current, selected);
  };
  const previous = view.querySelector<HTMLButtonElement>('.oe__previous')!;
  const next = view.querySelector<HTMLButtonElement>('.oe__next')!;
  const reset = view.querySelector<HTMLButtonElement>('.oe__reset')!;
  const onMeasure = (event: Event): void => { selected = Number((event.currentTarget as HTMLButtonElement).dataset.index); render(); };
  const onPrevious = (): void => { index = (index - 1 + examples.length) % examples.length; render(); };
  const onNext = (): void => { index = (index + 1) % examples.length; render(); };
  const onReset = (): void => { index = 0; selected = 0; render(); };
  buttons.forEach((button) => button.addEventListener('click', onMeasure));
  previous.addEventListener('click', onPrevious); next.addEventListener('click', onNext); reset.addEventListener('click', onReset);
  render();
  return { dispose() {
    buttons.forEach((button) => button.removeEventListener('click', onMeasure));
    previous.removeEventListener('click', onPrevious); next.removeEventListener('click', onNext); reset.removeEventListener('click', onReset);
    root.replaceChildren();
  } };
}
