# ADR-005: Analytics and privacy

- Status: accepted at H2
- Date: 2026-07-16

## Decision

Deploy no application analytics, advertising pixel, tag manager, fingerprinting,
or tracking cookie. Platform hosting logs are not treated as an application
analytics feature.

Any future measurement requires a separate owner-approved privacy ADR and data
processor review.

## Consequences

The application needs neither an analytics consent banner nor a tracking script.
There is no visitor analytics dashboard by default.
