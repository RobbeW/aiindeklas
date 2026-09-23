# Content authoring guide

## Status flow

Use `draft` while writing, `review` when the content is ready for editorial and
media checks, `published` only after approval, and `archived` for content that
must remain in Git but should not appear as current. Draft and review records
stay `noindex`.

Migrated records keep their source URL and source hash together. Do not remove
or alter those provenance fields in order to publish. A migrated record may be
published only when its migration status is `approved` and its SEO metadata and
publication date are complete.

## Articles

- Keep the title faithful to the author's wording.
- Use a lowercase, hyphenated slug. Dutch articles normally live below
  `/onderwijs/`; English articles below `/education/`.
- Write a concise excerpt that can stand alone in a listing card.
- Assign tags and categories deliberately; inconsistent case currently creates
  legacy route collisions that P7 must resolve.
- Select a reviewed `seo.image` media ID for the listing thumbnail.
- Write the body in Markdown. Use descriptive link text and a meaningful image
  description once the P7 alt-text review is complete.

## Workshops

Keep reusable information in the structured fields rather than duplicating it
inside the body. Record duration in minutes when one clear duration exists, and
retain the source-facing duration display when an offering has variants. Use
only these delivery-mode values: `on_site`, `online`, `hybrid`, `cno`, or
`other`.

Minimum group size may not exceed maximum group size. Keep price and travel-cost
display strings when the source wording is more precise than a single number.

## Before committing

1. Validate and apply the CMS patch.
2. Run `pnpm quality:p6`.
3. Read the Markdown diff for unintended prose changes.
4. Check thumbnail choice, alt-text review, and publication rights.
5. Keep the commit local until the applicable publication gate is approved.
