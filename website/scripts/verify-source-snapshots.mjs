import { createHash } from "node:crypto";
import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const manifestPath = path.join(root, "migration", "source-manifest.json");
const rawRoot = path.join(root, "migration", "raw-html");
const reportPath = path.join(root, "migration", "reports", "snapshot-verification.json");
const manifest = JSON.parse(await readFile(manifestPath, "utf8"));

const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
const results = [];
const referencedRawFiles = new Set();

for (const record of manifest.pages) {
  if (record.crawl_status !== "snapshotted") {
    const approved = record.decision_gate === "H1" && record.decision_status === "approved";
    results.push({
      url: record.url,
      status: approved ? "approved_exception" : "unresolved_exception",
      disposition: record.disposition ?? null,
      expected_sha256: record.sha256 ?? null,
      actual_sha256: null,
      raw_path: record.raw_path ?? null
    });
    continue;
  }

  const relativeRawPath = record.raw_path;
  if (!relativeRawPath) {
    results.push({ url: record.url, status: "missing_raw_path" });
    continue;
  }

  const absoluteRawPath = path.join(root, ...relativeRawPath.split("/"));
  referencedRawFiles.add(path.basename(absoluteRawPath));
  try {
    const bytes = await readFile(absoluteRawPath);
    const actualHash = sha256(bytes);
    results.push({
      url: record.url,
      status: actualHash === record.sha256 ? "verified" : "hash_mismatch",
      expected_sha256: record.sha256,
      actual_sha256: actualHash,
      response_bytes: bytes.length,
      raw_path: relativeRawPath
    });
  } catch (error) {
    results.push({
      url: record.url,
      status: "missing_raw_file",
      expected_sha256: record.sha256,
      actual_sha256: null,
      raw_path: relativeRawPath,
      error: error instanceof Error ? error.message : String(error)
    });
  }
}

const rawFiles = (await readdir(rawRoot)).filter((name) => name !== ".gitkeep");
const orphanFiles = rawFiles.filter((name) => !referencedRawFiles.has(name)).sort();
const summary = {
  generated_at: new Date().toISOString(),
  page_records: manifest.pages.length,
  verified_snapshots: results.filter((result) => result.status === "verified").length,
  approved_exceptions: results.filter((result) => result.status === "approved_exception").length,
  unresolved_exceptions: results.filter((result) => result.status === "unresolved_exception").length,
  missing_raw_paths: results.filter((result) => result.status === "missing_raw_path").length,
  missing_raw_files: results.filter((result) => result.status === "missing_raw_file").length,
  hash_mismatches: results.filter((result) => result.status === "hash_mismatch").length,
  orphan_raw_files: orphanFiles.length,
  gate_passed: results.every((result) => ["verified", "approved_exception"].includes(result.status))
};

await writeFile(reportPath, `${JSON.stringify({
  schema_version: "1.0.0",
  ...summary,
  orphan_files: orphanFiles,
  results
}, null, 2)}\n`);

console.log(JSON.stringify(summary, null, 2));
if (!summary.gate_passed) process.exitCode = 1;

