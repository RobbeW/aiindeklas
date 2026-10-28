# P3 model and architecture gate

- Date: 2026-07-16
- Result: PASS
- Next gate: H2 owner approval
- Remote repository created: no
- Registrar or DNS accessed: no

## Information architecture

`scripts/generate-route-map.mjs` generated exactly 429 unique page records and
asserted the expected action totals:

- 144 exact paths
- 235 derived exact tag archives
- 2 redirect stubs
- 31 allowlisted legacy pagination-query mappings
- 2 locale feeds
- 2 generated system outputs
- 12 hard exclusions
- 1 failed noncanonical query exclusion

The map corrects three source-specific behaviours: the two HTTP 429 tag snapshots
remain generated routes, `/english` redirects to `/about`, and sitemap remains at
`/sitemap.xml`. It flags 17 case-insensitive tag-route collision groups for a
case-sensitive build/parity check.

## Content model

Astro 7 Content Layer schemas live at `src/content.config.ts`. Representative
records cover authors, paired NL/EN pages, an English article, a workshop, a
project, and all five setting kinds. The media registry remains intentionally
empty until P4 computes real binary hashes.

Validation evidence:

- Cross-entry validator: 6 documents, 5 body collections, 1 confirmed translation
  pair, 5 required setting kinds, 0 placeholder media records.
- Unit tests: 6 passed, 0 failed. Negative fixtures intentionally reject blank
  bodies, unpaired provenance, duplicate canonical routes, and invalid migrated
  publication.
- `astro check`: 12 files, 0 errors, 0 warnings, 0 hints.
- Root build: pass.
- `/aiindeklas/` project-base build: pass.

Astro reports one expected file-loader warning because P3 forbids invented media
hashes and the P4 media registry is still empty.

## Design evidence

All nine design sources were captured directly. Every capture had one `h1`; all
nine measured the same system UI font, sticky header, and 150 ms fast-motion
value. Seven exposed the warm family background directly and two used a layered
transparent body. Canonical tokens and component grammar are documented for H2.

## Architecture decisions

ADR-001 through ADR-010 document static architecture, CMS publishing, contact,
canonical domain direction, privacy, images, URL preservation, design-package
scope, multilingual content, and external embeds. They remain proposed until H2.

## P3 gate conclusion

The content schema validates representative records; every source page has one
route action; design decisions have direct evidence; and the architecture choices
are documented. P4 is intentionally blocked until the owner approves H2.
