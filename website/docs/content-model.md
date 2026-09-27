# Content model

Status: accepted at H2.

## Astro 7 structure

Astro 7 uses the Content Layer entry point `src/content.config.ts`. Every
collection has an explicit loader:

- Markdown/MDX glob loaders for authors, pages, articles, workshops, and projects.
- A YAML glob loader for discriminated site-setting records.
- A YAML file loader for the media registry.

The legacy `src/content/config.ts` location is not used. Stable frontmatter `id`
values override path-derived IDs, and raw bodies are retained for completeness
checks.

## Body-bearing collections

Pages, articles, workshops, and projects share provenance, lifecycle, locale,
author, media, and SEO fields. Their `body` is the Markdown or approved MDX text
after frontmatter; it is never duplicated in a frontmatter key. Author biography
text follows the same body convention, but authors intentionally omit the
document-level author self-reference and page excerpt/hero fields.

Collection boundaries:

- Landing, fixed, profile, contact, article-index, and project-portfolio pages →
  `pages`.
- Editorial posts → `articles`.
- Structured records extracted from the workshop catalogue → `workshops`.
- Structured catalogue entries linking to independently deployed tools →
  `projects`.
- Tag archives, pagination, feeds, sitemap, and robots → generated outputs, not
  content records.
- `/404` → a target route, not a normal page collection record.
- H1 photography/videography exclusions → no content records.

Plain Markdown is the default. MDX is allowed only for reviewed, allowlisted
interactive blocks; arbitrary scripts and raw third-party embeds are not content.
Article reading time is derived from the retained body during build.

## Provenance and publishing invariants

- `source_url` and `source_html_sha256` are either both present or both null.
- Source hashes are lowercase SHA-256 values.
- Source datetimes are normalised to RFC 3339 offsets such as `+02:00`.
- Migrated content cannot become `published` until `migration_status` is
  `approved`.
- Published records require `published_at`, complete SEO metadata, and a nonblank
  body.
- Locale comes from route/content evidence, not the source document's unreliable
  global `lang` attribute.
- Translation keys identify a real `nl-BE`/`en` pair; unpaired records use null.
- Page and article canonical routes are unique.

## Settings and media

Settings use strict records discriminated by `kind`: `site`, `navigation`,
`footer`, `social`, and `redirects`. This keeps each CMS-editable file independent
while retaining one validated collection.

The media registry is deliberately empty in P3. P4 downloads authorised binaries,
computes their real SHA-256 hashes and dimensions, records rights/provenance, and
only then creates media records. Placeholder binary hashes are forbidden.

## Representative fixtures

P3 includes one author, paired NL/EN pages, an English article with a normalised
source timestamp, a workshop, a project, all five settings kinds, and an empty
validated media registry. They remain `review`/`noindex` and explicitly state that
verified full extraction belongs to P4.

Validation consists of:

1. Astro schema/reference validation through `astro sync`, `astro check`, and the
   production build.
2. `scripts/validate-content-model.mjs` for nonblank bodies, provenance pairing,
   unique IDs/routes, real translation pairs, required setting kinds, and media
   registry shape.
3. Unit tests that prove blank bodies, unpaired provenance, duplicate canonical
   routes, and incomplete migrated publication fail intentionally.
