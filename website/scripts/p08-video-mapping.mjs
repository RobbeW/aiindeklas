import fs from "node:fs/promises";
import path from "node:path";
import { load } from "cheerio";

export async function getDeferredVideoIdsInSourceOrder({ root, record, candidates, deferrals }) {
  const snapshot = record.source_artifacts?.source_snapshot;
  if (!snapshot) throw new Error(`P08 source snapshot missing for article ${record.id}.`);
  const snapshotPath = path.resolve(root, snapshot);
  const html = await fs.readFile(snapshotPath, "utf8");
  const $ = load(html);
  const candidateByTemplate = new Map(candidates
    .filter((candidate) => candidate.source_template)
    .map((candidate) => [candidate.source_template, candidate]));
  const deferralById = new Map(deferrals.map((item) => [item.id, item]));
  const orderedIds = [];
  $(".sqs-native-video[data-config-video]").each((_, element) => {
    const raw = $(element).attr("data-config-video");
    let config;
    try { config = JSON.parse(raw); } catch (error) {
      throw new Error(`Cannot parse native video config in ${snapshot}: ${error.message}`);
    }
    const candidate = candidateByTemplate.get(config.alexandriaUrl);
    if (!candidate || !deferralById.has(candidate.id)) return;
    if (!(candidate.used_by ?? []).includes(record.id)) {
      throw new Error(`Source snapshot ${snapshot} contains ${candidate.id}, but it is not assigned to ${record.id} in asset-candidates.json.`);
    }
    orderedIds.push(candidate.id);
  });
  return orderedIds;
}

export function deferredMarkerIdsInOrder(markdown, deferrals) {
  const deferredUrls = new Set(deferrals.map((item) => item.source_url));
  const ids = [];
  const slotPattern = /<!--\s*p08-deferred:(media-[a-f0-9]+)\s*-->|Video deferred pending owner source\.|\[Video\]\((https:\/\/video\.squarespace-cdn\.com\/[^)]+)\)/g;
  for (const match of markdown.matchAll(slotPattern)) {
    if (match[1]) ids.push(match[1]);
    else if (!match[2] || deferredUrls.has(match[2])) ids.push(null);
  }
  return ids;
}
