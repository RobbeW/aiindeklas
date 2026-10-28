# P6 CMS Studio report

- Phase: P6
- Status: complete
- Date: 2026-07-20
- Execution mode: local first
- Remote repository configured: no
- Registrar or DNS action: none

## Result

The local static application now includes a base-aware CMS Studio at `/admin`.
It loads 124 articles and 12 workshops from a generated content endpoint, offers
collection/search/locale/status/year controls, renders schema-driven forms, and
provides a live draft preview.

The Studio can create or duplicate a draft article and edit structured workshop
fields without raw frontmatter work. Valid content exports as a deterministic
patch bundle. The local patch command rejects unsafe paths, stale source hashes,
and create-overwrite attempts; apply is transactional and followed by repository
and Astro schema validation.

## Onderwijs thumbnail addendum

The reported issue was confirmed. All 124 article records had `hero: null`; the
listing component also did not accept an image. The migrated records did contain
usable `seo.image` references. The listing pipeline now resolves those media
records through Astro's image service and renders responsive, lazy-loaded card
thumbnails. Automated output validation finds 78 Dutch onderwijs cards and 78
thumbnails.

Visual browser testing also exposed an incorrect migrated collection title
(`Project Fijnstof`) on `/onderwijs`. Collection pages now use deterministic
titles (`Onderwijs`, `Education`, and `Projects`) in both generated content and
the repeatable migration script.

## Gate evidence

- New draft article: created, previewed, validated, and prepared for patch export
  in browser testing.
- Workshop: opened and edited through structured controls; the modified record
  validated in browser testing.
- Unit tests: 17 passing, including deterministic patch, unsafe path, duplicate,
  new-draft, and workshop-edit coverage.
- Astro check: zero errors, warnings, or hints.
- Root build: passed built-site validation.
- CMS output: 136 editable records and 829 existing media choices.
- Indexing: `/admin` remains `noindex, nofollow`.

## Publishing boundary

No credential or remote publishing code was added. Patch application and Git
review happen locally. Repository creation, Pages publication, registrar access,
CNAME creation, and DNS remain postponed behind H3/H4.

## Next phase

P7 parity and quality repair, including the existing media alt/rights queue,
unavailable native videos, case-sensitive taxonomy collision validation, SEO,
accessibility, performance, and broader visual checks.
