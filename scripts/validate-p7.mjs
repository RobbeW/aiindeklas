import { access, mkdir, readdir, readFile, stat, writeFile } from "node:fs/promises";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { load } from "cheerio";
import { parse as parseYaml } from "yaml";
import { outputFileForLogicalPath } from "./validate-built-site.mjs";

const ROOT = fileURLToPath(new URL("../", import.meta.url));
const DIST = resolve(ROOT, "dist");
const REPORT = resolve(ROOT, "migration/reports/P7-quality-report.json");
const normalise = (value) => String(value ?? "").replace(/\s+/g, " ").trim();
const normaliseKey = (value) => normalise(value).toLocaleLowerCase("en-US");

const listFiles = async (directory) => {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const target = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await listFiles(target));
    else if (entry.isFile()) files.push(target);
  }
  return files;
};

const exists = async (target) => {
  try { await access(target); return true; } catch { return false; }
};

const files = await listFiles(DIST);
const htmlFiles = files.filter((file) => file.endsWith(".html"));
const errors = [];
const pageRecords = [];
let imageCount = 0;
let emptyDecorativeAltCount = 0;
let renderedAltReviewCount = 0;
let unnamedImageLinkReviewCount = 0;
let fragmentLinksChecked = 0;
let externalScriptCount = 0;
let externalFormCount = 0;
let contentButtonCount = 0;

for (const file of htmlFiles) {
  const label = relative(DIST, file).replaceAll("\\", "/");
  const source = await readFile(file, "utf8");
  const $ = load(source);
  const redirect = $('meta[http-equiv="refresh" i]').length > 0;
  const title = normalise($("title").text());
  const description = normalise($('meta[name="description"]').attr("content"));
  const canonical = normalise($('link[rel="canonical"]').attr("href"));
  pageRecords.push({ label, redirect, title, description, canonical });

  const viewport = $('meta[name="viewport"]').attr("content") ?? "";
  if (/user-scalable\s*=\s*no|maximum-scale\s*=\s*(?:0|1)(?:\D|$)/i.test(viewport)) {
    errors.push(`${label}: viewport prevents 200% zoom`);
  }

  const headingLevels = $("main h1, main h2, main h3, main h4, main h5, main h6")
    .toArray().map((element) => Number(element.tagName.slice(1)));
  for (let index = 1; index < headingLevels.length; index += 1) {
    if (headingLevels[index] > headingLevels[index - 1] + 1) {
      errors.push(`${label}: heading hierarchy skips from h${headingLevels[index - 1]} to h${headingLevels[index]}`);
      break;
    }
  }

  for (const element of $("img").toArray()) {
    imageCount += 1;
    const image = $(element);
    const alt = image.attr("alt");
    if (alt === undefined) errors.push(`${label}: image is missing an alt attribute`);
    if (alt === "") {
      const labelledLink = image.closest("a[aria-label]").length > 0;
      const explicitlyDecorative = image.attr("role") === "presentation" || image.attr("aria-hidden") === "true";
      if (!labelledLink && !explicitlyDecorative) renderedAltReviewCount += 1;
      else emptyDecorativeAltCount += 1;
    }
    if (!image.attr("width") || !image.attr("height")) errors.push(`${label}: image lacks intrinsic width/height`);
  }

  for (const element of $("a[href]").toArray()) {
    const anchor = $(element);
    const href = anchor.attr("href") ?? "";
    const accessibleName = normalise(anchor.attr("aria-label") || anchor.text() || anchor.find("img[alt]").attr("alt"));
    if (!accessibleName && !href.startsWith("#")) {
      if (anchor.find('img[alt=""]').length) unnamedImageLinkReviewCount += 1;
      else errors.push(`${label}: link ${href} has no accessible name`);
    }
    if (!href.includes("#") || /^(?:mailto:|tel:|javascript:)/i.test(href)) continue;
    let url;
    try { url = new URL(href, "http://localhost:4321/" ); } catch { continue; }
    if (url.origin !== "http://localhost:4321" || !url.hash) continue;
    fragmentLinksChecked += 1;
    const logicalPath = decodeURI(url.pathname) || "/";
    const targetFile = outputFileForLogicalPath(logicalPath, DIST);
    if (!await exists(targetFile)) continue;
    const targetSource = await readFile(targetFile, "utf8");
    const target = load(targetSource);
    const id = decodeURIComponent(url.hash.slice(1));
    if (!target(`[id="${id.replaceAll('"', '\\"')}"]`).length) errors.push(`${label}: broken fragment ${href}`);
  }

  for (const element of $(".content-button-row").toArray()) {
    const buttons = $(element).children("a.content-button[href]");
    if (buttons.length !== 1) errors.push(`${label}: content button row must contain exactly one linked button`);
  }
  for (const element of $("a.content-button").toArray()) {
    contentButtonCount += 1;
    if (!$(element).closest(".content-button-row").length) errors.push(`${label}: content button is missing its alignment container`);
  }

  for (const script of $("script[src]").toArray()) {
    const src = $(script).attr("src");
    if (src && new URL(src, "http://localhost:4321/").origin !== "http://localhost:4321") externalScriptCount += 1;
  }
  for (const form of $("form[action]").toArray()) {
    const action = $(form).attr("action");
    if (action && new URL(action, "http://localhost:4321/").origin !== "http://localhost:4321") externalFormCount += 1;
  }
  if (/(?:ghp_|github_pat_|sk-[A-Za-z0-9]{20,}|client_secret\s*[=:])/i.test(source)) {
    errors.push(`${label}: possible secret pattern in generated HTML`);
  }
}

const duplicateValues = (field) => {
  const grouped = new Map();
  for (const page of pageRecords.filter((record) => !record.redirect && !["404.html", "admin.html"].includes(record.label))) {
    const key = normaliseKey(page[field]);
    if (!key) continue;
    grouped.set(key, [...(grouped.get(key) ?? []), page.label]);
  }
  return [...grouped.values()].filter((labels) => labels.length > 1);
};

for (const labels of duplicateValues("title")) errors.push(`duplicate title: ${labels.join(", ")}`);
for (const labels of duplicateValues("description")) errors.push(`duplicate meta description: ${labels.join(", ")}`);
for (const labels of duplicateValues("canonical")) errors.push(`duplicate canonical: ${labels.join(", ")}`);

const homeSource = await readFile(join(DIST, "index.html"), "utf8");
const home = load(homeSource);
const homeActions = home("main a.content-button").toArray().map((element) => normalise(home(element).text()));
const requiredActions = ["Meer info over mijn boek!", "Aanbod nascholingen", "Mijn lesmateriaal", "Neem contact op!"];
if (normalise(home("main h1").text()) !== "Hoi, ik ben Robbe!") errors.push("home: source heading is not preserved");
if (!normalise(home("main").text()).includes("Ik ben leraar programmeren, artificiële intelligentie en Design Thinking in Gent.")) {
  errors.push("home: original Dutch introduction is missing");
}
if (home("main img").length !== 2) errors.push(`home: expected 2 source images, found ${home("main img").length}`);
for (const label of requiredActions) if (!homeActions.includes(label)) errors.push(`home: missing source action ${label}`);
if (/Technologie begrijpelijk maken|Eén plek, drie duidelijke ingangen|Gedeelde ontwerpgrammatica/.test(home("main").text())) {
  errors.push("home: superseded P4 prototype copy is still rendered");
}

const rssReports = [];
for (const feedPath of ["onderwijs/rss.xml", "education/rss.xml"]) {
  const file = join(DIST, feedPath);
  if (!await exists(file)) {
    errors.push(`${feedPath}: RSS output is missing`);
    continue;
  }
  const xml = load(await readFile(file, "utf8"), { xmlMode: true });
  const items = xml("channel > item").length;
  if (!xml("rss").length || !xml("channel > title").text().trim() || items === 0) errors.push(`${feedPath}: invalid or empty RSS output`);
  rssReports.push({ path: `/${feedPath}`, items });
}

const homeReferenced = new Set();
for (const element of home('link[rel="stylesheet"][href], script[src], img[src]').toArray()) {
  const raw = home(element).attr("href") ?? home(element).attr("src");
  if (!raw || /^https?:/i.test(raw)) continue;
  homeReferenced.add(join(DIST, decodeURI(raw.split("?")[0].replace(/^\//, ""))));
}
let homeTransferredBytes = Buffer.byteLength(homeSource);
for (const target of homeReferenced) if (await exists(target)) homeTransferredBytes += (await stat(target)).size;
if (homeTransferredBytes > 1_500_000) errors.push(`home: initial HTML/CSS/JS/image payload exceeds 1.5 MB (${homeTransferredBytes} bytes)`);

const media = parseYaml(await readFile(resolve(ROOT, "src/content/media/media.yaml"), "utf8"));
const ledger = JSON.parse(await readFile(resolve(ROOT, "migration/asset-ledger.json"), "utf8"));
const taxonomy = JSON.parse(await readFile(resolve(ROOT, "src/data/taxonomy-routes.json"), "utf8"));
const contentInventory = JSON.parse(await readFile(resolve(ROOT, "migration/reports/P5-content-inventory.json"), "utf8"));
const authorSource = await readFile(resolve(ROOT, "src/content/authors/robbe-wulgaert.md"), "utf8");
const unrenderedAuthorButtons = authorSource.match(/<a class="content-button\b/g)?.length ?? 0;
const renderedSourceButtonMinimum = contentInventory.counts.source_buttons - unrenderedAuthorButtons;
if (contentButtonCount < renderedSourceButtonMinimum) {
  errors.push(`content: expected at least ${renderedSourceButtonMinimum} migrated buttons, found ${contentButtonCount}`);
}
const collisionGroups = new Map();
for (const route of taxonomy) {
  const key = route.path.toLocaleLowerCase("en-US");
  collisionGroups.set(key, [...(collisionGroups.get(key) ?? []), route.path]);
}
const caseOnlyCollisionGroups = [...collisionGroups.values()].filter((paths) => new Set(paths).size > 1);
const ownerDecisions = {
  native_video_records: ledger.filter((record) => record.status !== "downloaded").length,
  media_alt_review_records: media.filter((record) => record.requires_alt_review).length,
  media_rights_review_records: media.filter((record) => record.needs_rights_review).length,
  case_only_taxonomy_collision_groups: caseOnlyCollisionGroups.length
};

if (externalScriptCount !== 0) errors.push(`security: ${externalScriptCount} external scripts are not inventoried`);
if (externalFormCount !== 0) errors.push(`privacy: ${externalFormCount} external form processors are present`);

const report = {
  schema_version: "1.0.0",
  generated_at: new Date().toISOString(),
  automated_status: errors.length ? "failed" : "passed",
  phase_status: errors.length ? "failed" : Object.values(ownerDecisions).some(Boolean) ? "owner_decisions_pending" : "passed",
  pages_checked: htmlFiles.length,
  images_checked: imageCount,
  decorative_images_with_labelled_links: emptyDecorativeAltCount,
  rendered_images_pending_alt_review: renderedAltReviewCount,
  image_links_pending_accessible_name_review: unnamedImageLinkReviewCount,
  fragment_links_checked: fragmentLinksChecked,
  duplicate_titles: duplicateValues("title").length,
  duplicate_meta_descriptions: duplicateValues("description").length,
  duplicate_canonicals: duplicateValues("canonical").length,
  external_scripts: externalScriptCount,
  external_forms: externalFormCount,
  content_buttons: contentButtonCount,
  migrated_source_buttons: contentInventory.counts.source_buttons,
  unrendered_author_buttons: unrenderedAuthorButtons,
  home_initial_payload_bytes: homeTransferredBytes,
  rss: rssReports,
  owner_decisions: ownerDecisions,
  errors
};

await mkdir(dirname(REPORT), { recursive: true });
await writeFile(REPORT, `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report, null, 2));
if (errors.length) process.exitCode = 1;
