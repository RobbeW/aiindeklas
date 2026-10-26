import { birdAsset } from './schematic-elements.ts';
import '../styles/lesson-illustrations.css';

export type LessonIllustrationKind = 'play' | 'teach' | 'practice';
export type LessonIllustrationOptions = { hasHumanExamples?: boolean };

const bird = (className = 'li-bird') => `<img class="${className}" src="${birdAsset()}" alt="" width="44" height="31">`;
const game = `<div class="li-game" aria-label="Flappy Bird spelveld"><div class="li-cloud li-cloud-one"></div><div class="li-cloud li-cloud-two"></div><div class="li-pipe li-pipe-top"></div><div class="li-opening" aria-hidden="true"></div><div class="li-pipe li-pipe-bottom"></div>${bird()}<div class="li-ground"></div></div>`;
const model = `<div class="li-model" aria-label="AI-model met verbonden rekenpunten"><svg viewBox="0 0 160 112" role="img" aria-label="Punten en verbindingen in een AI-model"><g class="li-weights"><path d="M35 24 77 18M35 24 77 54M35 56 77 18M35 56 77 54M35 56 77 90M35 88 77 54M35 88 77 90M83 18 125 32M83 18 125 76M83 54 125 32M83 54 125 76M83 90 125 32M83 90 125 76"/><circle cx="30" cy="24" r="8"/><circle cx="30" cy="56" r="8"/><circle cx="30" cy="88" r="8"/><circle cx="80" cy="18" r="8"/><circle cx="80" cy="54" r="8"/><circle cx="80" cy="90" r="8"/><circle cx="130" cy="32" r="8"/><circle cx="130" cy="76" r="8"/></g></svg><span>Gedeeld AI-model</span></div>`;

function playScene() {
  return `<div class="li-play-layout"><div class="li-play-copy"><span class="li-eyebrow">Kijk naar de opening</span><p>De vogel nadert. Wat zou jij doen?</p></div>${game}<div class="li-action" aria-hidden="true"><span class="li-look">●</span><span class="li-action-line"></span><span class="li-flap-mark">↑</span></div></div>`;
}

function teachScene(hasHumanExamples: boolean) {
  const caption = hasHumanExamples ? 'De computer observeerde hoe jij speelde.' : 'De computer observeert hoe jij speelt.';
  return `<div class="li-teach-flow"><div class="li-human"><span class="li-scene-label">Jij speelt</span>${game}<div class="li-controller" aria-hidden="true"><span></span><span></span><i></i></div></div><span class="li-flow-arrow" aria-hidden="true">→</span><div class="li-observer"><span class="li-scene-label">Computer kijkt mee</span><div class="li-computer" aria-label="Computer met oog dat de game observeert"><div class="li-screen"><span class="li-eye"><i></i></span></div><div class="li-computer-base"></div></div></div><div class="li-notes"><span class="li-scene-label">Notities</span><ul><li>Hoogte</li><li>Verticale snelheid</li><li>Afstand</li><li>Bovenkant opening</li><li>Onderkant opening</li></ul></div><span class="li-flow-arrow li-notes-arrow" aria-hidden="true">→</span><div class="li-folder" aria-label="Notities opgeslagen in map Training"><span class="li-scene-label">Training</span><div class="li-folder-shape"><span>Training</span></div></div></div><p class="li-caption">${caption}</p>`;
}

function practiceScene() {
  return `<div class="li-practice-flow"><div class="li-practice-model">${model}</div><span class="li-flow-arrow" aria-hidden="true">→</span><div class="li-flock" aria-label="Meerdere vogels oefenen tegelijk">${Array.from({ length: 12 }, (_, i) => `<div class="li-flock-bird">${bird('')}<span>${i + 1}</span></div>`).join('')}<span class="li-scene-label">Meerdere vogels</span></div><span class="li-flow-arrow li-feedback-arrow" aria-hidden="true">→</span><div class="li-feedback"><span class="li-scene-label">Uitkomsten</span><div><span class="li-success">+ Beloning</span><span class="li-failure">− Straf</span></div></div><span class="li-flow-arrow li-return-arrow" aria-hidden="true">↶</span></div><p class="li-caption">Eerst leerde het model van één speler: jij. Nu kunnen twaalf vogels tegelijk oefenen. Versnel het spel en verzamel hun successen en fouten als nieuwe trainingsdata.</p>`;
}

export function mountLessonIllustration(root: HTMLElement, kind: LessonIllustrationKind, options: LessonIllustrationOptions = {}): { dispose(): void } {
  const scene = document.createElement('section');
  scene.className = `lesson-illustration li-${kind}`;
  scene.setAttribute('aria-label', kind === 'play' ? 'Flappy Bird: kijk naar de opening' : kind === 'teach' ? 'De computer leert door mee te kijken' : 'Meerdere vogels oefenen met een gedeeld AI-model');
  scene.innerHTML = kind === 'play' ? playScene() : kind === 'teach' ? teachScene(!!options.hasHumanExamples) : practiceScene();
  root.replaceChildren(scene);
  const syncVisibility = () => scene.classList.toggle('li-page-hidden', document.hidden);
  document.addEventListener('visibilitychange', syncVisibility);
  syncVisibility();
  return { dispose() { document.removeEventListener('visibilitychange', syncVisibility); scene.remove(); } };
}
