# ADR-002: CMS authentication and publishing

- Status: accepted at H2
- Date: 2026-07-16

## Decision

Begin with local CMS validation and deterministic patch/PR-bundle export. Apply
changes using local Git credentials outside the browser. After H3, the Studio may
offer GitHub authenticated editor or pull-request links.

Defer an OAuth bridge unless a separately hosted service is explicitly approved.
Never store tokens in client code, generated output, the repository, or browser
storage.

## Consequences

There is no one-click remote publish before H3. Every eventual production write
is reviewable, while the local authoring workflow needs no credential service.
