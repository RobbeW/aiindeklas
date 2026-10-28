import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { inspectP09Html } from "./p09-checks.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = new Map(process.argv.slice(2).map((arg) => {
  const [key, ...value] = arg.replace(/^--/, "").split("=");
  return [key, value.join("=") || true];
}));
const builtArg = args.get("built");
const base = String(args.get("base") ?? "/");
const problems = [];
const files = [];
const totals = {
  html_files: 0,
  iframes: 0,
  embeds_and_objects: 0,
  external_scripts: 0,
  provider_links: 0,
  unlabeled_provider_links: 0,
  source_markdown_files: 0,
  labelled_provider_links: 0,
  contact_content_records_checked: 0,
  contact_form_blocks: 0,
  embedly_wrapper_instances: 0,
  p08_video_deferrals_referenced: 0,
  contact_routes_checked: 0
};
const output = builtArg ? path.resolve(ROOT, builtArg) : null;

const PROJECT = path.resolve(ROOT, "..");
const dependencyPath = path.join(PROJECT, "docs/implementation/manifests/p09-dynamic-dependencies.json");
const sourceManifestPath = path.join(ROOT, "migration/source-manifest.json");
const contentRoot = path.join(ROOT, "src/content");
try {
  const dependency = JSON.parse(await fs.readFile(dependencyPath, "utf8"));
  const source = JSON.parse(await fs.readFile(sourceManifestPath, "utf8"));
  const recon = dependency.generated_from.reconciliation;
  const sourceHtmlCount = source.pages.filter((page) => page.raw_path?.endsWith(".html")).length;
  if (source.pages.length !== recon.route_records || source.pages.length !== source.summary.page_records) problems.push("Source route-record totals do not reconcile.");
  if (sourceHtmlCount !== recon.all_preserved_html_scanned || sourceHtmlCount !== dependency.source_facts.snapshots_scanned) problems.push(`Preserved HTML snapshot mismatch: manifest has ${sourceHtmlCount}, dependency inventory has ${dependency.source_facts.snapshots_scanned}.`);
  const accounted = recon.snapshotted_html + recon.snapshotted_non_html + recon.http_error_html_snapshots + recon.fetch_errors_without_snapshot;
  if (accounted !== recon.route_records) problems.push(`Snapshot status reconciliation totals ${accounted}, expected ${recon.route_records}.`);
  if (recon.snapshotted_html + recon.snapshotted_non_html !== source.summary.snapshotted_pages) problems.push("Successful snapshot count does not reconcile with source summary.");
  if (recon.snapshotted_non_html !== source.pages.filter((page) => page.crawl_status === "snapshotted" && page.raw_path && !page.raw_path.endsWith(".html")).length) problems.push("Non-HTML snapshot count mismatch.");
  if (recon.http_error_html_snapshots !== source.pages.filter((page) => page.crawl_status === "http_error" && page.raw_path?.endsWith(".html")).length) problems.push("HTTP-error HTML snapshot count mismatch.");
  if (recon.fetch_errors_without_snapshot !== source.pages.filter((page) => page.crawl_status === "fetch_error" && !page.raw_path).length) problems.push("Fetch-error rows without a snapshot do not reconcile.");

  const allowedDispositions = new Set(["retained as static/native", "replaced", "deferred", "removed", "not present/no action"]);
  for (const decision of dependency.decisions) if (!allowedDispositions.has(decision.disposition)) problems.push(`Unsupported or missing disposition for ${decision.feature}.`);
  const contact = dependency.source_facts.forms_and_newsletters;
  if (contact.form_block_instances !== 2 || contact.routes.join(",") !== "/contact,/contactinfo" || contact.form_evidence?.length !== 2) problems.push("Contact form source evidence must account for both /contact and /contactinfo.");
  if (dependency.source_facts.external_video_embeds.embedly_wrapper_instances !== dependency.source_facts.external_video_embeds.providers.reduce((sum, provider) => sum + provider.instances, 0)) problems.push("Embedly provider wrapper instance totals do not reconcile.");
  if (dependency.source_facts.native_video.p08_deferred_candidate_count !== 18 || dependency.source_facts.native_video.p08_deferred_ids.length !== 18) problems.push("P09 must reference all 18 P08 native-video deferrals without changing them.");
  const migrationSource = await fs.readFile(path.join(ROOT, "scripts/migrate-content.mjs"), "utf8");
  if (!migrationSource.includes("replaceContactFormCopy") || !migrationSource.includes("providerLabelForUrl")) problems.push("Content regeneration path must preserve the P09 contact and provider-label decisions.");

  const readContent = async (relative) => fs.readFile(path.join(contentRoot, relative), "utf8");
  for (const [route, file] of [["/contact", "pages/generated/contact.md"], ["/contactinfo", "pages/generated/contactinfo.md"]]) {
    const markdown = await readContent(file);
    if (!/formulier hierboven|form above/i.test(markdown)) problems.push(`${route}: source content must explain how to use the contact form.`);
    if (markdown.includes("mailto:robbe.wulgaert@gmail.com")) problems.push(`${route}: source content must not publish a direct mailto address.`);
    if (/via het formulier op deze webpagina|contact me with this tool/i.test(markdown)) problems.push(`${route}: source content contains stale copy promising form submission.`);
  }
  const contentFiles = [];
  const walkContent = async (directory) => {
    for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
      const entryPath = path.join(directory, entry.name);
      if (entry.isDirectory()) await walkContent(entryPath);
      else if (/\.(?:md|mdx)$/.test(entry.name)) contentFiles.push(entryPath);
    }
  };
  await walkContent(contentRoot);
  const providerLinks = [];
  for (const file of contentFiles) {
    const markdown = await fs.readFile(file, "utf8");
    if (/cdn\.embedly\.com|embedly-embed|sqs-video-wrapper|sqs-native-video|sqs-block-form/i.test(markdown)) problems.push(`${path.relative(ROOT, file)}: legacy embed/form wrapper found in migrated content.`);
    const body = markdown.match(/^---\s*\r?\n[\s\S]*?\r?\n---\s*\r?\n([\s\S]*)$/)?.[1] ?? markdown;
    for (const match of body.matchAll(/\[([^\]]+)\]\((https?:\/\/[^)\s]*(?:youtube\.com|youtu\.be|vimeo\.com)[^)]*)\)/gi)) {
      const label = match[1].replace(/<[^>]+>/g, "").trim();
      if (!label || /^https?:\/\//i.test(label) || /^(?:here|click here|video)$/i.test(label)) problems.push(`${path.relative(ROOT, file)}: video provider link has no meaningful label.`);
      if (/^(?:youtube\.com|www\.youtube\.com|youtu\.be)$/i.test(new URL(match[2]).hostname) && /source platform/i.test(label)) problems.push(`${path.relative(ROOT, file)}: YouTube destination is labelled generically as the source platform.`);
      providerLinks.push({ file: path.relative(ROOT, file), label, url: match[2] });
    }
  }
  totals.source_markdown_files = contentFiles.length;
  totals.labelled_provider_links = providerLinks.length;
  totals.contact_content_records_checked = 2;
  totals.contact_form_blocks = contact.form_block_instances;
  totals.embedly_wrapper_instances = dependency.source_facts.external_video_embeds.embedly_wrapper_instances;
  totals.p08_video_deferrals_referenced = dependency.source_facts.native_video.p08_deferred_candidate_count;
} catch (error) {
  problems.push(`P09 source/manifest validation failed: ${error.message}`);
}

if (output) {
  const walk = async (directory) => {
    for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
      const entryPath = path.join(directory, entry.name);
      if (entry.isDirectory()) await walk(entryPath);
      else if (entry.name.endsWith(".html")) files.push(entryPath);
    }
  };
  try { await walk(output); } catch (error) { problems.push(`Built directory unavailable: ${output} (${error.message})`); }
  for (const file of files) {
    const html = await fs.readFile(file, "utf8");
    const result = inspectP09Html(html, path.relative(output, file));
    problems.push(...result.problems);
    totals.html_files += 1;
    totals.iframes += result.counts.iframes;
    totals.embeds_and_objects += result.counts.embeds_and_objects;
    totals.external_scripts += result.counts.external_scripts;
    totals.provider_links += result.counts.provider_links;
    totals.unlabeled_provider_links += result.counts.unlabeled_provider_links;
  }

  for (const route of ["contact", "contactinfo", "contact-english"]) {
    const contactPath = path.join(output, `${route}.html`);
    try {
      const html = await fs.readFile(contactPath, "utf8");
      const result = inspectP09Html(html, `${route} contact`);
      const requiresContactForm = route !== "contact-english";
      if (requiresContactForm && result.counts.contact_forms !== 1) problems.push(`${route}: the client-side contact email form is missing.`);
      if (requiresContactForm && result.counts.contact_form_recipient !== 1) problems.push(`${route}: the contact form recipient is missing or incorrect.`);
      if (result.counts.contact_mailto) problems.push(`${route}: a visible direct mailto link exposes the contact address.`);
      if (!requiresContactForm && result.counts.contact_forms) problems.push(`${route}: redirect fallback must not duplicate the contact form.`);
      if (result.counts.network_form_submissions) problems.push(`${route}: contact output contains a network form submission dependency.`);
      if (/via het formulier op deze webpagina|contact me with this tool/i.test(html)) problems.push(`${route}: stale copy promises form submission.`);
    } catch (error) {
      problems.push(`${route}: built route missing or unreadable (${error.message}).`);
    }
  }
  totals.contact_routes_checked = 3;
}

const report = {
  schema: "website-migration.p09-validation/v1",
  built: output ? path.relative(ROOT, output) : null,
  base,
  passed: problems.length === 0,
  counts: totals,
  problems
};
const reportName = output ? `P09-validation-${base === "/" ? "root" : "project"}.json` : "P09-validation.json";
const reportPath = path.join(ROOT, "migration/reports", reportName);
await fs.mkdir(path.dirname(reportPath), { recursive: true });
await fs.writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report, null, 2));
if (problems.length) process.exitCode = 1;
