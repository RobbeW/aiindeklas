import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { parse as parseYaml } from "yaml";

const root = fileURLToPath(new URL("../../", import.meta.url));
const manifestPath = path.resolve(root, "../docs/implementation/manifests/content.yaml");

test("article integrity verification reconciles records, suppresses deferred videos, and keeps the Ithaca exception non-clickable", async () => {
  execFileSync(process.execPath, ["scripts/validate-articles.mjs"], { cwd: root, stdio: "pipe" });
  const report = JSON.parse(await readFile(path.join(root, "migration/reports/P06-article-integrity.json"), "utf8"));
  const manifest = parseYaml(await readFile(manifestPath, "utf8"));
  const ithaca = manifest.content_records.articles.find(({ id }) => id === "source-article-92bcff719816e650");
  const body = (await readFile(path.join(root, "src/content/articles/generated", path.basename(ithaca.source_path)), "utf8"))
    .split(/^---\r?\n[\s\S]*?\r?\n---\r?\n/m)[1];

  assert.equal(report.summary.articles, 124);
  assert.deepEqual(report.summary.locales, { "nl-BE": 78, en: 46 });
  assert.equal(report.summary.errors, 0);
  assert.equal(report.summary.legacy_video_links, 0);
  assert.equal(report.summary.unique_legacy_video_urls, 0);
  assert.equal(report.summary.exception_entries, 2);
  assert.equal(report.summary.records_with_exceptions, 2);
  assert.equal(report.summary.text_fidelity_records, 124);
  assert.equal(report.records.every(({ text_fidelity }) => text_fidelity && typeof text_fidelity.source_shingle_count === "number"), true);
  assert.equal(report.summary.text_fidelity_compared_records + report.summary.text_fidelity_no_source_text, 124);
  assert.ok(report.summary.text_fidelity_minimum >= 0.65);
  assert.match(body, /<p>Bekijk de syllabus<\/p>/);
  assert.doesNotMatch(body, /href=["']\s*["']/i);
  assert.equal(report.exceptions.some(({ id }) => id === ithaca.id), true);
});

test("verified Aeneas syllabus URLs remain exact in both transformed records", async () => {
  const manifest = parseYaml(await readFile(manifestPath, "utf8"));
  const expected = new Map([
    ["source-article-bdb7c991691689b0", "https://raw.githubusercontent.com/RobbeW/aiindeklas/main/aeneas/syllabus/NL_Syllabus_Epigrafie_Aenaes.pdf"],
    ["source-article-c336ebbf300fece5", "https://raw.githubusercontent.com/RobbeW/aiindeklas/51addd68030611e73b88fe4f1cc437cdfdaefa59/aeneas/syllabus/ENG_Syllabus_Epigraphy%20_Aenaes.pdf"]
  ]);
  for (const [id, url] of expected) {
    const record = manifest.content_records.articles.find((article) => article.id === id);
    const frontmatter = parseYaml((await readFile(path.resolve(root, "..", record.source_path), "utf8")).match(/^---\r?\n([\s\S]*?)\r?\n---/)[1]);
    assert.equal(frontmatter.downloads[0].url, url);
  }
});
