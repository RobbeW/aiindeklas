# ADR-001: Static site and content architecture

- Status: accepted at H2
- Date: 2026-07-16

## Decision

Use Astro 7 static output with the Content Layer API and strict Zod schemas.
Markdown is the default body format; MDX is allowed only for reviewed structured
components. Do not introduce SSR, a database, or site-wide hydration.

Astro 6+ requires `src/content.config.ts`; this execution-time official API
supersedes the orchestrator's legacy illustrative path `src/content/config.ts`.

## Consequences

Builds remain deterministic and GitHub Pages-compatible. Publishable content
cannot bypass schema validation. Interactive islands remain exceptional.
