# Robbe Wulgaert website migration

Local-first rebuild of `robbewulgaert.be` as a static Astro website with a
schema-driven, Git-backed content workflow.

The Squarespace source remains production-authoritative while migration work is
performed locally. No GitHub remote, registrar access, or DNS change is required
through the local owner-review phase.

## Local commands

```sh
python demo_website.py
pnpm install
pnpm dev
pnpm build:root
pnpm build:project
pnpm build:production-sim
pnpm check
pnpm test
pnpm quality:p4
pnpm quality:p5
pnpm quality:p6
pnpm quality:p7
pnpm cms:patch --help
pnpm quality:local
```

`python demo_website.py` serves the existing prototype build, hosts it at
`http://127.0.0.1:4321/`, and opens it in the default browser. Press `Ctrl+C` to
stop it. Use `python demo_website.py --rebuild` to rebuild first when the Node
dependencies are installed. `--no-build` remains available as a compatibility
alias, and `--no-browser` or `--port` can be used for review setups.

`build:root` validates the local/custom-domain profile. `build:project` simulates
the candidate `/aiindeklas/` project Pages prefix. Both builds remain
`noindex, nofollow`; creating or publishing a GitHub repository is still blocked
until H3.

`build:production-sim` checks the future `www` canonical and crawlability logic
without publishing files, configuring a custom domain, or touching DNS.

`quality:p4` is clean-checkout safe and is the prepared CI gate. `quality:local`
adds verification of the preserved raw Squarespace snapshots, which intentionally
remain outside Git and are available only in this migration workspace.

`quality:p5` reruns the deterministic content transform, validates all 155
migrated documents, and checks both the local `/` build and the simulated
`/aiindeklas/` build. Media downloads are a separate, resumable step through
`pnpm migrate:assets`; the ignored originals remain under
`migration/raw-assets/original/` while tracked derivatives power the local site.

The local CMS Studio is available at `/admin` when the demo server is running.
It browses and edits articles and workshops, previews drafts, validates fields,
and exports safe local patch bundles without a GitHub credential. See
[`docs/cms-guide.md`](docs/cms-guide.md) and
[`docs/content-authoring.md`](docs/content-authoring.md). `quality:p6` checks the
Studio, both build profiles, and the onderwijs thumbnail output.

`quality:p7` verifies the preserved source snapshots, content schemas, tests,
both base-path builds, CMS output, built HTML, internal links, fragments, SEO,
RSS, accessibility markup, security-sensitive output, and mobile Lighthouse
budgets. The Dutch and English article feeds are available at
`/onderwijs/rss.xml` and `/education/rss.xml`.

The automated P7 checks pass. P7 remains at its owner-decision boundary because
media publication rights, contextual alt text, unavailable native videos, and
case-only taxonomy routes cannot be decided safely by the migration scripts.
See [`migration/reports/P7-parity-and-quality-repair.md`](migration/reports/P7-parity-and-quality-repair.md).
