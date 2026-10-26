import type { DemonstrationEpisode } from './demonstrations.ts';
import { classBalance, validateEpisode } from './dataset.ts';

export interface DatasetViewOptions {
  /** Requests a recording state change. A recorder integration must call setRecording when it changes. */
  readonly onRecordingChange?: (recording: boolean) => void;
  /** Receives a frozen snapshot whenever the collection changes. */
  readonly onChange?: (episodes: readonly DemonstrationEpisode[]) => void;
}

export interface DatasetView {
  /** Validate and add one completed episode. Incomplete recordings must not be passed here. */
  addEpisode(value: unknown): DemonstrationEpisode;
  getEpisodes(): readonly DemonstrationEpisode[];
  /** Set this from the recorder's actual state; recording requests do not create episodes. */
  setRecording(recording: boolean): void;
  dispose(): void;
}

export interface DatasetSummary {
  readonly episodeCount: number;
  readonly simulatedSeconds: number;
  readonly flaps: number;
  readonly waits: number;
  readonly balance: ReturnType<typeof classBalance>['diagnostic'];
}

/** Pure aggregate used by the view and suitable for dataset-level checks. */
export function summarizeDataset(episodes: readonly DemonstrationEpisode[]): DatasetSummary {
  const frames = episodes.flatMap((episode) => episode.frames);
  const balance = classBalance(frames);
  return Object.freeze({
    episodeCount: episodes.length,
    simulatedSeconds: episodes.reduce((sum, episode) => sum + episode.durationSeconds, 0),
    flaps: balance.flaps,
    waits: balance.waits,
    balance: balance.diagnostic,
  });
}

const styles = `
.dataset-view { display: grid; gap: 18px; }
.dataset-view__summary { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; margin: 0; }
.dataset-view__metric { border: 1px solid var(--border); border-radius: 12px; padding: 14px; background: var(--bg); }
.dataset-view__metric dt { color: var(--muted); font-size: 13px; }
.dataset-view__metric dd { margin: 4px 0 0; font-size: 22px; font-weight: 750; }
.dataset-view__list { display: grid; gap: 10px; padding: 0; margin: 0; list-style: none; }
.dataset-view__episode { display: flex; align-items: center; justify-content: space-between; gap: 14px; border: 1px solid var(--border); border-radius: 12px; padding: 12px 14px; }
.dataset-view__episode p { margin: 2px 0 0; }
.dataset-view__status { min-height: 1.65em; margin: 0; }
.dataset-view__undo { justify-self: start; }
.dataset-view__toolbar { margin: 0; }
@media (max-width: 520px) {
  .dataset-view__summary { grid-template-columns: 1fr; }
  .dataset-view__episode { align-items: flex-start; }
}
`;

function element<K extends keyof HTMLElementTagNameMap>(tag: K, text?: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = text;
  return node;
}

function formatTime(seconds: number): string {
  const total = Math.round(seconds);
  const minutes = Math.floor(total / 60);
  const remainder = total % 60;
  return minutes > 0 ? `${minutes} min ${remainder} s` : `${remainder} s`;
}

function diagnostic(episodes: readonly DemonstrationEpisode[], recording: boolean, balance: DatasetSummary['balance']): string {
  if(recording)return 'De computer kijkt mee. Speel je poging uit om je opname te bewaren.';
  return episodes.length?'Train en test je AI-model. Neem daarna meer pogingen op.':'Start je eerste opname.';
}

/** Mount the reusable Dutch dataset collection panel into a supplied root. */
export function mountDatasetView(root: HTMLElement, options: DatasetViewOptions = {}): DatasetView {
  let episodes: readonly DemonstrationEpisode[] = Object.freeze([]);
  let recording = false;
  let disposed = false;
  let undoEpisodes: readonly DemonstrationEpisode[] | undefined;

  const panel = element('section');
  const stylesheet = element('style');
  stylesheet.textContent = styles;
  panel.className = 'card dataset-view';
  panel.setAttribute('aria-labelledby', 'dataset-title');
  const heading = element('h2', 'Demonstraties');
  heading.id = 'dataset-title';

  const summary = element('dl');
  summary.className = 'dataset-view__summary';
  const metrics = (['Pogingen', 'Simulatietijd', 'Flaps / wachten'] as const).map((label) => {
    const wrap = element('div');
    wrap.className = 'dataset-view__metric';
    wrap.append(element('dt', label));
    const value = element('dd', '0');
    wrap.append(value);
    summary.append(wrap);
    return value;
  });

  const status = element('p', 'Nog geen voorbeelden. Start een opname.');
  status.className = 'muted dataset-view__status';
  status.setAttribute('role', 'status');
  status.setAttribute('aria-live', 'polite');
  status.setAttribute('aria-atomic', 'true');

  const toolbar = element('div');
  toolbar.className = 'toolbar dataset-view__toolbar';
  const recordButton = element('button', 'Start opname');
  recordButton.type = 'button';
  recordButton.className = 'record-toggle';
  recordButton.addEventListener('click', () => {
    const wasRecording = recording;
    options.onRecordingChange?.(!recording);
    if (recording === wasRecording) {
      status.textContent = wasRecording
        ? 'Stop gevraagd. De huidige poging wordt pas toegevoegd wanneer de simulatie haar afrondt.'
        : 'Start gevraagd. De opname begint wanneer de simulatie bevestigt dat zij loopt.';
    }
  });
  const clearButton = element('button', 'Wis alle pogingen');
  clearButton.type = 'button';
  clearButton.className = 'secondary';
  clearButton.addEventListener('click', () => {
    if (episodes.length === 0) return;
    undoEpisodes = episodes;
    episodes = Object.freeze([]);
    render();
    undoButton.hidden = false;
    undoButton.focus();
    options.onChange?.(episodes);
  });
  const undoButton = element('button', 'Maak verwijderen ongedaan');
  undoButton.type = 'button';
  undoButton.className = 'secondary dataset-view__undo';
  undoButton.hidden = true;
  undoButton.addEventListener('click', () => {
    if (!undoEpisodes) return;
    episodes = undoEpisodes;
    undoEpisodes = undefined;
    render();
    options.onChange?.(episodes);
    clearButton.focus();
  });
  toolbar.append(recordButton, clearButton);

  const list = element('ul');
  list.className = 'dataset-view__list';
  panel.append(heading, summary, status, toolbar, undoButton, list);
  root.replaceChildren(stylesheet, panel);

  function render(): void {
    if (disposed) return;
    const stats = summarizeDataset(episodes);
    metrics[0].textContent = String(stats.episodeCount);
    metrics[1].textContent = formatTime(stats.simulatedSeconds);
    metrics[2].textContent = `${stats.flaps} / ${stats.waits}`;
    recordButton.textContent = recording ? 'Stop opname' : 'Start opname';
    recordButton.setAttribute('aria-pressed', String(recording));
    clearButton.disabled = episodes.length === 0;
    undoButton.hidden = !undoEpisodes;
    status.textContent = undoEpisodes
      ? 'Voorbeeld verwijderd. Gebruik ‘Maak verwijderen ongedaan’ om het terug te zetten.'
      : diagnostic(episodes, recording, stats.balance);
    list.replaceChildren(...episodes.map((episode, index) => {
      const row = element('li');
      row.className = 'dataset-view__episode';
      const details = element('div');
      details.append(element('strong', `Poging ${index + 1} · ${episode.source === 'human' ? 'menselijke demonstratie' : 'synthetisch voorbeeld'}`));
      details.append(element('p', `${episode.frames.length} stappen · ${formatTime(episode.durationSeconds)}`));
      const remove = element('button', 'Verwijder');
      remove.type = 'button';
      remove.className = 'secondary';
      remove.setAttribute('aria-label', `Verwijder poging ${index + 1}`);
      remove.addEventListener('click', () => {
        undoEpisodes = episodes;
        episodes = Object.freeze(episodes.filter((candidate) => candidate.id !== episode.id));
        render();
        undoButton.focus();
        options.onChange?.(episodes);
      });
      row.append(details, remove);
      return row;
    }));
  }

  render();
  return {
    addEpisode(value) {
      if (disposed) throw new Error('dataset view is disposed');
      const episode = validateEpisode(value);
      if (episodes.some((existing) => existing.id === episode.id)) throw new Error('duplicate episode id');
      undoEpisodes = undefined;
      episodes = Object.freeze([...episodes, episode]);
      render();
      options.onChange?.(episodes);
      return episode;
    },
    getEpisodes: () => episodes,
    setRecording(value) {
      if (disposed) return;
      recording = value;
      render();
    },
    dispose() {
      disposed = true;
      root.replaceChildren();
    },
  };
}
