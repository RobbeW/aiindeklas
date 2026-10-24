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
