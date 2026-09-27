# ADR-010: External embeds and consent

- Status: accepted at H2
- Date: 2026-07-16

## Decision

Load no third-party iframe or embed script automatically. Render an accessible
local placeholder with provider and purpose disclosure plus a direct external
link. Load an allowlisted embed only after explicit visitor action.

Use privacy-enhanced URLs where supported, no autoplay, lazy loading, restrictive
`sandbox` and `allow` attributes, and a strict referrer policy. Unknown providers
degrade to links. Do not migrate legacy Embedly wrappers or keys.

## Consequences

No third-party request occurs before consent and a tighter CSP is possible, at
the cost of one extra click. Provider inventory continues during extraction.
