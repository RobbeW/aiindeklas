# ADR-000: Local-first execution boundary

- Status: accepted
- Date: 2026-07-15

## Decision

Build, migrate, and validate the site in the current folder before creating a
GitHub repository or accessing the registrar. Local Git provides version history
without a remote. `RobbeW/aiindeklas` and its project Pages URL remain candidates
until the H3 owner-approval gate. Registrar and DNS actions remain behind H4.

The application must support `/` locally and on the eventual custom domain, plus
`/aiindeklas/` for a possible GitHub project Pages preview.

## Consequences

- P0 through P8 have no remote-hosting dependency.
- Public previews remain `noindex, nofollow` before cutover.
- Internal paths must be generated from the configured base path.
- No `CNAME` file is activated before H4.

