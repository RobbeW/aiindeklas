# AI in de Klas — two-game browser learning lab

Dutch learning material for ages13–15 with light coding experience. Students study AI concepts through human demonstrations, supervised imitation, continued reinforcement learning and car population evolution. Python programming is not required.

## Run and check locally

```sh
npm ci
npm run dev
npm run typecheck
npm test
npm run build
```

Run these commands from this directory. Use a Node release supported by the pinned toolchain (the destination workflow currently uses Node>=22.13.0<23). Local validation used Node25.8.1/npm11.11.0 on macOS. Open the address printed by Vite. The app needs no account, API key, Python installation or application server. Production `dist/` is static and uses relative paths for a project subfolder. An HTTP server is still needed to serve it; opening index.html directly as a file is not the supported route.

## Learner route

Start with **Flappy Bird**: play against the untrained random controller, record one, three and more human sessions, train after each collection, and test the saved model. The visible data counter and test history support comparing data quantity with actual game performance. Every new recording is training data; one complete recording is sufficient, including a poor all-wait example. An absent holdout is not reported as a measured validation result. Legacy control recordings remain excluded from fitting.

Continue the same imitation weights through actual **6/12/18/24-agent reinforcement learning**. Every agent collects an independent complete trajectory using the frozen shared policy for that round. One reward-to-go gradient update follows, then the next round uses the updated policy. The live canvas shows these training worlds. Select16/32/64rounds and1/4/16/64× viewing speed for live training. Select256/1024rounds for automatic fast training: the live canvas is hidden, the established gym shows real RL progress, and computation skips display pacing/delays and world-frame transport. Fast jobs use time-sliced workers with throttled progress, pause/stop, checkpoints and a two-minute active-time cap; incomplete budgets are explicitly labelled. Speed changes pacing, not physics or gradient rules. Round/attempt/time/reward/update indicators and saved run summaries expose the loop. Only completed trajectories train; stop/navigation retains the last committed checkpoint. The old frozen-flock demonstration modules remain in source for historical reference but are not the exercise3 training interface.

Exercise4 compares **A initial / B imitation / C post-RL / D human** simultaneously on the same three validation sequences (2030–2032). Model evaluation retains the existing deterministic frozen decision rule; the initial model therefore differs from the sampled random opponent in exercise1. Each field shows score and survival time. Human input cannot affect the other worlds; tests never update model weights. These are repeated diagnostic tests, not a final unseen classroom efficacy claim.
Continue with **Raceauto**: drive, collect/inspect examples, fit a separate6-input/3-action categorical policy, practise with rewards, build a circuit with straight/90-degree tiles and inspect population generations. Fixed-topology evolution changes83weights; it is explicitly not NEAT. In **5 · Evolueer**, **Toon generatie live** is on by default: all cars in the actual generation move together with translucent bodies, a leader ring and overlap counts. Pause/resume, 0.5–8× speed and generation-step controls change viewing pace, not physics or selection. Turn live mode off for fast sequential evaluation. All controllers use the same continuous simulation. The human sees the full scene while policies receive limited observations. There is no guaranteed improvement: frozen car experiments passed one longer route but failed unfamiliar bends. This is an educational abstraction, not evidence of real-road safety.

## Save, restore and recover

**Mijn experiment** displays per-game local data, JSON export/import and scoped erase. Browser storage is isolated by origin and profile; development5173, preview4173 and the eventual published site do not share stored experiments. Export/import to move work. If storage is denied/full, the app labels memory-only operation; export before closing. Browser clearing is not cloud backup. No student name/account is required. Files are version-checked JSON, maximum32MiB and64complete examples; incompatible imports preserve current work. Demonstrations/models/budgets/control results and generation summaries are retained; accelerated-practice action replays remain in page memory only. Deleting one game leaves the other game and downloaded files unchanged.

Use **Begin met jouw imitatie** before comparing independent RL budgets. Stop or switch games to end an active job; unfinished supervised jobs and incomplete reward batches/generations do not become new trained models. For slow devices choose6birds×16rounds or4cars×1generation and keep physics/test criteria unchanged. No offline guarantee or measured Windows/controller performance is claimed. Pair roles and static evidence support participation without motor-speed assessment; full nonvisual game equivalence is not established.

## Release preparation and credits

The local package targets `RobbeW/aiindeklas`, subfolder `zelflerende-games/`, while preserving its existing website and manual Pages workflow. Source, built subpath preview, additive patches and hashes are prepared in `../release/aiindeklas-integration/`; see `../docs/engineering/deployment.md`. Those paths belong to this preparation workspace; they are not included in the copied game source folder. The complete target website/CI was not built here, and nothing has been published.

`public/credits.json` records the supplied Flappy Bird sprites restored at the user’s request. The bird, green pipes and ground use those PNGs; the background remains code-native. Sprite redistribution rights still require clearance before public release. `public/licenses/flappy-source-MIT.txt` preserves the supplied software notice. Historical Python, supplied models/PDFs and source credits remain separate and unchanged. Canonical task status is `../tasks.yaml` in this workspace; teaching guides and the release gate are under `../docs/`.

Learner screens use short Dutch instructions. Flappy explanations and questions have their own before/after pages; the former research-question panel is removed. Reset Flappy Bird lives in the hamburger menu and requires confirmation. Model source, training versus frozen play, synthetic examples, errors and data-deletion scope stay visible where needed. Detailed activities remain in the teacher guides.

The current UI supports `?view=flappy&step=teach` and `?view=car&step=population` deep links, browser history, example deletion undo and scoped experiment removal. An initial splash clears when the app is ready and provides startup failure/retry feedback. See `../docs/validation/ui-improvements.md`. The separate root `index.html` is a read-only Blockly landing-page design reference, analyzed in `../docs/design/landing-reference.md`; it is not part of this app package.

The default URL now opens the dedicated **Zelflerend in de Klas** landing. `?view=games` opens the game chooser; existing game/stage URLs still open exercises directly. Teacher lesson cards are available at `leskaarten.html` with print styles. Copy follows the author's practical Dutch reference voice. See `../docs/validation/landing-page.md`; the supplied root reference remains unchanged.

## Flappy lesson pages

The first four Flappy exercises have Vooraf → Experiment → Terugblik. The optional `lesson=before|experiment|after` query restores the subpage; existing `view=flappy&step=...` links open Vooraf. Predictions/reflections are plain-text notes saved with the version-1 experiment and exported/imported; older files without notes remain supported. Questions are optional, not graded or automatically judged. Leaving an experiment stops active work; complete recordings/checkpoints remain, incomplete recordings are discarded. The optional Rondleiding pauses playable controls and waits for supervised training to finish/cancel before opening; Escape closes and restores focus, and reduced-motion CSS disables the pulse. It does not start/resume the simulation.

### Three-player finale

`?view=flappy&step=arena` opens exercise5, **Daag het AI-model uit**. Three students join with separate controllers and play against the saved post-RL model. Joining and readying require separate button presses. Start begins a shared countdown; each fresh action-button press flaps once. Standard controllers use the bottom face button (A/×); unknown mappings learn the pressed button. Start pauses/resumes; blur, hiding the tab or losing a controller pauses all worlds. Reconnect requires a deliberate press, followed by an explicit resume countdown.

All four fields use the same sequence, physics and clock. The model stays frozen. Score then survival time determines rank; exact ties share rank. **Nieuwe spelers** clears human assignments and begins a new sequence; **Nog een ronde** retains assignments. These matches do not write demonstrations, lesson answers or formal comparison records. There is no reflection screen. An optional keyboard trial uses F/J/L for the three human seats. Actual three-controller mapping, latency/reconnection and school-device performance remain a later field test (UX44).

### Flappy explanations (26 October 2026)

The first Before page uses an automatic game illustration with three short questions. The second shows a human controller, observing computer, five named inputs and Training folder. These passive scenes expose no numeric inspector or synthetic recording controls. Reduced motion shows a static drawing.

Exercise3 explains the actual +0.01 per surviving60Hz step, +1 extra crossing and−1 collision rules, separately from game score. The adapted Skinner illustration includes green+lever→food, red+lever→floor shock and red+wait→no shock. It is a classroom analogy, not an exact historical protocol. Normal playback is automatic; reduced-motion users can advance states manually. It does not learn a policy or alter game rewards.

Train model opens the supervised gym with real worker progress and cancellation. Exercise3 shows its real RL loop directly. Reflections ask about the amount of demonstration data, epochs/time/performance, and whether the four-player prediction matched the result. More data or more training is never a guaranteed improvement. The Mario Kart exercise asks students to transfer training-data/reward/punishment/multiple-agent concepts to another game. Technical sources and validation stay in the preparation workspace's docs, rather than a long student-page appendix.

### Long Flappy training (26 October 2026)

The 256/1024-round options automatically use the fast gym. Physics, RNG/action streams and REINFORCE updates stay identical; only display work and intentional pacing are removed. The diagram describes reward learning, not fitting human labels. Pause training and pause animation are separate. Stop/Escape retain the latest published model, completed rounds and actual stop reason; Test jouw AI-model opens the existing frozen four-field comparison.

The default simulation-step budget covers rounds × agents ×1800 (maximum44,236,800). Fast jobs stop after120,000ms of active time, excluding pauses. Time/step limits never count an unfinished full round as complete; complete trajectories may still contribute a final update. Checkpoints/results use the same original imitation continuation, not a fresh model. At most64recent attempt/round records are transmitted alongside a whole-run mean; live world frames are absent in fast messages. Stored summaries now include optional mode/requested-round/stop-reason fields and remain compatible with earlier files. Continuous changes flush to local storage at bounded intervals, rather than indefinitely postponing writes.

### Reward-learning repair

The parallel Flappy route now centers/scales the current batch's reward-to-go and applies a stateful Adam update. The former tiny clipped-SGD updates could complete1024rounds while the frozen model still scored zero. No extra demonstrations, scripted actions, altered rewards, or replacement starting weights are used. Optimizer moments reset per job; learned weights and provenance continue from the saved model. The historical sequential updater and raw mathematical objective remain available for their original tests.

At completion the worker separately runs the input and output policies with the existing deterministic match rule on five identical validation sequences2080–2084. These checks never train or select a checkpoint. The gym, experiment and saved history distinguish this before/after score and flight time from the whole-run practice average. Stops without a completed check retain the last checkpoint but make no new test claim. Earlier files still import; old training summaries cannot acquire retrospective test scores. A failed or short training can still score zero: the fixed checks report that honestly. See `../docs/validation/learning-stall.md` in the preparation workspace for measured cases and limits.

Fast training still runs locally on the laptop; school Windows performance and useful learning across student datasets remain unproven. More rounds can fail to improve play. Compare time/performance with matching bird counts and display settings, and keep training reward separate from frozen test score.


## Car controls, shared race and storage (27 October 2026)

Human play uses arrows or WASD: left/right steer, up/W accelerates and down/S brakes to a stop. Xbox standard mapping uses left stick or D-pad, RT gas and LT brake. Neutral coasts. The existing three-action AI keeps its original automatic acceleration, as do the explicitly labelled steering-only demonstration recordings; old recordings/models retain their dynamics.

Car exercise5 now offers one human against the saved best model, or three humans against that model, on one shared circuit. Assign arrows/WASD or distinct standard controllers (A joins a free seat), then start a synchronized countdown. Each car has an independent collision world: cars pass through one another. A lap wins by time; otherwise route progress determines rank, with shared ranks for exact ties. Controllers disconnecting, blur and hidden tabs pause the race. Resume has a fresh countdown; rematch keeps assignments and New players clears them. Human pedals versus the AI's automatic throttle are explicitly shown. Old milestone measurements remain under Bewaarde modellen vergelijken. Race frames/controller identities never become training data. Actual three-Xbox hardware mapping, latency and Windows school performance remain a field test.

Growing per-game experiments now use queued IndexedDB transactions, with validated migration from existing localStorage. Writes first retain the newest exportable in-memory copy; the UI only reports saved after commit. Compact version1 JSON replaces pretty formatting; the import/export bound is32MiB. A blocked database leaves work in memory and shows an error; no potentially stale local copy is silently substituted after database failure. Use Mijn experiment to export before closing an unsaved page. Delete waits for a durable tombstone and removes only the chosen game's legacy key; failed deletion retains the exportable copy and requires another deliberate deletion. Navigation/import are locked during deletion. Browser clearing still removes data; there is no cloud backup.


### Faster driving settings (27 October 2026)

New human play and newly trained populations use car-world-v2: acceleration60units/s², top speed90units/s and steering rate2rad/s. Full throttle reaches top speed in1.5s, compared with the previous2.75s. Steering increases with the speed setting to keep tight tile corners drivable; swept collision still checks the movement segment. Neutral coasts and brakes stop without reverse. These are game units, not km/h.

Existing v1 snapshots, demonstrations, replay, continued reward practice and measurements keep their original20/55/1.2settings and speed normalization. Old-model races use that same older profile for all human and AI participants, with an earlier-speed notice and a Train met de nieuwe snelheid button. Start a new population to get a faster trained opponent. Existing optional imitation sessions keep their saved initial model's settings for new recordings; mixed-world imitation data is rejected. Comparison charts separate driving profiles; the table retains and labels earlier measurements. No model weights, historical scores or recorded actions are silently converted.

## Large screens and show-floor mode

Fullscreen buttons now open a dedicated game region, keeping playfields, player labels and essential controls visible while leaving lesson headings and explanations outside. Native Escape/toggle exits and restores focus. Ordinary game views also use available large-screen space. Fast-training dialogs remain inside the current fullscreen region.

Append `?demo=1` to the game URL to run the separate TV presentation. It loops through Flappy Bird: an untrained model, visitor demonstrations, actual imitation, reward/punishment and real independent training, then a three-minute competition. The car sequence follows with driving, different circuits, Darwin/evolution, actual generations and another three-minute race. Each section has a short illustrated transition and visible scene-time progress. A timer is presentation time, not a claimed learning metric. Training counters come from the real workers, and a necessary model is awaited rather than fabricated. Timers pause when the page is hidden/unfocused or the operator pauses.

Up to three standard Xbox controllers join with A; A flaps, and car controls use the left stick/D-pad and RT/LT. A join never becomes an action. On disconnect, the clearly labelled reference driver takes that seat; a fresh A press rejoins and restarts the round together. Without visitors, labelled reference play keeps the screen moving. The imitation step combines completed visitor attempts with two visibly declared reference attempts; references are never labelled student data. Reinforcement learning continues that same actual imitation model. Car candidates each have their own model. Competitions use frozen trained weights, identical game conditions and independent collision worlds.

Open **Bediening → Volledig scherm** once after opening the TV page; browser policy requires that gesture. **Bediening** also contains pause, next scene, an explicit keyboard trial (Flappy F/J/L; cars arrows/WASD/IJKL), restart and exit. Skip waits for a real required model. The loop is session-only: it neither opens nor writes classroom experiment storage and discards visitor examples on restart/new loop. There are no accounts or names. Restart/scene changes cancel obsolete jobs, delayed artwork cannot fault another scene, and reduced motion keeps static explanatory stages and a readable progress bar. If loading/training fails, the demo reports it and retries a fresh loop rather than inventing a model.

User-reported basic school-laptop/controller classroom tests succeeded on27October2026. The complete three-controller TV setup, browser/driver combination and long unattended performance still need a show-floor rehearsal; synthetic UI tests do not measure that hardware.

The TV presentation uses brief visitor captions, compact observation/reward/Darwin illustrations and contextual joining cues. One real attempts/generation count is shown; detailed updates and data-source accounting stay in Bediening. Idle seats retain a Voorbeeldspel badge. Finished training switches to Test and Zo speelt de computer nu; classroom explanation variants remain available in the normal lessons.


### Supplied showroom artwork (29 October 2026)

The demo uses the supplied transparent PNGs from public/assets/demo/. Its ten splash scenes use a scene-to-art catalog; Darwin cycles through four still frames at the existing four-second stage boundaries. The shared-model illustration sits beside the real live flock, and player names/reward labels remain HTML. Normal classroom explanations and all game/training engines are unchanged.

Only the current scene is loaded; Darwin decodes its four frames together before starting that explanation. Image loading has an eight-second bound and pauses scene time. A missing image leaves a readable explanation and allows the loop to continue. These supplied pictures are conceptual illustrations, not literal network architectures, measured results or exact map data. The original PNG bytes are preserved.
