# P7 parity and quality repair

- Phase: P7
- Status: automated gates passed; owner decisions required
- Date: 2026-07-20
- Execution mode: local first
- Remote repository configured: no
- Registrar or DNS action: none

## Landing-page parity repair

The previous migrated landing page placed an invented marketing layer before
the preserved source content. It did not match the source language, hierarchy,
photography, or calls to action. The landing page now starts with the original
Dutch heading and biography, uses the migrated classroom portrait and book
image, and preserves the four source actions for the book, training offer,
lesson material, and contact.

The repeatable content migration now also repairs line-broken linked images,
normalises malformed same-origin media links, removes empty anchors, and keeps
heading order valid. Rerunning `pnpm migrate:content` therefore preserves the
landing repair instead of undoing it.

## Automated gate evidence

- Content model: 155 migrated documents validate.
- Astro diagnostics: 53 files, zero errors, warnings, or hints.
- Unit tests: 18 passing.
- Root build: 365 HTML files and 12,473 internal URLs, zero errors.
- `/aiindeklas/` build: 365 HTML files and 12,473 internal URLs, zero errors.
- Built-site P7 validator: 365 pages, 2,050 images, 377 fragments, zero duplicate
  titles, descriptions, or canonicals, zero external scripts/forms, and zero
  technical errors.
- RSS: 78 Dutch article items and 46 English article items.
- Lighthouse mobile: 100 for performance, accessibility, best practices, and
  SEO on `/`, `/onderwijs`, and a representative article.
- Dependency audit: zero high or critical advisories. One moderate advisory is
  confined to Lighthouse's development-only OpenTelemetry dependency.

Machine-readable evidence is in `P7-quality-report.json`, `P7-lighthouse.json`,
`build-root.json`, and `build-project.json` in this directory.

## Manual browser evidence

- Compared the rebuilt landing page with the preserved source desktop and
  mobile captures.
- Checked desktop at 1366 by 900, tablet at 768 by 1024, and phone at 390 by
  844; the page reflows without horizontal overflow. The narrower checks cover
  the layout pressure expected at 200 percent desktop zoom.
- Confirmed both landing images load with intrinsic dimensions and meaningful
  accessible names.
- Confirmed the mobile menu opens, reports its expanded state, closes with
  Escape, and returns focus to the menu button.
- Confirmed the reduced-motion stylesheet disables smooth scrolling and reduces
  all transition and animation durations.
- Confirmed `/onderwijs` renders 78 thumbnail elements. Every thumbnail has a
  source, intrinsic dimensions, lazy loading, and a labelled destination link;
  viewport thumbnails loaded successfully during the check.

## Paragraph, button, and motion parity repair

The source audit found that body copy on the original site is justified and
that Squarespace button blocks had been flattened into ordinary Markdown links.
The migration now preserves actual button blocks, including their label, URL,
alignment, size, style role, and new-window behaviour. It found 178 source
buttons. The built public pages render 177 of them; the remaining source button
belongs to the preserved author-profile body, which currently has no public
profile route. The P7 validator now fails if a later migration drops any of the
177 page buttons.

- Main-content paragraphs use justified alignment, automatic language-aware
  hyphenation, and safe word wrapping. Labels and compact interface metadata are
  excluded from the paragraph rule.
- Migrated CTAs match the measured source treatment: white background, 2 px
  purple border, square corners, 16 px bold label, approximately 65 px height,
  source alignment, and a 100 ms linear opacity response.
- Ordinary inline links remain links; only preserved Squarespace button blocks
  become CTAs.
- Project-root builds rewrite internal links inside preserved raw CTA HTML. For
  example, `/contact` becomes `/aiindeklas/contact`; external destinations stay
  unchanged.
- The UI motion rhythm is now 150 ms for immediate controls and the mobile menu,
  260 ms for image/card feedback, and 450 ms for page entrance. Content follows
  the hero by 90 ms, using a restrained opacity/vertical reveal.
- Reduced-motion preferences disable smooth scrolling and collapse transitions
  and animations to effectively immediate feedback.
- Desktop browser checks confirmed justified copy, the restored Project
  Fijnstof and contact CTA treatments, the four-button landing grid, no
  horizontal overflow, and the measured motion timings.

## Owner decisions blocking the P7 gate

The automated work is complete, but P7 cannot be declared complete without
inventing or waiving owner-controlled facts:

- 829 media records require a publication-rights decision.
- 753 media records require contextual alt review; 603 currently render with
  empty alt pending that review.
- 18 Squarespace native-video records need owner originals or explicit approval
  for nonpublication.
- 17 case-only taxonomy collision groups need a case-sensitive build check or an
  explicitly approved route exception.

P8 remains blocked until these exceptions are resolved or explicitly approved.
No GitHub repository, Pages site, registrar, CNAME, or DNS change was made.
