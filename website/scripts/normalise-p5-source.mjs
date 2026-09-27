import { readFile, writeFile } from "node:fs/promises";

const manifestPath = new URL("../migration/source-manifest.json", import.meta.url);
const ledgerPath = new URL("../migration/url-ledger.csv", import.meta.url);
const manifest = JSON.parse(await readFile(manifestPath, "utf8"));

const categoryRecords = manifest.pages.filter((record) => {
  const pathname = new URL(record.url).pathname;
  return pathname.startsWith("/onderwijs/category/") || pathname.startsWith("/education/category/");
});

if (categoryRecords.length !== 8) {
  throw new Error(`Expected 8 category archives, found ${categoryRecords.length}`);
}

for (const record of categoryRecords) record.classification = "tag_archive";

manifest.summary.semantic_articles = manifest.pages.filter(
  ({ classification }) => classification === "article"
).length;
manifest.summary.derived_taxonomy_archives = manifest.pages.filter(
  ({ classification }) => classification === "tag_archive"
).length;
manifest.normalisations = {
  ...(manifest.normalisations ?? {}),
  P5_category_archives: {
    date: "2026-07-16",
    count: categoryRecords.length,
    reason: "Squarespace /category/ routes are generated archives, not editorial articles."
  }
};

await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

const columns = [
  "url", "final_url", "classification", "http_status", "ok", "content_type",
  "fetched_at", "response_bytes", "sha256", "raw_path", "crawl_status",
  "disposition", "target_path", "decision_gate", "decision_status",
  "discovered_from", "discovery_source", "error"
];
const csvCell = (value) => {
  const text = value === null || value === undefined ? "" : String(value);
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
};
const rows = [columns.join(",")];
for (const record of [...manifest.pages, ...manifest.assets]) {
  rows.push(columns.map((column) => csvCell(record[column])).join(","));
}
await writeFile(ledgerPath, `${rows.join("\n")}\n`);

console.log(JSON.stringify({
  category_archives_reclassified: categoryRecords.length,
  semantic_articles: manifest.summary.semantic_articles,
  derived_taxonomy_archives: manifest.summary.derived_taxonomy_archives
}, null, 2));
