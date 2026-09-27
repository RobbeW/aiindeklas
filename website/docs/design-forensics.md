# Design forensics

Status: accepted at H2.

## Scope and evidence

All nine design sources named by the orchestrator were loaded directly on
2026-07-16 and captured at desktop width. The capture manifest and computed
evidence live in `migration/reports/`; the PNG evidence lives in
`migration/screenshots/design-sources/`.

Across all nine sources, the browser measured one `h1`, the same system UI font
stack, a sticky header, and a 150 ms fast-motion value. Seven use the warm
`rgb(248, 247, 243)` body background directly; Delphi and SmartPlants expose a
transparent body over a layered page background. Their local CSS variable names
are not uniform, so the target token names are a deliberate canonicalisation,
not a claim that every project already uses identical source names.

## Per-source evidence

### Blockly — high confidence

Direct capture confirms a compact teaching-site shell, dominant hero, numbered
feature cards, platform-family context, teacher guidance, and a final call to
action. Motion supports visible learning feedback rather than decoration.

### JavaScript in de Klas — high confidence

Direct capture and repository evidence confirm the application-shell variant:
exercise navigation, editor/canvas/console, progress feedback, local persistence,
and export tools. It informs dense teaching tools more than editorial layouts.

### HTML in de Klas — high confidence

Direct capture confirms the same warm, sticky-header family applied to a lighter
HTML exercise environment. Treat its tool workspace as a specialised component,
not the main site's default page template.

### Delphi — high confidence

Direct capture and repository evidence confirm the Python exercise catalogue,
browser workspace, testcase summaries, progress, reference material, and export
tools. Its transparent layered background is an intentional project-level variant.

### SmartPlants — high confidence

Direct capture confirms a bilingual research-project page with a strong hero,
measure-and-compare flow, setup imagery, teaching context, and a layered page
background. Locale controls must remain real links in the target.

### Robothand — high confidence

Direct capture confirms the Build–Calibrate–Control workflow, physical setup
media, numbered learning goals, project-family map, teacher guidance, technical
requirements, privacy section, and closing action.

### Project Wind — high confidence

Direct capture confirms the Predict–Measure–Compare research flow, hardware
media, numbered learning goals, teacher guidance, local-data privacy, and closing
action.

### Slimme Vuilnisbak — high confidence

Direct capture confirms a five-step AI lifecycle, setup media, learning concepts,
family map, and teacher guidance. P4 must still classify the hero visual as
decorative or informative and assign alt text accordingly.

### Project Fijnstof — high confidence, route defect recorded

Direct capture verifies `/projectfijnstof/` as the intended live project. Several
family maps still link to `/fijnstof/`, which returns 404. The migrated catalogue
must use only the verified route.

## Proposed component grammar

- Sticky branded header, compact primary navigation, and real locale links.
- A target-site skip link and clearly visible keyboard focus; neither is accepted
  merely because the source family looks consistent.
- One dominant hero with no more than two primary actions.
- Numbered workflows, research steps, and learning-goal cards.
- Teacher-facing practical guidance and plain-language privacy information.
- Project-family or curriculum context.
- Final action and author/ecosystem footer.
- Research sequence: reason or predict → act or measure → compare → conclude.

## Accessibility repairs

The target requires explicit verification of the menu's `aria-expanded` state,
keyboard focus, skip-link operation, 200% zoom, 320 px reflow, actual translation
pairing, and reduced motion. These are acceptance requirements, not assumptions
derived from visual resemblance.

## Drift policy

Use the proposed consensus tokens in `docs/design-token-evidence.yaml`. Raw
project-specific deviations require evidence and an explicit theme boundary.
Keep the canonical tokens local to this repository through the migration; a
shared package is deferred by ADR-008.
