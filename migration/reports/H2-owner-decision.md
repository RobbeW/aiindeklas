# H2 owner decision: IA, design, CMS, contact, and privacy

- Status: approved as recommended
- Date prepared: 2026-07-16
- Approved: 2026-07-16
- Blocks: P4 local application integration
- Does not authorise: GitHub repository creation, publication, registrar access,
  DNS changes, or custom-domain activation

## Recommended approval package

Approve the following as one H2 decision:

1. **Information architecture and URL behaviour** — account for all 429 pages as
   documented; preserve exact legacy content/article/tag paths; use no-trailing
   logical canonicals; generate both 429 tag exceptions; redirect
   `/contact-english` to `/contactinfo` and `/english` to `/about`; retain the 12
   H1 hard exclusions; build the 17 distinct case-colliding tag pairs in a
   case-sensitive environment and parity-test them before H3.
2. **Design system** — adopt the local canonical tokens and shared component
   grammar derived from the nine captured educational sites; keep the token
   implementation local during migration and defer any shared package.
3. **CMS publishing mode** — build a local Studio that validates content and
   exports deterministic patches/PR bundles; use local Git credentials outside
   the browser; create no OAuth bridge or browser-stored token.
4. **Contact** — replace form submission with a visible address plus `mailto:`;
   confirm the exact public address during P4 content extraction. A future hosted
   form requires a new privacy/processor decision.
5. **Privacy and external services** — no application analytics or tracking; no
   automatic third-party embeds; use click-to-load allowlisted embeds or direct
   links; do not migrate the legacy Embedly key.
6. **Content and media** — independent NL/EN records with translation links only
   for real pairs; preserve authorised originals and generate deterministic
   derivatives only after hashing and rights review.
7. **Canonical direction** — retain `https://www.robbewulgaert.be` as the future
   production canonical, while all registrar/DNS/CNAME activation remains
   exclusively behind H4.

## Owner response

Approved as recommended. This approval unblocks P4 local integration only; the
GitHub and registrar restrictions above remain in force.
