# ADR-007: URL preservation and redirect stubs

- Status: accepted at H2
- Date: 2026-07-16

## Decision

Preserve exact legacy paths, case, diacritics, percent encoding, and the measured
no-trailing-slash canonical policy. Use base-aware static redirect stubs only
when a path must change; do not assume host-level redirect rules.

Collapse legacy query pagination into canonical collection archives. Apply H1
exactly: exclude photography, videography, and inaccessible `/info`; redirect
`/contact-english`; omit the failed noncanonical pagination query. Add the
source-proven `/english` to `/about` alias as a one-hop redirect.

Keep all 17 case-insensitive tag pairs as distinct route-map records because
their archived article membership differs. Generate and parity-test those paths
in a case-sensitive build environment before H3. Do not silently fold, merge, or
union them.

## Consequences

Historical links retain the best feasible continuity on static hosting. The
no-trailing transport behaviour and case-colliding archives require deployment
parity tests. Every exception remains explicit in the route ledger.
