# Workshop thumbnails

This directory contains the approved artwork for the ten active workshops.
Each filename is exactly one catalogue identifier and is stored as an
optimized `.webp` asset. For example:

```text
kennis_in_tijden_van_ai.webp
```

Identifiers are the keys in `docs/client_onboarding_workshop_finder.yaml`.
Filenames do not create offers and their text is never used as catalogue
content or alt text. The resolver remains safe for future partial artwork sets:
an offer without a matching file keeps the accessible RW fallback.

Do not add two files for the same identifier/slug. Ambiguous matches are
reported as an error during the Astro build.
