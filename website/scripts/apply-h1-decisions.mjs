import { readFile, writeFile } from "node:fs/promises";

const manifestPath = new URL("../migration/source-manifest.json", import.meta.url);
const ledgerPath = new URL("../migration/url-ledger.csv", import.meta.url);
const manifest = JSON.parse(await readFile(manifestPath, "utf8"));

const redirects = new Map([
  ["https://www.robbewulgaert.be/contact-english", "/contactinfo"]
]);

const derived = new Set([
  "https://www.robbewulgaert.be/education/tag/%23VlaanderenLeest",
  "https://www.robbewulgaert.be/education/tag/latin"
]);

const outOfScope = new Set([
  "https://www.robbewulgaert.be/fotografie",
  "https://www.robbewulgaert.be/fotografie/j-s",
  "https://www.robbewulgaert.be/fotografie/tk-russell-heartbeat-session",
  "https://www.robbewulgaert.be/videografie-1",
  "https://www.robbewulgaert.be/videografie/covid-yasmina-jongbloet",
  "https://www.robbewulgaert.be/videografie/hout-op-maat",
  "https://www.robbewulgaert.be/videografie/jakobistan-fietspad",
  "https://www.robbewulgaert.be/videografie/mathias-vercammen-quartet-herbakker-eeklo",
  "https://www.robbewulgaert.be/videografie/matthias-de-smet-hongyu-chen",
  "https://www.robbewulgaert.be/videografie/promotievideos-montage",
  "https://www.robbewulgaert.be/videografie/wielerkampen-cartouche"
]);

const inaccessible = new Set([
  "https://www.robbewulgaert.be/info"
]);

const noncanonical = new Set([
  "https://www.robbewulgaert.be/onderwijs?author=6026af1f0584116c943938d2&offset=1666788262501&reversePaginate=true"
]);

for (const record of manifest.pages) {
  if (redirects.has(record.url)) {
    record.disposition = "redirect";
    record.target_path = redirects.get(record.url);
  } else if (derived.has(record.url)) {
    record.disposition = "excluded_derived_from_articles";
  } else if (outOfScope.has(record.url)) {
    record.disposition = "excluded_out_of_scope";
  } else if (inaccessible.has(record.url)) {
    record.disposition = "excluded_inaccessible";
  } else if (noncanonical.has(record.url)) {
    record.disposition = "excluded_noncanonical";
  } else {
    continue;
  }

  record.decision_gate = "H1";
  record.decision_status = "approved";
  record.decision_date = "2026-07-16";
}

const decided = manifest.pages.filter((record) => record.decision_gate === "H1");
if (decided.length !== 16) {
  throw new Error(`Expected 16 H1 decisions, found ${decided.length}`);
}

manifest.summary.approved_redirects = decided.filter((record) => record.disposition === "redirect").length;
manifest.summary.approved_exclusions = decided.filter((record) => record.disposition !== "redirect").length;
manifest.summary.unresolved_manual_review = 0;
manifest.approvals = {
  ...(manifest.approvals ?? {}),
  H1: {
    status: "approved",
    date: "2026-07-16",
    note: "Photography and videography routes are owner-approved out-of-scope exclusions."
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
  decided: decided.length,
  redirects: manifest.summary.approved_redirects,
  exclusions: manifest.summary.approved_exclusions
}, null, 2));

