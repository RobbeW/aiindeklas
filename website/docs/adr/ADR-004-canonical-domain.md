# ADR-004: Canonical domain and build profiles

- Status: accepted at H2; activation remains H4-only
- Date: 2026-07-16

## Decision

Keep `https://www.robbewulgaert.be` as the future production canonical and retain
the apex domain. Local builds use `/`; a possible H3-approved project preview uses
`/aiindeklas/`; the future custom-domain build returns to `/`.

Local and project previews remain `noindex, nofollow`. No DNS, registrar, CNAME,
or domain-verification action occurs before H4.

## Consequences

One source tree must pass both base-path profiles. Canonical production identity
does not authorize an early domain cutover.
