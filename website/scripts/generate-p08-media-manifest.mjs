import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import YAML from "yaml";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PROJECT = path.resolve(ROOT, "..");
const mediaPath = path.join(ROOT, "src/content/media/media.yaml");
const candidatesPath = path.join(ROOT, "migration/asset-candidates.json");
const contentPath = path.join(PROJECT, "docs/implementation/manifests/content.yaml");
const manifestPath = path.join(PROJECT, "docs/implementation/manifests/assets-p08.json");
const videoTablePath = path.join(PROJECT, "docs/implementation/manifests/missing-native-videos.md");

const media = YAML.parse(await fs.readFile(mediaPath, "utf8"));
const candidates = JSON.parse(await fs.readFile(candidatesPath, "utf8")).candidates;
const content = YAML.parse(await fs.readFile(contentPath, "utf8"));
const deferrals = JSON.parse(await fs.readFile(path.join(PROJECT, "docs/implementation/manifests/native-video-deferrals.json"), "utf8"));
const deferralById = new Map(deferrals.items.map((item) => [item.id, item]));
const failedMediaById = new Map((content.content_records.failed_media ?? []).map((item) => [item.id, item]));
const contentRecords = Object.values(content.content_records).flat();
const recordById = new Map(contentRecords.map((record) => [record.id, record]));
const downloadedById = new Map(media.map((record) => [record.id, record]));
const duplicateGroups = new Map();
for (const record of media) {
  const group = duplicateGroups.get(record.sha256) ?? [];
  group.push(record);
  duplicateGroups.set(record.sha256, group);
}
const duplicateGroupIds = new Map(
  [...duplicateGroups.entries()].filter(([, group]) => group.length > 1)
    .map(([hash]) => [hash, `sha256-${hash}`]),
);

const assets = [
  ...await Promise.all(media.map(async (record) => ({
    ...record,
    status: "downloaded",
    migrated_output_byte_size: (await fs.stat(path.resolve(ROOT, record.output_path))).size,
    duplicate_group: duplicateGroupIds.get(record.sha256) ?? null,
    oversized_review: (await fs.stat(path.resolve(ROOT, record.output_path))).size > 1_048_576
      ? { status: "retained", threshold_bytes: 1_048_576, reason: record.animated
          ? "Retained because animation frames and timing must be preserved; no re-encoding attempted."
          : /\.(?:mp3|m4a|wav|ogg|flac)$/i.test(record.output_path)
            ? "Retained because audio was not transcoded; no further lossy encoding was attempted."
            : "Retained because the migrated image is already a WebP derivative; no further lossy recompression was attempted." }
      : null,
  }))),
  ...candidates.filter((candidate) => !downloadedById.has(candidate.id)).map((candidate) => ({
    ...candidate,
    status: "deferred_pending_owner_source",
    section_context: deferralById.get(candidate.id)?.section_context ?? null,
    source_template: candidate.source_template ?? null,
    source_variants: candidate.source_variants ?? null,
    original_path: null,
    output_path: null,
    sha256: null,
    mime_type: null,
    byte_size: null,
    width: null,
    height: null,
    animated: null,
    derivatives: [],
    alt: null,
    caption: null,
    decorative: false,
    requires_alt_review: true,
    rights: null,
    needs_rights_review: true,
    alt_review_state: "pending_owner_source",
    rights_review_state: "pending_owner_source",
  })),
];

const videoAssets = assets.filter((asset) => asset.status === "deferred_pending_owner_source");
const compactContext = (text) => text.replace(/^\s*#+\s*/, "").replace(/[\*_`]/g, "").replace(/\s+/g, " ").trim().slice(0, 110);
const contextFor = async (asset, record) => {
  if (!record?.source_path) return "(context unavailable)";
  const sourceFile = path.resolve(PROJECT, record.source_path);
  const source = await fs.readFile(sourceFile, "utf8");
  const lines = source.split(/\r?\n/);
  const url = asset.source_url;
  const index = lines.findIndex((line) => line.includes(url));
  if (index < 0) return "(context unavailable)";
  for (let cursor = index - 1; cursor >= 0; cursor -= 1) {
    if (/^\s*#{1,6}\s+/.test(lines[cursor])) return compactContext(lines[cursor]);
    if (lines[cursor].trim()) return compactContext(lines[cursor]);
  }
  return "(context unavailable)";
};
const tableRows = await Promise.all(videoAssets.map(async (asset) => {
  const failed = failedMediaById.get(asset.id);
  if (!failed || failed.source_url !== asset.source_url) throw new Error(`P01 failed-media source URL mismatch for ${asset.id}.`);
  const uuid = failed.source_url.match(/\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})(?:\/|$)/i)?.[1];
  if (!uuid) throw new Error(`Cannot extract Squarespace video UUID from P01 source URL for ${asset.id}.`);
  const records = (asset.used_by ?? []).map((id) => recordById.get(id)).filter(Boolean);
  const titles = [...new Set(records.map((record) => record.title).filter(Boolean))];
  const routes = [...new Set(records.map((record) => record.current_path ?? record.collection_path).filter(Boolean))];
  const contexts = [asset.section_context ?? [...new Set(await Promise.all(records.map((record) => contextFor(asset, record))))].join("; ")];
  const variants = asset.source_variants ?? "not recorded";
  return `| \`${asset.id}\` | \`${uuid}\` | [source](${failed.source_url}) | ${titles.length ? titles.join("; ") : "(title unavailable)"} | ${routes.length ? routes.map((route) => `\`${route}\``).join(", ") : "(route unavailable)"} | ${contexts.join("; ")} | ${variants} |`;
}));

const groups = [...duplicateGroups.entries()].filter(([, group]) => group.length > 1);
const uniqueOutputRecords = [...new Map(assets.filter((asset) => asset.output_path).map((asset) => [asset.output_path, asset])).values()];
const output = {
  schema: "website-migration.asset-manifest/v1",
  generated_from: [
    "legacy_migration/src/content/media/media.yaml",
    "legacy_migration/migration/asset-candidates.json",
    "docs/implementation/manifests/content.yaml",
  ],
  candidate_count: assets.length,
  downloaded_count: media.length,
  deferred_native_video_count: videoAssets.length,
  duplicate_summary: {
    exact_payload_groups: groups.length,
    records_in_duplicate_groups: groups.reduce((count, [, group]) => count + group.length, 0),
    shared_content_addressed_path_groups: groups.filter(([, group]) => new Set(group.map((record) => record.output_path)).size === 1).length,
    originals_deleted: 0,
  },
  physical_output_summary: {
    unique_output_paths: uniqueOutputRecords.length,
    delivered_bytes: uniqueOutputRecords.reduce((sum, asset) => sum + asset.migrated_output_byte_size, 0),
    outputs_over_1_mib: uniqueOutputRecords.filter((asset) => asset.migrated_output_byte_size > 1_048_576).length,
    outputs_over_5_mib: uniqueOutputRecords.filter((asset) => asset.migrated_output_byte_size > 5_242_880).length,
  },
  oversized_summary: {
    threshold_bytes: 1_048_576,
    retained_unique_outputs: uniqueOutputRecords.filter((asset) => asset.oversized_review).length,
    retained_animated_unique_outputs: uniqueOutputRecords.filter((asset) => asset.oversized_review && asset.animated).length,
    reencoded_records: 0,
  },
  review_summary: {
    alt_review_required: media.filter((record) => record.requires_alt_review).length,
    rights_review_required: media.filter((record) => record.needs_rights_review).length,
    video_alt_review_pending_source: videoAssets.length,
    video_rights_review_pending_source: videoAssets.length,
  },
  assets,
};

await fs.writeFile(manifestPath, `${JSON.stringify(output, null, 2)}\n`);
await fs.writeFile(videoTablePath, [
  "# Missing Squarespace native videos",
  "",
  "These 18 native videos are deferred pending owner sourcing. No replacement media has been inferred or downloaded. The canonical asset manifest preserves each source URL, template, variants, candidate ID, and usage record. Alt text and rights review remain pending until a source is supplied.",
  "",
  "| Candidate ID | Original Squarespace video UUID | P01 source URL | Source content title | Current route | Section or adjacent context | Source variants |",
  "| --- | --- | --- | --- | --- | --- | --- |",
  ...tableRows,
  "",
].join("\n"));

console.log(JSON.stringify({
  manifest: path.relative(PROJECT, manifestPath),
  video_table: path.relative(PROJECT, videoTablePath),
  candidates: assets.length,
  downloaded: media.length,
  deferred_native_videos: videoAssets.length,
  duplicate_groups: groups.length,
  unique_outputs: output.physical_output_summary.unique_output_paths,
  delivered_bytes: output.physical_output_summary.delivered_bytes,
  oversized_unique_outputs: output.oversized_summary.retained_unique_outputs,
}));
