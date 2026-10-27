import { mountGameFullscreen } from '../ui/game-fullscreen.ts';
import { mountTrainingGym } from '../ui/training-gym.ts';
import { mountDatasetView, type DatasetView } from '../data/dataset-view.ts';
import type { DemonstrationEpisode } from '../data/demonstrations.ts';
import { createFlappyInput } from '../input/flappy-input.ts';
import { createPolicySnapshot, restorePolicySnapshot, type PolicySnapshot } from '../learning/policy-snapshot.ts';
import { createFlappyRenderer } from './renderer.ts';
import { FlappyEnvironment } from './environment.ts';
import { DemonstrationRecorder } from './recorder.ts';
import { advanceFlappyFrame } from './play-view.ts';
import { createImitationController, FrozenCloneController, TEACH_CLONE_TEST_SEED, TEACH_INITIALIZATION_SEED, TEACH_LEARNING_RATE, TEACH_UPDATE_BUDGET, type CloneResult, type ImitationController } from './imitation-controller.ts';
import type { ImitationProgress } from '../learning/imitation-job.ts';
import { WorkerJobCancelledError } from '../core/worker-client.ts';

const styles = `
.teach { display:grid; gap:18px; padding:0; }
.teach__columns { display:grid; grid-template-columns:minmax(280px,360px) minmax(0,1fr); gap:18px; align-items:start; }
.teach__game { display:grid; gap:12px; }
.teach__game canvas { width:min(100%,360px); }
.teach__panel { display:grid; gap:12px; align-content:start; }
.teach__status { min-height:1.7em; margin:0; }
.teach__progress { width:100%; accent-color:var(--brand-purple); }
.teach__actions { display:flex; flex-wrap:wrap; gap:10px; }
@media(max-width:760px){.teach__columns{grid-template-columns:1fr}.teach__game canvas{margin-inline:auto}}
`;

export interface TeachState {
  readonly assessments?:readonly {sessions:number;actions:number;score:number;survivalSteps:number}[];
  readonly initialSnapshot: PolicySnapshot;
  readonly imitationSnapshot?: PolicySnapshot;
  readonly episodes: readonly DemonstrationEpisode[];
  readonly cloneResult?: CloneResult;
  readonly imitationIsStale: boolean;
  readonly recordingRole?: 'training' | 'validation';
  readonly status: string;
  readonly progress?: ImitationProgress;
}
export interface TeachViewOptions { readonly onStateChange?: (state: TeachState) => void;readonly restoreState?:TeachState; }
export interface TeachView {
  dispose(): void;
  getState(): TeachState;
}
type Phase = 'ready' | 'recording' | 'paused' | 'training' | 'clone' | 'disposed';

const el = <K extends keyof HTMLElementTagNameMap>(tag: K, text?: string): HTMLElementTagNameMap[K] => {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = text;
  return node;
};

/** Mount the learner-facing record → train → frozen clone workflow. */
export async function mountFlappyTeachView(root: HTMLElement, options: TeachViewOptions = {}): Promise<TeachView> {
  root.innerHTML = `<main class="teach">
    <section class="card" aria-labelledby="teach-title">
      <p class="eyebrow">AI in de klas · leren van voorbeelden</p>
      <h1 id="teach-title">Kijk hoe ik speel</h1>
      <p>Neem voorbeelden op, train het model en test het op nieuwe openingen.</p>
      <div class="teach__columns">
        <section class="teach__game" aria-labelledby="teach-game-title">
          <h2 id="teach-game-title">Jouw demonstratie</h2>
          <p id="teach-role" class="badge" hidden>Volgende opname: training</p>
          <div class="teach__actions"><button id="teach-pause" class="secondary" type="button" disabled>Pauzeer</button><button id="teach-restart" class="secondary" type="button" disabled>Opnieuw starten</button></div>
          <p id="teach-score">Score: 0 · 0 stappen</p>
          <canvas id="teach-canvas" tabindex="0" aria-label="Flappy speelveld; selecteer voor Spatie of pijltje omhoog"></canvas>
          <p class="muted">Start de opname en flap met Spatie, ↑ of de knop. Pauzeren slaat niets op.</p>
          <button id="teach-flap" class="secondary" type="button" disabled>Flap</button>
        </section>
        <section class="teach__panel" aria-label="Oefen en train">
          <div id="dataset-mount"></div>
          <section class="card" aria-labelledby="train-title">
            <h2 id="train-title">Train jouw AI-model</h2><div class="teach-data-progress"><strong>Hoeveel trainingsdata heb je?</strong><p id="teach-data-count"></p><ol class="teach-data-stages"><li>1 opname</li><li>3 opnamen</li><li>10 of meer opnamen</li></ol></div>
            <p id="teach-origin">Model: beginmodel · nog niet getraind.</p>
            <p id="train-loss" hidden></p><p id="train-count" hidden>Training: 0/250 updates · methode Adam · leersnelheid 0,01.</p>
            <progress id="train-progress" hidden class="teach__progress" max="250" value="0" aria-label="Voortgang van modeltraining"></progress>
            <p id="train-status" class="teach__status" role="status" aria-live="polite">Neem één volledige poging op. Train en test daarna je AI-model.</p>
            <div class="teach__actions"><button id="train-button" type="button">Train model</button><button id="cancel-button" class="secondary" type="button" disabled>Annuleer training</button></div>
          </section>
          <section class="card" aria-labelledby="clone-title">
            <h2 id="clone-title">Test jouw AI-model</h2>
            <p>Test het model op nieuwe openingen.</p>
            <button id="clone-button" type="button" disabled>Test jouw AI-model</button>
            <p id="clone-status" class="teach__status" role="status" aria-live="polite">Train eerst een model.</p>
            <div class="teach-assessments"></div><p id="clone-details" class="muted" hidden>Nog geen testresultaat.</p>
          </section>
        </section>
      </div>
    </section>
  </main>`;
  const style = el('style'); style.textContent = styles; root.prepend(style);
  const required = <T extends HTMLElement>(selector: string): T => {
    const found = root.querySelector<T>(selector); if (!found) throw new Error(`Teach view missing ${selector}`); return found;
  };
  const canvas = required<HTMLCanvasElement>('#teach-canvas');
  const flap = required<HTMLButtonElement>('#teach-flap');
  const pause = required<HTMLButtonElement>('#teach-pause');
  const restart = required<HTMLButtonElement>('#teach-restart');
  const trainButton = required<HTMLButtonElement>('#train-button');
  const cancelButton = required<HTMLButtonElement>('#cancel-button');
  const cloneButton = required<HTMLButtonElement>('#clone-button');
  const trainStatus = required<HTMLElement>('#train-status');
  const cloneStatus = required<HTMLElement>('#clone-status');
  const progressBar = required<HTMLProgressElement>('#train-progress');
  const roleText = required<HTMLElement>('#teach-role');
  const score = required<HTMLElement>('#teach-score');
  const origin = required<HTMLElement>('#teach-origin');
  const trainCount = required<HTMLElement>('#train-count');
  const datasetRoot = required<HTMLElement>('#dataset-mount');
  let disposed = false;
  let initializing=true;
  let phase: Phase = 'ready';
  let statusText = 'Neem één volledige poging op. Train en test daarna je AI-model.';
  let progress: ImitationProgress | undefined;
  let cloneResult: CloneResult | undefined;
  let trainedEpisodeSignature = '';
  let trainingEpoch = 0;
  let role: 'training' | 'validation' = 'training';
  let trainingNumber = 0;
  let assessments=[...(options.restoreState?.assessments??[])];
  let validationNumber = 0;
  let roleForCurrent: 'training' | 'validation' | undefined;
  let currentSeed = 1000;
  let currentRecorder: DemonstrationRecorder | undefined;
  let dataset: DatasetView;
  let renderer: Awaited<ReturnType<typeof createFlappyRenderer>> | undefined;
  let frameHandle: number | undefined;
  let lastTimestamp: number | undefined;
  let accumulatorMs = 0;
  let controller: ImitationController;
  const gym = mountTrainingGym(trainButton, () => controller.cancel());
  let cloneEnvironment: FlappyEnvironment | undefined;
  let clonePolicy: FrozenCloneController | undefined;
  let currentWorld = new FlappyEnvironment();
  const input = createFlappyInput({ button: flap, canvas });

  const episodeSignature = (): string => dataset.getEpisodes().map((episode) => `${episode.id}:${episode.seed}`).join('|');
  const getState = (): TeachState => Object.freeze({
    assessments,initialSnapshot: controller.initialSnapshot,
    ...(controller.getImitationSnapshot() ? { imitationSnapshot: controller.getImitationSnapshot() } : {}),
    episodes: dataset.getEpisodes(), ...(cloneResult ? { cloneResult } : {}), imitationIsStale: !!controller.getImitationSnapshot() && trainedEpisodeSignature !== episodeSignature(), ...(roleForCurrent ? { recordingRole: roleForCurrent } : {}),
    status: statusText, ...(progress ? { progress } : {}),
  });
  const notify = (): void => { if (!disposed&&!initializing) options.onStateChange?.(getState()); };
  const stopFrame = (): void => { if (frameHandle !== undefined) cancelAnimationFrame(frameHandle); frameHandle = undefined; lastTimestamp = undefined; accumulatorMs = 0; };
  const refresh = (): void => {
    const episodes = dataset.getEpisodes();
    roleText.textContent = phase==='clone'||(phase==='paused'&&cloneEnvironment&&!roleForCurrent)?'Bevroren imitatie · geen opname':`Volgende opname: ${role==='training'?'training':'controle'}`;
    const imitation = controller.getImitationSnapshot();
    const imitationIsStale = !!imitation && trainedEpisodeSignature !== episodeSignature();
    cloneButton.disabled = !imitation || imitationIsStale || phase === 'recording' || phase === 'paused' || phase === 'training' || phase === 'clone';
    if (imitationIsStale) cloneStatus.textContent = 'De dataset is gewijzigd sinds deze training. Train opnieuw voordat je de imitatie test.';
    trainButton.disabled = !episodes.some(e=>e.seed<2000)||phase === 'recording' || phase === 'paused' || phase === 'training' || phase === 'clone';
    cancelButton.disabled = phase !== 'training';
    pause.disabled = phase !== 'recording' && phase !== 'paused' && phase !== 'clone';
    restart.disabled = !roleForCurrent || (phase !== 'recording' && phase !== 'paused');
    origin.textContent = imitation ? 'Jouw AI-model is getraind.' : 'Model: beginmodel · nog niet getraind.';
    trainCount.textContent = imitation ? `Voorbeelden: ${imitation.datasetProvenance.length} · updates: ${imitation.trainingCounts.supervisedUpdates}/250 · methode: ${imitation.supervisedOptimizer ?? 'sgd'} · leersnelheid: 0,01.` : 'Training: 0/250 updates · methode Adam · leersnelheid 0,01.';
    if (!imitation && episodes.length < 2 && phase !== 'training') trainStatus.textContent = 'Neem één volledige poging op. Train en test daarna je AI-model.';
    const training=episodes.filter(e=>e.seed<2000);const actions=training.reduce((n,e)=>n+e.frames.length,0);required('#teach-data-count').textContent=`Opnamen: ${training.length} · keuzes: ${actions} · speltijd: ${training.reduce((n,e)=>n+e.durationSeconds,0).toFixed(1).replace('.',',')} s`;
    [...root.querySelectorAll('.teach-data-stages li')].forEach((li,i)=>li.classList.toggle('is-done',training.length>=[1,3,10][i]!));
    required('.teach-assessments').replaceChildren(...assessments.map(a=>{const row=el('p',`${a.sessions} ${a.sessions===1?'opname':'opnamen'} · ${a.actions} keuzes → ${a.score} punten`);return row;}));
    notify();
  };
  const assignNextRole = (): void => {
    roleForCurrent='training';role='training';
    const used=new Set(dataset.getEpisodes().map(e=>e.seed));while(used.has(1000+trainingNumber))trainingNumber++;currentSeed=1000+trainingNumber++;
  };
  const resetCurrent = (): void => { currentWorld.reset({ seed: currentSeed }); };
  const pauseForBlur = (): void => {
    if (phase === 'recording' || phase === 'clone') {
      phase = 'paused'; stopFrame(); input.reset(); flap.disabled = true; pause.textContent = 'Hervat';
      statusText = 'Gepauzeerd omdat het venster niet actief is. Hervat om door te gaan.'; trainStatus.textContent = statusText; refresh();
    }
  };
  const frame = (timestamp: number): void => {
    frameHandle = undefined;
    if ((phase !== 'recording' && phase !== 'clone') || disposed) return;
    const delta = lastTimestamp === undefined ? 0 : Math.max(0, timestamp - lastTimestamp); lastTimestamp = timestamp;
    try {
      const advance = advanceFlappyFrame(delta, accumulatorMs, () => phase === 'recording' ? input.consumeAction() : 0, (action) => {
        if (phase === 'recording') {
          const rec = currentRecorder; if (!rec) throw new Error('Geen actieve recorder.');
          const transition = rec.step(action); currentWorld = rec.environment; score.textContent = `Score: ${currentWorld.pipesPassed} · ${currentWorld.world.steps} stappen`;
          if (transition.done) {
            stopFrame(); phase = 'ready'; input.reset(); flap.disabled = true; pause.disabled = true;
            const complete = rec.completedEpisode;
            if (complete) { dataset.addEpisode(complete); statusText = `Volledige ${roleForCurrent}aflevering bewaard: seed ${currentSeed}.`; }
            else statusText = 'Aflevering stopte zonder volledig resultaat; deze opname is weggegooid.';
            dataset.setRecording(false);
            roleForCurrent = undefined; currentRecorder = undefined; trainStatus.textContent = statusText; refresh();
          }
        } else if (phase === 'clone') {
          const environment = cloneEnvironment; const policy = clonePolicy; if (!environment || !policy) return;
          const transition = environment.step(policy.selectAction(environment.getObservation()));
          currentWorld = environment; score.textContent = `Score: ${environment.pipesPassed} · ${environment.world.steps} stappen`;
          if (transition.done) {
            stopFrame(); phase = 'ready'; pause.disabled = true; cloneResult = Object.freeze({ seed: TEACH_CLONE_TEST_SEED, pipesPassed: transition.result?.pipesPassed ?? 0, survivalSteps: transition.result?.survivalSteps ?? environment.world.steps, reason: transition.reason ?? 'unknown' });
    const examples=dataset.getEpisodes().filter(e=>e.seed<2000);assessments=[...assessments,{sessions:examples.length,actions:examples.reduce((n,e)=>n+e.frames.length,0),score:cloneResult.pipesPassed,survivalSteps:cloneResult.survivalSteps}].slice(-30);
    cloneStatus.textContent = `Test klaar. Score: ${cloneResult.pipesPassed} punten. Neem meer opnamen op, train opnieuw en vergelijk.`;
            required<HTMLElement>('#clone-details').textContent=`${cloneResult.pipesPassed} punten · ${cloneResult.survivalSteps} stappen · einde: ${cloneResult.reason} · testreeks ${TEACH_CLONE_TEST_SEED}.`;
            trainStatus.textContent = 'Test klaar.'; refresh();
          }
        }
        renderer?.render(currentWorld.world);
      });
      accumulatorMs = advance.accumulatorMs;
    } catch (error) { stopFrame(); phase = 'ready'; statusText = error instanceof Error ? error.message : String(error); trainStatus.setAttribute('role', 'alert'); trainStatus.textContent = statusText; refresh(); }
    if (phase === 'recording' || phase === 'clone') frameHandle = requestAnimationFrame(frame);
  };
  const startLoop = (): void => { input.reset(); phase = roleForCurrent ? 'recording' : 'clone';required('#teach-game-title').textContent=phase==='clone'?'Test jouw AI-model':'Jouw demonstratie'; lastTimestamp = undefined; accumulatorMs = 0; flap.disabled = phase !== 'recording'; pause.disabled = false; pause.textContent = 'Pauzeer'; canvas.focus({ preventScroll: true });canvas.scrollIntoView({block:'center',behavior:'auto'}); frameHandle = requestAnimationFrame(frame); };
  const onRecordingChange = (recording: boolean): void => {
    if (recording) {
      if (phase !== 'ready') return;
      assignNextRole(); currentRecorder = new DemonstrationRecorder(); currentRecorder.start(`human-${roleForCurrent}-${currentSeed}`, currentSeed, 'human'); currentWorld = currentRecorder.environment;
      dataset.setRecording(true); cloneResult = undefined; resetCurrent(); score.textContent = 'Score: 0 · 0 stappen'; statusText = `Opname gestart met seed ${currentSeed}.`; trainStatus.textContent = statusText; renderer?.render(currentWorld.world); startLoop(); refresh();
    } else if (phase === 'recording' || phase === 'paused') {
      stopFrame(); input.reset(); currentRecorder = undefined; roleForCurrent = undefined; phase = 'ready'; dataset.setRecording(false); flap.disabled = true; pause.disabled = true;
      statusText = 'Opname gestopt. Het onafgemaakte voorbeeld is verwijderd.'; trainStatus.textContent = statusText; refresh();
    }
  };
  controller = createImitationController({ allowTrainingOnly:true,onStateChange: notify,initialSnapshot:options.restoreState?.initialSnapshot,imitationSnapshot:options.restoreState?.imitationSnapshot });
  dataset = mountDatasetView(datasetRoot, {
    onRecordingChange,
    onChange() {
      if(phase==='training'){trainingEpoch++;controller.cancel();phase='ready';statusText='Training gestopt omdat de voorbeelden veranderden. Train opnieuw.';trainStatus.textContent=statusText;gym.cancelled(statusText);}
      cloneResult = undefined; cloneStatus.textContent = 'Je voorbeelden zijn bewaard. Train en test het AI-model opnieuw.'; refresh();
    },
  });
  const game = required<HTMLElement>('.teach__game'); game.classList.add('game-fullscreen');
  const fullscreen = el('button'); fullscreen.type='button'; fullscreen.className='secondary game-fullscreen-button'; required('.teach__actions').append(fullscreen);
  const fullscreenControl=mountGameFullscreen(game,fullscreen,message=>{score.textContent=message;});
  const recordButton=datasetRoot.querySelector<HTMLButtonElement>('.record-toggle')!;
  required('.teach__actions').prepend(recordButton);
  required('.teach__actions').append(flap);
  const examples=document.createElement('details');examples.className='context-help example-library';const examplesTitle=document.createElement('summary');examplesTitle.textContent='Bekijk en beheer voorbeelden';examples.append(examplesTitle,datasetRoot);required('.teach__panel').append(examples);
  if(options.restoreState){
    for(const episode of options.restoreState.episodes)dataset.addEpisode(episode);
    if(!options.restoreState.imitationIsStale)trainedEpisodeSignature=episodeSignature();
    trainingNumber=Math.max(0,...dataset.getEpisodes().filter(e=>e.seed>=1000&&e.seed<=1999).map(e=>e.seed-999));
    validationNumber=Math.max(0,...dataset.getEpisodes().filter(e=>e.seed>=2000&&e.seed<=2099).map(e=>e.seed-1999));
    cloneResult=options.restoreState.cloneResult;
    const saved=options.restoreState.progress;if(saved)required('#train-loss').textContent=`Update ${saved.completedUpdates}/${saved.updateBudget} · verlies training ${saved.training.loss.toFixed(3)} · validatie ${saved.validation?.loss.toFixed(3)??'niet gemeten'}.`;
    if(controller.getImitationSnapshot()){
      progressBar.value=Math.min(TEACH_UPDATE_BUDGET,controller.getImitationSnapshot()!.trainingCounts.supervisedUpdates);
      statusText=options.restoreState.imitationIsStale?'Voorbeelden gewijzigd. Train het model opnieuw.':'Imitatie klaar. Test het model op nieuwe openingen.';trainStatus.textContent=statusText;
      if(!options.restoreState.imitationIsStale)cloneStatus.textContent='Klaar om te testen.';
    }
  }

  pause.addEventListener('click', () => {
    if (phase === 'recording' || phase === 'clone') { phase = 'paused'; stopFrame(); input.reset(); flap.disabled = true; pause.textContent = 'Hervat'; statusText = 'Gepauzeerd. Kies Hervat om verder te gaan.'; trainStatus.textContent = statusText; }
    else if (phase === 'paused') { startLoop(); statusText = 'Aflevering hervat.'; trainStatus.textContent = statusText; }
    refresh();
  });
  restart.addEventListener('click', () => {
    if (!roleForCurrent || !currentRecorder) return;
    stopFrame(); input.reset(); currentRecorder = new DemonstrationRecorder(); currentRecorder.start(`human-${roleForCurrent}-${currentSeed}`, currentSeed, 'human'); currentWorld = currentRecorder.environment; renderer?.render(currentWorld.world); score.textContent = 'Score: 0 · 0 stappen'; statusText = 'Opnieuw gestart; de vorige onvolledige aflevering is weggegooid.'; startLoop(); trainStatus.textContent = statusText; refresh();
  });
  trainButton.addEventListener('click', () => {
    const epoch=++trainingEpoch;const trainingSignature=episodeSignature();
    cloneResult = undefined; progress = undefined; progressBar.value = 0; phase = 'training'; statusText = 'Training gestart.';trainStatus.setAttribute('role','status');trainStatus.textContent = statusText;gym.start(TEACH_UPDATE_BUDGET);refresh();
    void controller.train(dataset.getEpisodes(), (value) => { if(disposed||epoch!==trainingEpoch)return;progress = value; progressBar.value = value.completedUpdates;gym.progress(value.completedUpdates); required('#train-loss').textContent=`Update ${value.completedUpdates}/${value.updateBudget} · verlies training ${value.training.loss.toFixed(3)} · validatie ${value.validation?.loss.toFixed(3)??'niet gemeten'}.`;trainStatus.textContent = `Training… ${Math.round(value.completedUpdates/value.updateBudget*100)}%.`; notify(); }).then((result) => {
      if(disposed||epoch!==trainingEpoch)return;
      phase = 'ready'; trainedEpisodeSignature = trainingSignature; progressBar.value = result.actualUpdates; required('#train-loss').textContent=`${result.actualUpdates} updates · verlies training ${result.training.loss.toFixed(3)} · validatie ${result.validation?.loss.toFixed(3)??'niet gemeten'}.`;statusText = 'Training klaar. Test het model op nieuwe openingen.'; trainStatus.textContent = statusText; cloneStatus.textContent = 'Klaar om te testen.'; refresh();gym.complete(result.actualUpdates);
    }).catch((error: unknown) => { if(disposed||epoch!==trainingEpoch)return;phase = 'ready'; const cancelled = error instanceof WorkerJobCancelledError || (error instanceof Error && error.name === 'ImitationJobCancelledError'); statusText = cancelled ? (controller.getImitationSnapshot() ? 'Training geannuleerd. Het vorige opgeslagen model is behouden.' : 'Training geannuleerd. Je voorbeelden blijven bewaard; er is geen nieuw model opgeslagen.') : `Training mislukt: ${error instanceof Error ? error.message : String(error)}`; trainStatus.setAttribute('role', cancelled ? 'status' : 'alert'); trainStatus.textContent = statusText; refresh();if(cancelled)gym.cancelled(statusText);else gym.error(statusText); });
  });
  cancelButton.addEventListener('click', () => controller.cancel());
  cloneButton.addEventListener('click', () => {
    const savedSnapshot = controller.getImitationSnapshot(); if (!savedSnapshot || phase !== 'ready') return;
    const snapshot = createPolicySnapshot(restorePolicySnapshot(savedSnapshot), savedSnapshot);
    cloneResult = undefined; cloneStatus.textContent = 'Test op nieuwe openingen; model blijft gelijk.';
    cloneEnvironment = new FlappyEnvironment(); cloneEnvironment.reset({ seed: TEACH_CLONE_TEST_SEED }); currentWorld = cloneEnvironment; clonePolicy = new FrozenCloneController(snapshot); renderer?.render(currentWorld.world); score.textContent = 'Score: 0 · 0 stappen'; statusText = 'Nieuwe testreeks gestart.'; trainStatus.textContent = statusText; startLoop(); refresh();
  });
  window.addEventListener('blur', pauseForBlur);
  const visibilityChange=()=>{if(document.visibilityState==='hidden')pauseForBlur();};
  document.addEventListener('visibilitychange',visibilityChange);
  try { renderer = await createFlappyRenderer(canvas); if (!disposed) { currentWorld.reset({ seed: 1000 }); renderer.render(currentWorld.world);initializing=false; refresh(); } }
  catch (error) { trainStatus.setAttribute('role', 'alert'); trainStatus.textContent = error instanceof Error ? error.message : String(error); }
  return {
    getState,
    dispose() { if (disposed) return; disposed = true;fullscreenControl.dispose();trainingEpoch++; phase = 'disposed';gym.dispose(); stopFrame(); input.dispose(); controller.dispose(); dataset.dispose(); renderer?.dispose(); window.removeEventListener('blur', pauseForBlur);document.removeEventListener('visibilitychange',visibilityChange); root.replaceChildren(); },
  };
}
