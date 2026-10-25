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

Start with **Flappy Bird**: play the fair duel against an explicitly untrained random controller, record complete examples, fit an imitation model, test the frozen clone, continue the same weights through fast sequential attempts and compare fixed models. Worked examples are labelled synthetic and still require actual fitting; they are not pretrained weights or student data.

Continue with **Raceauto**: drive, collect/inspect examples, fit a separate6-input/3-action categorical policy, practise with rewards, build a circuit with straight/90-degree tiles and inspect population generations. Fixed-topology evolution changes83weights; it is explicitly not NEAT. In **5 · Evolueer**, **Toon generatie live** is on by default: all cars in the actual generation move together with translucent bodies, a leader ring and overlap counts. Pause/resume, 0.5–8× speed and generation-step controls change viewing pace, not physics or selection. Turn live mode off for fast sequential evaluation. In Flappy **3 · Oefen zelfstandig**, **Start twaalf vogels** runs twelve fresh attempts using the same frozen checkpoint and common openings, with independent action choices; it does not train or create generations. Pause, single-step and reset are available. All controllers use the same continuous simulation. The human sees the full scene while policies receive limited observations. There is no guaranteed improvement: frozen car experiments passed one longer route but failed unfamiliar bends. This is an educational abstraction, not evidence of real-road safety.

## Save, restore and recover

**Mijn experiment** displays per-game local data, JSON export/import and scoped erase. Browser storage is isolated by origin and profile; development5173, preview4173 and the eventual published site do not share stored experiments. Export/import to move work. If storage is denied/full, the app labels memory-only operation; export before closing. Browser clearing is not cloud backup. No student name/account is required. Files are version-checked JSON, maximum8MiB and64complete examples; incompatible imports preserve current work. Demonstrations/models/budgets/control results and generation summaries are retained; accelerated-practice action replays remain in page memory only. Deleting one game leaves the other game and downloaded files unchanged.

Use **Herstel imitatie als startpunt** before comparing independent RL budgets. Stop or switch games to end an active job; unfinished supervised jobs and incomplete reward batches/generations do not become new trained models. For slow devices choose16attempts or4agents×1generation and keep physics/test criteria unchanged. No offline guarantee or measured Windows/controller performance is claimed. Pair roles and static evidence support participation without motor-speed assessment; full nonvisual game equivalence is not established.

## Release preparation and credits

The local package targets `RobbeW/aiindeklas`, subfolder `zelflerende-games/`, while preserving its existing website and manual Pages workflow. Source, built subpath preview, additive patches and hashes are prepared in `../release/aiindeklas-integration/`; see `../docs/engineering/deployment.md`. Those paths belong to this preparation workspace; they are not included in the copied game source folder. The complete target website/CI was not built here, and nothing has been published.

`public/credits.json` records the supplied Flappy Bird sprites restored at the user’s request. The bird, green pipes and ground use those PNGs; the background remains code-native. Sprite redistribution rights still require clearance before public release. `public/licenses/flappy-source-MIT.txt` preserves the supplied software notice. Historical Python, supplied models/PDFs and source credits remain separate and unchanged. Canonical task status is `../tasks.yaml` in this workspace; teaching guides and the release gate are under `../docs/`.

Learner screens use short Dutch instructions. **Onderzoeksvraag**, **Hoe werkt dit?** and measurement disclosures keep deeper explanations available on demand. Model source, training versus frozen play, synthetic examples, errors and data-deletion scope stay visible where needed. Detailed activities remain in the teacher guides.

The current UI supports `?view=flappy&step=teach` and `?view=car&step=population` deep links, browser history, example deletion undo and scoped experiment removal. An initial splash clears when the app is ready and provides startup failure/retry feedback. See `../docs/validation/ui-improvements.md`. The separate root `index.html` is a read-only Blockly landing-page design reference, analyzed in `../docs/design/landing-reference.md`; it is not part of this app package.

The default URL now opens the dedicated **Zelflerend in de Klas** landing. `?view=games` opens the game chooser; existing game/stage URLs still open exercises directly. Teacher lesson cards are available at `leskaarten.html` with print styles. Copy follows the author's practical Dutch reference voice. See `../docs/validation/landing-page.md`; the supplied root reference remains unchanged.

## Flappy lesson pages

The first four Flappy exercises have Vooraf → Experiment → Terugblik. The optional `lesson=before|experiment|after` query restores the subpage; existing `view=flappy&step=...` links open Vooraf. Predictions/reflections are plain-text notes saved with the version-1 experiment and exported/imported; older files without notes remain supported. Questions are optional, not graded or automatically judged. Leaving an experiment stops active work; complete recordings/checkpoints remain, incomplete recordings are discarded. The optional Rondleiding pauses playable controls and waits for supervised training to finish/cancel before opening; Escape closes and restores focus, and reduced-motion CSS disables the pulse. It does not start/resume the simulation.

### Three-player finale

`?view=flappy&step=arena` opens exercise5, **Daag het AI-model uit**. Three students join with separate controllers and play against the saved post-RL model. Joining and readying require separate button presses. Start begins a shared countdown; each fresh action-button press flaps once. Standard controllers use the bottom face button (A/×); unknown mappings learn the pressed button. Start pauses/resumes; blur, hiding the tab or losing a controller pauses all worlds. Reconnect requires a deliberate press, followed by an explicit resume countdown.

All four fields use the same sequence, physics and clock. The model stays frozen. Score then survival time determines rank; exact ties share rank. **Nieuwe spelers** clears human assignments and begins a new sequence; **Nog een ronde** retains assignments. These matches do not write demonstrations, lesson answers or formal comparison records. There is no reflection screen. An optional keyboard trial uses F/J/L for the three human seats. Actual three-controller mapping, latency/reconnection and school-device performance remain a later field test (UX44).

### Training and reward explanations (25 October 2026)

Flappy Train model opens a gym illustration with actual worker progress, cancellation and a result screen. The explanation describes supervised examples/comparison/number updates; the weights metaphor is explicitly numeric. Pause animation affects only the illustration.

Exercise3 Vooraf explains numeric reward/negative reward and maximising total reward, including actual game rules and the distinction from score. An original interactive isometric Skinner box replaces the rat with the supplied bird. Play/pause, step and reset operate an explicitly illustrative fixed sequence; they do not train a model or change game rewards. Drawing playback stops on hiding/leaving the page. Reduced-motion users receive static state changes. Terugblik asks about reward design and evidence across attempts. Primary source links are in the optional detail. Current tests:148.

### Three interactive theory scenes (25 October 2026)

Flappy Before pages now show: step1 what five measurements the model receives (real frozen synthetic game situations and actual fixed-model probability); step2 which pre-action observation/action pairs a recording stores, with separate training/control roles and own saved recordings where available; step3 how the same imitation continues with reward feedback. Manual controls change only the explanations. Step2 has an optional observation revisit using the current imitation; step3 retains reward/Skinner material in a disclosure, disposed on closing. No new background training or saved data changes. Tests:155.

### Reviewed schematic language and explainers4–7 (25 October 2026)

Schematics use direct AI-model/Training/Controle/Test labels and readable object platforms. Step2 has example-coverage and role explanations. Step3 reward theory now includes real reward accumulation; a separate shared-model explainer shows twelve actual independent choices and is also available beside the live flock. Step4 explains Training/Controle/Test using the fixed test sequences. These controls do not train, save data or change game rules. Current checks:158tests/build. The YAML design handoff and audit live in the preparation workspace under docs/design; they are not runtime dependencies.
