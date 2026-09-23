# ADR-008: Shared design package

- Status: accepted at H2
- Date: 2026-07-16

## Decision

Keep canonical design tokens local to this repository for the migration. Treat
`@robbew/design-system` as a possible future package name only. Do not publish a
package or modify educational project repositories without compatibility tests
and separate approval.

## Consequences

Small temporary duplication avoids cross-repository coupling and remote build
dependencies during migration.
