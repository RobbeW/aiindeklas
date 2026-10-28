# P1 phase report — Complete source discovery

- Phase: P1
- Status: complete; H1 approval required before P2
- Generated: 2026-07-15T19:43:35.755Z
- Source: `https://www.robbewulgaert.be/`
- Target commit: pending local discovery commit

## Gate results

| Gate | Result | Evidence |
| --- | --- | --- |
| Fixed seeds represented | pass | 9 of 9 |
| Known article seeds represented | pass | 22 of 22 |
| Sitemap captured | pass | HTTP 200, hashed raw XML |
| Robots captured | pass | HTTP 200, hashed raw text |
| Dutch RSS captured | pass | HTTP 200, hashed raw RSS |
| English RSS captured | pass | HTTP 200, hashed raw RSS |
| Pagination represented | pass | 34 article-index and pagination records |
| Previous/next and tags traversed | pass | 132 article and 235 tag-archive records |
| Graph closure | pass | Queue exhausted; 392 URLs added beyond seeds |
| URL ledger accounting | pass | 5,590 rows for 429 page records and 5,161 referenced assets |
| Unclassified same-origin URLs | pass | 0 |

## Snapshot status discovered during P1

- Successful page responses stored and hashed: 413
- Confirmed HTTP 404 responses: 12
- Rate-limited tag archives after bounded backoff: 2
- Fetch failures after three changed-method crawl passes: 2
- Referenced source assets: 5,161

The crawl was repeated with malformed embedded-URL filtering, reduced concurrency,
bounded 429/5xx backoff, capped Windows-safe filenames, and retried file writes.
This reduced the exception set from 41 to 16 without concealing failures.

## Source structure

- Dutch and English article collections expose RSS, pagination, adjacency links,
  and crawlable tag archives.
- The current graph contains 132 article routes.
- The workshop catalogue is a distinct large structured page.
- Legacy photography and videography portfolio links remain discoverable but now
  return HTTP 404.
- Squarespace media uses a site-specific `images.squarespace-cdn.com` namespace;
  these references are included in the asset inventory.

## H1 decision

The 16 records in `migration/manual-review-queue.csv` require owner approval.
Recommended handling is conservative: do not invent missing content, derive tag
and pagination views from successfully migrated articles, redirect the obsolete
English contact route, and retain inaccessible portfolio URLs in the exception
and route ledger until an archival source is supplied.

## Produced artifacts

- `scripts/discover-source.mjs`
- `migration/source-manifest.json`
- `migration/url-ledger.csv`
- `migration/raw-html/**`
- `migration/reports/source-metadata.json`
- `migration/reports/discovery-report.md`
- `migration/manual-review-queue.csv`

## Next phase

P2 is blocked only by H1 approval of the proposed exception handling.

