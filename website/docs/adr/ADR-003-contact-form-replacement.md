# ADR-003: Contact form replacement

- Status: accepted at H2; revised for owner review
- Date: 2026-07-16 (revised 2026-09-23)

## Decision

Use a small client-side contact form on `/contact` and `/contactinfo`. The form
collects a name, email address, optional subject and message only in the
visitor's browser, then opens a prefilled `mailto:` draft addressed to
`robbe.wulgaert@gmail.com`. Do not publish the recipient as visible page text;
the form explains that it opens a draft in the visitor's default mail app.
Preserve `/contact` and
`/contactinfo`; redirect the unavailable `/contact-english` route to
`/contactinfo`.

Any later hosted form requires a new ADR covering the processor, privacy notice,
retention, spam controls, secrets, cost, and fallback.

## Consequences

No form data is posted to this website. No cookies, spam processor, hosted form
service, secret or retention system is introduced. Visitors need a configured
mail client and JavaScript to prepare the draft; the recipient is not exposed as
a visible mail link that can be harvested by spam crawlers.
