# P4 accessibility baseline

Date: 2026-07-16
Scope: reusable local application frame; migrated P5 content is not included yet.

## Result

PASS for the P4 baseline.

## Automated evidence

- `astro check`: 36 files, 0 errors, 0 warnings, 0 hints.
- Unit/build validation: 10 tests passed, 0 failed.
- Every generated page has one `h1`, one `main`, a page title, canonical metadata, and a valid language declaration.
- The build validator found 0 internal URL or asset-prefix errors across 169 internal references in each build profile.
- Global `:focus-visible` styling uses a two-colour ring so focus remains visible on both pale and strongly coloured surfaces.
- A `prefers-reduced-motion: reduce` rule removes non-essential transitions and smooth scrolling.
- The skip link is the first interactive element in source order and becomes visible when focused.

## Browser evidence

| Check | Evidence | Result |
| --- | --- | --- |
| Desktop reflow | 1440 x 1000; one `h1`; sticky header; mobile button hidden; content does not extend beyond the viewport | PASS |
| Mobile reflow | 390 x 844; document scroll width 375 within a 390 px viewport | PASS |
| Tight-height menu | 320 x 400; menu height capped at 300 px, `overflow-y: auto`, scroll content retained | PASS |
| Menu dismissal | A real Escape key event closed the open menu and returned focus to the Menu button | PASS |
| Current navigation | `/onderwijs/workshops-en-nascholingen` exposes exactly one `aria-current="page"`: `Nascholingen` | PASS |
| English page semantics | `/about` uses `lang="en"`, English footer text, one active `About` link, and the validated `pages` content collection | PASS |
| Preserved redirect | `/english` reaches `/about` without an error page | PASS |

## Visual records

- `migration/screenshots/target/p4-home-desktop.png`
- `migration/screenshots/target/p4-home-mobile.png`

## Limit of this phase

The in-app browser did not expose a reliable page-entry Tab event, so the skip link was verified structurally and through its focus CSS rather than by recording a first-Tab interaction. Full keyboard traversal, automated accessibility scanning, and migrated-content checks remain part of P7.
