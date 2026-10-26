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

Continue the same imitation weights through actual **6/12/18/24-agent reinforcement learning**. Every agent collects an independent complete trajectory using the frozen shared policy for that round. One reward-to-go gradient update follows, then the next round uses the updated policy. The live canvas shows these training worlds. Select16/32/64rounds and1/4/16/64× viewing speed; speed changes pacing, not physics or gradient rules. Round/attempt/time/reward/update indicators and saved run summaries expose the loop. Only completed trajectories train; stop/navigation retains the last committed checkpoint. The old frozen-flock demonstration modules remain in source for historical reference but are not the exercise3 training interface.

Exercise4 compares **A initial / B imitation / C post-RL / D human** simultaneously on the same three validation sequences (2030–2032). Model evaluation retains the existing deterministic frozen decision rule; the initial model therefore differs from the sampled random opponent in exercise1. Each field shows score and survival time. Human input cannot affect the other worlds; tests never update model weights. These are repeated diagnostic tests, not a final unseen classroom efficacy claim.
Continue with **Raceauto**: drive, collect/inspect examples, fit a separate6-input/3-action categorical policy, practise with rewards, build a circuit with straight/90-degree tiles and inspect population generations. Fixed-topology evolution changes83weights; it is explicitly not NEAT. In **5 · Evolueer**, **Toon generatie live** is on by default: all cars in the actual generation move together with translucent bodies, a leader ring and overlap counts. Pause/resume, 0.5–8× speed and generation-step controls change viewing pace, not physics or selection. Turn live mode off for fast sequential evaluation. All controllers use the same continuous simulation. The human sees the full scene while policies receive limited observations. There is no guaranteed improvement: frozen car experiments passed one longer route but failed unfamiliar bends. This is an educational abstraction, not evidence of real-road safety.

## Save, restore and recover

**Mijn experiment** displays per-game local data, JSON export/import and scoped erase. Browser storage is isolated by origin and profile; development5173, preview4173 and the eventual published site do not share stored experiments. Export/import to move work. If storage is denied/full, the app labels memory-only operation; export before closing. Browser clearing is not cloud backup. No student name/account is required. Files are version-checked JSON, maximum8MiB and64complete examples; incompatible imports preserve current work. Demonstrations/models/budgets/control results and generation summaries are retained; accelerated-practice action replays remain in page memory only. Deleting one game leaves the other game and downloaded files unchanged.

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
