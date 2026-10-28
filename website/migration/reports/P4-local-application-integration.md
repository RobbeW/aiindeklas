# P4 local application integration

## Phase result

- Phase: P4
- Status: complete
- Completed task: P4-T01
- Date: 2026-07-16
- Remote repository: not configured
- Registrar or DNS changes: none
- Next unblocked phase: P5

## What was integrated

- Approved design tokens, global styles, responsive header, navigation, footer, page hero, cards, notices, and shared layouts.
- Typed Astro content collections with a view-model adapter; the homepage and `/about` already read validated collection entries.
- Locale-aware HTML, navigation, footer, canonical, alternate-language, Open Graph, and article metadata helpers.
- Base-aware URL generation for `/`, GitHub project Pages at `/aiindeklas/`, and the future custom-domain root.
- Static no-trailing-slash file output, including redirect pages, `robots.txt`, and `sitemap.xml`.
- Local validation commands, unit tests, three build profiles, and a CI workflow that is ready for a future repository but does not require one now.

The 14 current HTML outputs are the application frame and representative content only. P5 will migrate the full source corpus and assets.

## Gate evidence

| P4 gate | Evidence | Result |
| --- | --- | --- |
| Builds and serves locally without a remote | Root build generated 14 HTML files; local browser checks completed; `remote_configured: false` | PASS |
| Simulated `/aiindeklas/` build has valid prefixes | Project build checked 169 internal URLs with 0 errors | PASS |
| Accessibility baseline | See `migration/reports/P4-accessibility-baseline.md` | PASS |

## Build profiles

| Profile | Site/base | HTML | Internal URLs | Indexing | Errors |
| --- | --- | ---: | ---: | --- | ---: |
| Root development | `http://localhost:4321/` + `/` | 14 | 169 | 14 noindex | 0 |
| Project Pages simulation | `https://robbew.github.io/` + `/aiindeklas/` | 14 | 169 | 14 noindex | 0 |
| Future production simulation | `https://www.robbewulgaert.be/` + `/` | 14 | 169 | 8 indexable, 6 noindex | 0 |

Machine-readable reports:

- `migration/reports/P4-build-root.json`
- `migration/reports/P4-build-project.json`
- `migration/reports/P4-build-production-sim.json`

## Quality and preservation

- Route map: 429 records; exact source totals preserved; 17 Windows case-collision groups remain explicitly tracked for P5/P7.
- Snapshot preservation: 413 verified pages, 16 approved exceptions, 0 unresolved, missing, or mismatched snapshots.
- Content validation: 6 representative documents and 5 settings kinds pass.
- Tests: 10 passed, 0 failed.
- `astro check`: 0 errors, warnings, or hints.
- Raw snapshot verification is intentionally part of `quality:local`, while the future clean-checkout CI job uses tracked inputs only.

## Known, expected condition

The media registry is empty until P5, so Astro prints a file-loader warning. This is not a missing P4 dependency and is recorded rather than hidden.

## Boundary respected

P4 did not create a GitHub target repository, configure a Git remote, publish GitHub Pages, access a registrar, create a `CNAME`, or change DNS. Those actions remain postponed until the relevant human gates.
