import fs from "node:fs/promises";
import path from "node:path";
import YAML from "yaml";
import { deferredMarkerIdsInOrder, getDeferredVideoIdsInSourceOrder } from "./p08-video-mapping.mjs";

const ROOT = process.cwd();
const content = YAML.parse(await fs.readFile(path.resolve(ROOT, "../docs/implementation/manifests/content.yaml"), "utf8"));
const candidates = JSON.parse(await fs.readFile(path.join(ROOT, "migration/asset-candidates.json"), "utf8")).candidates;
const deferrals = JSON.parse(await fs.readFile(path.resolve(ROOT, "../docs/implementation/manifests/native-video-deferrals.json"), "utf8"));
if (deferrals.decision !== "deferred_pending_owner_source" || deferrals.items.length !== 18) {
  throw new Error("Expected the 18 owner-approved native video deferrals.");
}

const deferralUrls = new Set(deferrals.items.map((item) => item.source_url));
let linksReplaced = 0;
let staleMarkersCorrected = 0;
let markerCount = 0;
for (const record of content.content_records.articles) {
  const file = path.resolve(ROOT, "..", record.source_path);
  let markdown = await fs.readFile(file, "utf8");
  const orderedIds = await getDeferredVideoIdsInSourceOrder({ root: ROOT, record, candidates, deferrals: deferrals.items });
  const currentSlots = deferredMarkerIdsInOrder(markdown, deferrals.items);
  if (currentSlots.length !== orderedIds.length) {
    throw new Error(`${record.id}: source snapshot has ${orderedIds.length} deferred videos, transformed Markdown has ${currentSlots.length} slots.`);
  }
  if (!orderedIds.length) continue;

  let index = 0;
  const slotPattern = /<!--\s*p08-deferred:(media-[a-f0-9]+)\s*-->|Video deferred pending owner source\.|\[Video\]\((https:\/\/video\.squarespace-cdn\.com\/[^)]+)\)/g;
  markdown = markdown.replace(slotPattern, (match, existingId, sourceUrl) => {
    const deferredSlot = existingId || !sourceUrl || deferralUrls.has(sourceUrl);
    if (!deferredSlot) return match;
    const expectedId = orderedIds[index++];
    if (sourceUrl) linksReplaced += 1;
    else if (existingId && existingId !== expectedId) staleMarkersCorrected += 1;
    return `<!-- p08-deferred:${expectedId} -->`;
  });
  markerCount += orderedIds.length;
  await fs.writeFile(file, markdown);
}

console.log(JSON.stringify({
  decision: deferrals.decision,
  candidates: deferrals.items.length,
  source_marker_occurrences: markerCount,
  links_replaced: linksReplaced,
  stale_markers_corrected: staleMarkersCorrected,
}));
