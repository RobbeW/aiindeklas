import test from "node:test";
import assert from "node:assert/strict";
import { inspectP09Html } from "../../scripts/p09-checks.mjs";
import { replaceContactFormCopy } from "../../scripts/p09-contact-copy.mjs";
import { providerLabelForUrl } from "../../scripts/p09-embed-labels.mjs";

test("P09 allows labelled provider links with no automatic embed request", () => {
  const html = '<main><p><a href="https://www.youtube.com/embed/abc123">Video on YouTube</a></p></main>';
  assert.deepEqual(inspectP09Html(html).problems, []);
});

test("P09 rejects generic provider labels when a YouTube URL identifies the provider", () => {
  const result = inspectP09Html('<a href="https://youtu.be/abc123">Video on the source platform</a>');
  assert.equal(result.counts.unlabeled_provider_links, 1);
  assert.match(result.problems.join(" "), /meaningful label/);
});

test("P09 rejects remote frames, scripts, and Squarespace or Embedly wrappers", () => {
  const html = '<script src="https://cdn.embedly.com/widget.js"></script><iframe src="https://www.youtube.com/embed/abc"></iframe><div class="sqs-video-wrapper">';
  const problems = inspectP09Html(html).problems.join(" ");
  assert.match(problems, /iframe/);
  assert.match(problems, /external script/);
  assert.match(problems, /Embedly/);
  assert.match(problems, /Squarespace/);
});

test("P09 allows the approved client-side contact email form", () => {
  const html = '<form data-contact-email-form data-recipient="robbe.wulgaert@gmail.com"><input name="email" required><textarea name="message" required></textarea><button type="submit">Open email draft</button></form>';
  const result = inspectP09Html(html);
  assert.deepEqual(result.problems, []);
  assert.equal(result.counts.contact_forms, 1);
  assert.equal(result.counts.contact_form_recipient, 1);
  assert.equal(result.counts.contact_mailto, 0);
  assert.equal(result.counts.network_form_submissions, 0);
});

test("P09 rejects a form with a network submission endpoint", () => {
  const result = inspectP09Html('<form data-contact-email-form data-recipient="robbe.wulgaert@gmail.com" action="https://example.test/contact" method="post"></form>');
  assert.match(result.problems.join(" "), /network form submission|submission endpoint/);
});

test("regeneration replaces the legacy contact-form promise idempotently", () => {
  const source = "Via het formulier op deze webpagina kan je een vraag stellen over een lesproject of [nascholing](/onderwijs/workshops-en-nascholingen).";
  const migrated = replaceContactFormCopy(source);
  assert.match(migrated, /formulier hierboven/i);
  assert.doesNotMatch(migrated, /robbe\.wulgaert@gmail\.com/);
  assert.doesNotMatch(migrated, /formulier op deze webpagina/i);
  assert.equal(replaceContactFormCopy(migrated), migrated);
});

test("provider labels use known video URL hosts when wrapper metadata is blank", () => {
  assert.equal(providerLabelForUrl("https://www.youtube.com/watch?v=abc"), "YouTube");
  assert.equal(providerLabelForUrl("https://youtu.be/abc"), "YouTube");
  assert.equal(providerLabelForUrl("https://example.com/video"), "the source platform");
  assert.equal(providerLabelForUrl("https://www.youtube.com/watch?v=abc", "Video"), "Video");
});
