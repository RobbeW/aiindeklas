# P5 automated content migration

Date: 2026-07-16  
Status: complete; migrated records remain in review and noindex state

## Result

The preserved Squarespace snapshots have been transformed into the local Astro
content collections and rendered by the application. Photography and
videography portfolio routes and copy were excluded in line with H1. No GitHub
remote, Pages publication, registrar access, CNAME, or DNS change was made.

## Migrated content

- 9 fixed/index pages
- 124 semantic articles: 78 `nl-BE` and 46 `en`
- 12 structured workshop records
- 9 approved educational project records
- 1 author record
- 155 body-bearing records in total
- 243 generated tag/category archive routes
- 3 confirmed translation pairs

Every migrated document has a `migration_status` other than `not_started`, a
source URL and source HTML hash where applicable, and a nonblank body. Records
remain `status: review` and `seo.noindex: true` until P7 and owner review.

## Assets

- 847 selected source-owned media URL records were inventoried.
- 829 URL records downloaded successfully, representing 743 unique binary
  hashes and approximately 1.09 GB of preserved originals.
- 735 tracked image derivatives occupy approximately 240 MB.
- 8 tracked audio derivatives occupy approximately 12 MB.
- Originals are hash-addressed under the ignored
  `migration/raw-assets/original/` directory and are excluded from deployment.
- 18 Squarespace native-video source records remain unavailable after three
  retries and are explicitly listed in the review queue; source templates and
  variant declarations are preserved in `migration/asset-candidates.json`.
- 753 downloaded URL records require alt-text review; 829 require publication
  rights review. These are explicit flags, not guessed approvals.

## Routing and rendering

The application generates 381 logical HTML routes. The Windows filesystem
contains 364 distinct HTML files because 17 legacy tag pairs differ only by
letter case; risk R015 remains open for the case-sensitive P7 parity run.

Both supported preview profiles pass:

- root profile: 364 HTML files, 6,025 internal URLs checked, zero errors
- `/aiindeklas/` profile: 364 HTML files, 6,025 internal URLs checked, zero
  errors

The local `demo_website.py` server returned HTTP 200 for `/` and for
`/onderwijs/1-jaar-ai-in-de-klas` after the P5 build.

## Gate evidence

- `pnpm quality:p5`: passed
- snapshot verification: 413 verified snapshots, 16 approved exceptions, zero
  unresolved exceptions or hash mismatches
- content validation: 155 documents and 829 media records
- tests: 12 passed, 0 failed
- Astro check: 0 errors, 0 warnings, 0 hints
- root and project-prefix builds: passed

Evidence files:

- `migration/reports/P5-content-inventory.json`
- `migration/asset-ledger.json`
- `migration/asset-ledger.csv`
- `migration/P5-review-queue.csv`
- `migration/reports/build-root.json`
- `migration/reports/build-project.json`

## Next phase

P6 is unblocked: build the local CMS Studio against the migrated schemas and
review-state content. Publishing and remote repository work remain postponed
until H3.
