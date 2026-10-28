# ADR-009: Multilingual content and translation pairing

- Status: accepted at H2
- Date: 2026-07-16

## Decision

Store Dutch and English as independent records with an optional shared
`translation_key`. Preserve `/onderwijs` and `/education`. Emit `hreflang` and a
language-switch link only for verified pairs.

Do not invent translations, silently machine-translate prose, or redirect solely
from browser language.

## Consequences

The site truthfully supports partial bilingual coverage while preserving source
routes and author voice.
