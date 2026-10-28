# Information architecture

Status: accepted at H2.

## Inventory accounting

The route map assigns one deterministic action to every one of the 429 page
records. The 5,161 asset references remain in the URL ledger for P4 and are not
counted as public routes.

| Action | Count |
| --- | ---: |
| Preserve exact content path | 136 |
| Derive taxonomy archive at exact path | 243 |
| Redirect stub | 2 |
| Map allowlisted legacy pagination query | 31 |
| Replace with locale feed | 2 |
| Generate sitemap or robots output | 2 |
| Hard route exclusion | 12 |
| Exclude failed noncanonical query | 1 |
| **Total** | **429** |

`migration/route-map.csv` also records the final source URL, target canonical
path, sitemap inclusion, locale, and a collision identifier for case-sensitive
tag routes. Its generator fails if the row count, unique source count, action
set, or expected totals drift.

## Exact-path policy

- Preserve `/`, `/404`, `/about`, `/boek`, `/contact`, `/contactinfo`,
  `/education`, `/onderwijs`, `/onderwijs/workshops-en-nascholingen`, `/over`,
  `/projects`, `/verkoopsvoorwaarden`, all 124 articles, and all 243 taxonomy paths.
- Preserve original spelling, case, percent encoding, `+` characters, diacritics,
  and article slugs.
- Render `/over` as a home-content alias with canonical `/`; omit it from the
  sitemap.
- Render `/404` as the custom fallback with `noindex`; omit it from the sitemap.
- Generate `/sitemap.xml` and `/robots.txt` at their exact legacy paths.
- Use no-trailing-slash logical canonicals, matching the source evidence. The
  static output strategy must be parity-tested on GitHub Pages before H3.

## Redirects and exclusions

Generate base-aware, one-hop static stubs for:

- `/contact-english` to `/contactinfo` (H1 approved).
- `/english` to `/about` (source `final_url` evidence; proposed at H2).

The 11 photography/videography paths and `/info` are hard exclusions. They get
no replacement copy or redirect and fall through to the custom 404. The single
failed noncanonical Dutch pagination query receives no dedicated output.

## Pagination and feeds

Replace offset-based Squarespace traversal with stable locale pages:

- `/onderwijs` and `/onderwijs/page/{n}`.
- `/education` and `/education/page/{n}`.

The 31 successful legacy query combinations stay in an allowlist. P4 compares
their archived article membership before assigning page numbers; timestamps are
not treated as page numbers. A small browser compatibility shim may recognise
these queries because GitHub Pages cannot redirect on query strings.

Generate locale feeds at `/onderwijs/rss.xml` and `/education/rss.xml`. The two
legacy `?format=rss` URLs remain compatibility records; non-browser feed clients
cannot be server-redirected by GitHub Pages.

## Tag archives and case collisions

All 235 tag archives and 8 category archives are derived from preserved article
metadata. This includes
the two H1-approved HTTP 429 snapshot exceptions:

- `/education/tag/%23VlaanderenLeest`
- `/education/tag/latin`

Seventeen case-insensitive pairs have different source hashes and article
membership. Windows cannot materialise both variants in the same case-insensitive
working tree. Preserve every exact route and original tag spelling in the route
map, then build and parity-test colliding outputs in a case-sensitive environment
before H3. Any case-folded union or alias requires an explicit H2 exception.

## Navigation and locale behaviour

Dutch primary navigation:

1. Over — `/`
2. Boek — `/boek`
3. Onderwijs — `/onderwijs`
4. Nascholingen — `/onderwijs/workshops-en-nascholingen`
5. Contact — `/contact`

English primary navigation:

1. About — `/about`
2. Contact Info — `/contactinfo`
3. Education — `/education`
4. Projects — `/projects`

Route evidence, not the unreliable source `<html lang>`, determines locale.
Confirmed translation pairs are `/` and `/about`, `/contact` and `/contactinfo`,
and `/onderwijs` and `/education`. Show `hreflang` and a translation switch only
for a real pair; otherwise link clearly to the other locale's home.

## Base-path behaviour

Navigation, media, redirect stubs, feeds, and generated assets must use Astro's
configured base. Local and future custom-domain builds use `/`; only an
H3-approved project preview may use `/aiindeklas/`. Stored canonical paths do
not contain the preview base.
