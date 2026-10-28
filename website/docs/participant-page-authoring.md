# Participant-page authoring

Participant resources are static, unlisted pages. Copy `docs/templates/participant-page.template.md` to `src/content/participant-pages/<slug>.md`, use a unique lowercase `slug`, and set `route_path` to the intended URL. Put media in `src/assets/participant-pages/<slug>/` and reference it relatively. The existing renderer handles the route; do not edit routing or components. Every page is always `noindex, nofollow`, excluded from navigation, listings, RSS, sitemap and admin content.

The template demonstrates rich text (headings, paragraphs and lists), internal/external actions, image/caption, and multiple accordion groups. Make an explicit alt decision for every image: useful description, or `alt: ""` only when genuinely decorative. Verify every destination and record removal/expiry owner and date.

Run `pnpm p44:validate` before building. It checks duplicate routes, malformed slugs, missing local assets, missing alt decisions, unsafe action URLs and the discovery boundary. Then run `pnpm build:root`, `pnpm build:project`, and `pnpm build:production-project`; remove temporary fixtures before the final production build.

Courtesy codes are optional convenience gates. In a local PowerShell session,
set `PARTICIPANT_CODE` temporarily, run `pnpm participant:digest`, paste only the
two emitted YAML lines into frontmatter, and then remove the environment
variable. The helper creates a random salt and prints only the salt and digest;
it never prints or writes the plaintext code. Never place the command containing
the code in documentation or a committed script. This is not authentication:
static HTML and assets are inspectable. Never place secrets, personal data or
confidential material here.

Release checklist: unique slug/route; slug-specific assets; alt decisions; verified internal/external destinations; captions and accordion headings reviewed; removal/expiry owner/date; no plaintext code; validator and builds pass; `/geschenk`, `/404`, `/verkoopsvoorwaarden` smoke-checked; participant route absent from sitemap/RSS/navigation/listings/admin.
