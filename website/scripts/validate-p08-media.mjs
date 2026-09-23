import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import crypto from "node:crypto";
import YAML from "yaml";
import { load } from "cheerio";
import { deferredMarkerIdsInOrder, getDeferredVideoIdsInSourceOrder } from "./p08-video-mapping.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PROJECT = path.resolve(ROOT, "..");
const args = new Map(process.argv.slice(2).map((arg) => {
  const [key, ...value] = arg.replace(/^--/, "").split("=");
  return [key, value.join("=") || true];
}));
const manifestPath = path.join(PROJECT, "docs/implementation/manifests/assets-p08.json");
const media = YAML.parse(await fs.readFile(path.join(ROOT, "src/content/media/media.yaml"), "utf8"));
const candidates = JSON.parse(await fs.readFile(path.join(ROOT, "migration/asset-candidates.json"), "utf8")).candidates;
const content = YAML.parse(await fs.readFile(path.join(PROJECT, "docs/implementation/manifests/content.yaml"), "utf8"));
const deferrals = JSON.parse(await fs.readFile(path.join(PROJECT, "docs/implementation/manifests/native-video-deferrals.json"), "utf8"));
const videoTablePath = path.join(PROJECT, "docs/implementation/manifests/missing-native-videos.md");
const manifest = JSON.parse(await fs.readFile(manifestPath, "utf8"));
const problems = [];
const fail = (message) => problems.push(message);
const pathExists = async (repoPath) => {
  try { await fs.access(path.resolve(ROOT, repoPath)); return true; } catch { return false; }
};

if (manifest.candidate_count !== 847 || manifest.assets.length !== 847) fail(`Manifest count mismatch: ${manifest.assets.length} assets.`);
if (manifest.downloaded_count !== 829 || media.length !== 829) fail(`Downloaded count mismatch: ${media.length}.`);
if (manifest.deferred_native_video_count !== 18 || deferrals.items.length !== 18) fail(`Video deferral count mismatch: ${deferrals.items.length}.`);
const allCandidateIds = new Set(candidates.map((candidate) => candidate.id));
const manifestIds = manifest.assets.map((asset) => asset.id);
if (new Set(manifestIds).size !== manifestIds.length) fail("Manifest has duplicate candidate IDs.");
if (manifestIds.length !== allCandidateIds.size || manifestIds.some((id) => !allCandidateIds.has(id))) fail("Manifest IDs do not reconcile with asset-candidates.json.");
const candidateById = new Map(candidates.map((candidate) => [candidate.id, candidate]));
const manifestById = new Map(manifest.assets.map((asset) => [asset.id, asset]));
const failedMediaById = new Map((content.content_records.failed_media ?? []).map((candidate) => [candidate.id, candidate]));
if (failedMediaById.size !== 18 || deferrals.items.length !== failedMediaById.size) fail("P01 failed-media and P08 deferral record counts differ.");
for (const item of deferrals.items) {
  const candidate = candidateById.get(item.id);
  const failed = failedMediaById.get(item.id);
  const asset = manifestById.get(item.id);
  if (!candidate || candidate.source_url !== item.source_url) fail(`Deferral source mismatch: ${item.id}.`);
  if (!failed || failed.source_url !== item.source_url) fail(`P01 failed-media source mismatch: ${item.id}.`);
  if (asset?.status !== "deferred_pending_owner_source" || asset.source_url !== item.source_url) fail(`Deferred manifest entry mismatch: ${item.id}.`);
  if (!item.section_context || /unavailable|placeholder/i.test(item.section_context)) fail(`Missing source-derived context for deferred video ${item.id}.`);
}
for (const id of failedMediaById.keys()) if (!deferrals.items.some((item) => item.id === id)) fail(`P01 failed-media candidate absent from deferral decision: ${id}.`);
const tableSource = await fs.readFile(videoTablePath, "utf8");
const tableLines = tableSource.split(/\r?\n/).filter((line) => /^\|\s*`media-/.test(line));
const tableRowsById = new Map();
for (const line of tableLines) {
  const cells = line.split("|").slice(1, -1).map((cell) => cell.trim());
  const id = cells[0]?.match(/^`([^`]+)`$/)?.[1];
  if (!id || tableRowsById.has(id)) { fail(`Missing or duplicate native-video table row: ${id ?? line}`); continue; }
  tableRowsById.set(id, cells);
}
if (tableRowsById.size !== failedMediaById.size) fail(`Owner table has ${tableRowsById.size} video rows; expected ${failedMediaById.size}.`);
for (const [id, failed] of failedMediaById) {
  const cells = tableRowsById.get(id);
  if (!cells) { fail(`P01 failed-media item missing from owner table: ${id}.`); continue; }
  const uuid = failed.source_url.match(/\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})(?:\/|$)/i)?.[1];
  const tableUuid = cells[1]?.match(/^`([^`]+)`$/)?.[1];
  const linkedUrl = cells[2]?.match(/^\[source\]\((.+)\)$/)?.[1];
  if (!uuid || tableUuid !== uuid) fail(`Owner table UUID mismatch for ${id}: expected ${uuid ?? "extractable UUID"}, found ${tableUuid ?? "missing"}.`);
  if (linkedUrl !== failed.source_url) fail(`Owner table source URL mismatch for ${id}: expected the exact P01 source URL.`);
}
const usedIds = new Set(Object.values(content.content_records).flat().map((record) => record.id));
for (const asset of manifest.assets) {
  for (const recordId of asset.used_by ?? []) if (!usedIds.has(recordId)) fail(`${asset.id} has unknown used_by record ${recordId}.`);
  if (asset.status === "downloaded") {
    if (!asset.source_url || !asset.source_filename || !asset.sha256 || !asset.original_path || !asset.output_path || !asset.mime_type || !asset.byte_size) fail(`${asset.id} is missing provenance or file metadata.`);
    for (const relative of [asset.original_path, asset.output_path, ...(asset.derivatives ?? []).map((derivative) => derivative.path)]) {
      if (!await pathExists(relative)) fail(`${asset.id} path missing: ${relative}`);
    }
    try {
      const original = await fs.readFile(path.resolve(ROOT, asset.original_path));
      const actual = crypto.createHash("sha256").update(original).digest("hex");
      if (actual !== asset.sha256) fail(`${asset.id} original SHA-256 mismatch.`);
    } catch (error) { fail(`${asset.id} original could not be read: ${error.message}`); }
  }
}

const localMarkdownRefs = [];
const walk = async (dir) => {
  for (const item of await fs.readdir(dir, { withFileTypes: true })) {
    const target = path.join(dir, item.name);
    if (item.isDirectory()) await walk(target);
    else if (/\.mdx?$/i.test(item.name)) localMarkdownRefs.push(target);
  }
};
await walk(path.join(ROOT, "src/content"));
const sourceMarkerCounts = new Map(deferrals.items.map((item) => [item.id, 0]));
let videoArticlesChecked = 0;
let multiVideoArticlesChecked = 0;
const videoMappings = [];
for (const record of content.content_records.articles) {
  const articleFile = path.resolve(PROJECT, record.source_path);
  const source = await fs.readFile(articleFile, "utf8");
  const expected = await getDeferredVideoIdsInSourceOrder({ root: ROOT, record, candidates, deferrals: deferrals.items });
  const actual = deferredMarkerIdsInOrder(source, deferrals.items);
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    fail(`${record.id} deferred-video marker order mismatch: expected ${JSON.stringify(expected)}, found ${JSON.stringify(actual)}.`);
  }
  if (expected.length) videoMappings.push({ record_id: record.id, source_snapshot: record.source_artifacts.source_snapshot, expected_ids: expected, actual_ids: actual, ordered_match: JSON.stringify(actual) === JSON.stringify(expected) });
  if (expected.length) videoArticlesChecked += 1;
  if (expected.length > 1) multiVideoArticlesChecked += 1;
}
for (const file of localMarkdownRefs) {
  const source = await fs.readFile(file, "utf8");
  for (const match of source.matchAll(/!?\[[^\]]*\]\(([^)]+)\)/g)) {
    const href = match[1].split(/[?#]/)[0];
    if (!href.includes("assets/migrated/")) continue;
    const resolved = href.startsWith("/") ? path.join(ROOT, "src", href.slice(1)) : path.resolve(path.dirname(file), href);
    try { await fs.access(resolved); } catch { fail(`Source content references missing media: ${path.relative(ROOT, file)} -> ${href}`); }
  }
  for (const item of deferrals.items) {
    if (source.includes(`[Video](${item.source_url})`)) fail(`Deferred video source link remains in ${path.relative(ROOT, file)}: ${item.id}`);
    sourceMarkerCounts.set(item.id, sourceMarkerCounts.get(item.id) + source.split(`<!-- p08-deferred:${item.id} -->`).length - 1);
    if (source.includes("Video deferred pending owner source.")) fail(`Visible deferral text remains in source content: ${path.relative(ROOT, file)}.`);
  }
}
for (const item of deferrals.items) {
  const expected = failedMediaById.get(item.id)?.used_by?.length ?? 0;
  if (sourceMarkerCounts.get(item.id) !== expected) fail(`${item.id} source marker count ${sourceMarkerCounts.get(item.id)} does not match P01 usages ${expected}.`);
}

const builtArg = args.get("built");
let builtSummary = null;
if (builtArg) {
  const builtRoot = path.resolve(ROOT, String(builtArg));
  const base = String(args.get("base") ?? "/");
  const htmlFiles = [];
  const walkBuilt = async (dir) => {
    for (const item of await fs.readdir(dir, { withFileTypes: true })) {
      const target = path.join(dir, item.name);
      if (item.isDirectory()) await walkBuilt(target);
      else if (/\.html?$/i.test(item.name)) htmlFiles.push(target);
    }
  };
  try { await walkBuilt(builtRoot); } catch (error) { fail(`Built directory unavailable (${builtRoot}): ${error.message}`); }
  let checkedRefs = 0;
  let nativeVideoUrls = 0;
  let visibleDeferralStrings = 0;
  for (const file of htmlFiles) {
    const $ = load(await fs.readFile(file, "utf8"));
    const html = $.html();
    for (const item of deferrals.items) if (html.includes(item.source_url)) nativeVideoUrls += 1;
    visibleDeferralStrings += html.split("Video deferred pending owner source.").length - 1;
    const builtMediaRefs = [];
    $("img[src], source[src], video[src], audio[src], video[poster]").each((_, element) => {
      const node = $(element);
      for (const attr of ["src", "poster"]) {
        const value = node.attr(attr);
        if (!value || /^(?:https?:|data:|blob:|#)/i.test(value)) continue;
        const urlPath = decodeURIComponent(value.split(/[?#]/)[0]);
        let relative = urlPath.replace(/^\//, "");
        if (base !== "/" && relative.startsWith(base.replace(/^\//, ""))) relative = relative.slice(base.replace(/^\//, "").length);
        const target = path.resolve(builtRoot, relative);
        builtMediaRefs.push({ target, value });
      }
    });
    for (const reference of builtMediaRefs) {
      checkedRefs += 1;
      try { await fs.access(reference.target); } catch { fail(`Built media missing: ${path.relative(builtRoot, file)} -> ${reference.value}`); }
    }
  }
  if (nativeVideoUrls) fail(`Built HTML contains ${nativeVideoUrls} deferred Squarespace video URL references.`);
  if (visibleDeferralStrings) fail(`Built HTML contains ${visibleDeferralStrings} visible deferral placeholders.`);
  builtSummary = { html_files: htmlFiles.length, media_references_checked: checkedRefs, deferred_video_url_hits: nativeVideoUrls, visible_deferral_strings: visibleDeferralStrings, base };
}

const result = {
  schema: "website-migration.p08-validation/v1",
  passed: problems.length === 0,
  counts: {
    candidates: manifest.assets.length,
    downloaded: media.length,
    deferred_native_videos: deferrals.items.length,
    owner_table_rows: tableRowsById.size,
    output_path_records: manifest.assets.filter((asset) => asset.output_path).length,
    source_markdown_files: localMarkdownRefs.length,
    video_articles_checked: videoArticlesChecked,
    multi_video_articles_checked: multiVideoArticlesChecked,
    duplicate_groups: manifest.duplicate_summary.exact_payload_groups,
    unique_output_paths: manifest.physical_output_summary.unique_output_paths,
    delivered_bytes: manifest.physical_output_summary.delivered_bytes,
    oversized_unique_outputs: manifest.oversized_summary.retained_unique_outputs,
    outputs_over_5_mib: manifest.physical_output_summary.outputs_over_5_mib,
    alt_review_required: manifest.review_summary.alt_review_required,
    rights_review_required: manifest.review_summary.rights_review_required,
  },
  video_mapping: videoMappings,
  built: builtSummary,
  problems,
};
await fs.writeFile(path.join(ROOT, "migration/reports/P08-media-validation.json"), `${JSON.stringify(result, null, 2)}\n`);
console.log(JSON.stringify(result, null, 2));
if (problems.length) process.exitCode = 1;
