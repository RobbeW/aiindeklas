# ADR-006: Image optimisation and original retention

- Status: accepted at H2
- Date: 2026-07-16

## Decision

Preserve every authorised original binary with SHA-256 provenance, dimensions,
rights, and source filename. Produce deterministic responsive derivatives at
build time, prefer modern formats with appropriate fallback, and never upscale.
Retain meaningful animation.

Do not copy third-party hotlinks without a clear right to do so.

## Consequences

The local preservation archive is larger, but delivery remains efficient and the
migration is reversible. Originals stay outside the deployment artifact.
