import { mountExperimentFileView } from './experiment-file-view.ts';
import type { SavedExperiment, Game } from './experiment-files.ts';

type DataManagerOptions = {
  get: (game: Game) => SavedExperiment | undefined;
  onImport: (experiment: SavedExperiment) => void;
  onDelete: (game: Game) => boolean;
  storageStatus: () => string;
};

const gameName = (game: Game) => game === 'car' ? 'Raceauto' : 'Flappy Bird';
const savedDate = (value: string) => new Intl.DateTimeFormat('nl-BE', {
  dateStyle: 'medium', timeStyle: 'short',
}).format(new Date(value));

export function mountDataManagerView(root: HTMLElement, options: DataManagerOptions) {
  root.innerHTML = `<style>
    .data-manager { display:grid; gap:14px; }
    .data-manager__confirmation { border:1px solid var(--border); border-radius:12px; padding:14px; background:var(--bg); }
    .data-manager__confirmation[hidden] { display:none; }
    .data-manager__confirmation p { margin:0 0 12px; }
    .data-manager__confirmation-actions { display:flex; flex-wrap:wrap; gap:10px; }
    .data-manager button:focus-visible,.data-manager select:focus-visible { outline:3px solid var(--brand-purple); outline-offset:2px; }
  </style><section class="card data-manager">
    <h1>Mijn experimenten</h1>
    <p>Je werk blijft in deze browser. Download een bestand als reservekopie of om verder te gaan op een ander apparaat.</p>
    <details class="context-help"><summary>Wat wordt bewaard?</summary><p>Voorbeelden, modellen, circuits en metingen staan in je bestand. Terugkijkopnamen en livebeelden worden niet meegenomen. Er is geen cloudreservekopie: browsergegevens wissen kan je werk verwijderen. Deel geen namen of andere persoonsgegevens.</p></details>
    <p class="storage-state" role="status"></p>
    <label>Spel <select class="data-game"><option value="flappy">Flappy Bird</option><option value="car">Raceauto</option></select></label>
    <p class="data-summary"></p><div class="data-files"></div>
    <button type="button" class="secondary delete-game">Wis uitsluitend dit spel-experiment</button>
    <section class="data-manager__confirmation" role="group" aria-labelledby="delete-confirm-title" aria-describedby="delete-confirm-copy" hidden>
      <h2 id="delete-confirm-title">Experiment verwijderen?</h2><p id="delete-confirm-copy"></p>
      <div class="data-manager__confirmation-actions"><button type="button" class="confirm-delete">Verwijder experiment</button><button type="button" class="secondary cancel-delete">Annuleren</button></div>
    </section>
    <p class="data-delete-status" role="status" aria-live="polite"></p>
  </section>`;
  let files: { dispose(): void } | undefined;
  let pendingGame: Game | undefined;
  const select = root.querySelector<HTMLSelectElement>('.data-game')!;
  const status = root.querySelector<HTMLElement>('.data-delete-status')!;
  const confirmation = root.querySelector<HTMLElement>('.data-manager__confirmation')!;
  const deleteButton = root.querySelector<HTMLButtonElement>('.delete-game')!;

  const render = () => {
    files?.dispose();
    const game = select.value as Game;
    const current = options.get(game);
    root.querySelector('.storage-state')!.textContent = options.storageStatus();
    if (current) {
      const payload = current.payload as { teach?: { episodes?: readonly unknown[] }; records?: readonly unknown[] };
      const examples = payload.teach?.episodes?.length ?? 0;
      const records = payload.records?.length ?? 0;
      const summary = [examples ? `${examples} voorbeelden` : '', records ? `${records} metingen` : '']
        .filter(Boolean).join(' · ') || 'Nog geen voorbeelden of metingen';
      root.querySelector('.data-summary')!.textContent = `${gameName(game)} · opgeslagen ${savedDate(current.savedAt)} · ${summary}.`;
    } else {
      root.querySelector('.data-summary')!.textContent = 'Nog geen experiment. Open het spel of importeer een bestand.';
    }
    files = mountExperimentFileView(root.querySelector('.data-files')!, {
      game,
      getCurrent: () => options.get(game),
      onImport: experiment => {
        options.onImport(experiment);
        render();
        status.textContent = 'Gecontroleerd experiment hersteld. Open het spel om verder te gaan.';
      },
    });
  };

  const closeConfirmation = (focusDelete = true) => {
    confirmation.hidden = true;
    pendingGame = undefined;
    if (focusDelete) deleteButton.focus();
  };
  select.onchange = () => { closeConfirmation(false); status.textContent = ''; render(); };
  deleteButton.onclick = () => {
    pendingGame = select.value as Game;
    root.querySelector('#delete-confirm-copy')!.textContent = `Hiermee verwijder je het opgeslagen ${gameName(pendingGame)}-experiment uit deze browser. Het andere spel blijft behouden. Deze actie kan niet ongedaan worden gemaakt.`;
    confirmation.hidden = false;
    status.textContent = '';
    root.querySelector<HTMLButtonElement>('.cancel-delete')!.focus();
  };
  root.querySelector<HTMLButtonElement>('.cancel-delete')!.onclick = () => closeConfirmation();
  root.querySelector<HTMLButtonElement>('.confirm-delete')!.onclick = () => {
    const game = pendingGame;
    if (!game || game !== select.value) { closeConfirmation(); return; }
    closeConfirmation(false);
    if (options.onDelete(game)) {
      render();
      status.textContent = `${gameName(game)}-experiment gewist. Het andere spel en je gedownloade bestanden blijven bewaard.`;
    } else {
      status.textContent = 'Wissen mislukt. Sluit de pagina niet voordat je hebt geëxporteerd.';
    }
  };
  confirmation.onkeydown=event=>{if(event.key==='Escape'){event.preventDefault();closeConfirmation();}};
  render();
  return { dispose() { files?.dispose(); root.replaceChildren(); } };
}
