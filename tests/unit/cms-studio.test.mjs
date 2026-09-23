import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import {
  CMS_PATCH_SCHEMA,
  buildPatchBundle,
  createArticleDraft,
  duplicateArticle,
  safeTargetPath,
  serialiseCmsRecord,
  validateCmsRecord,
  validatePatchBundle
} from "../../src/lib/cms-studio-core.mjs";
import { parseFrontmatter } from "../../scripts/validate-content-model.mjs";

test("a new article draft validates and serialises to schema-shaped Markdown", () => {
  const draft = createArticleDraft({ title: "AI in onze klas", now: "2026-07-20T10:00:00.000Z" });
  const validation = validateCmsRecord(draft);
  assert.equal(validation.valid, true, validation.errors.join("\n"));
  assert.equal(draft.file, "src/content/articles/drafts/ai-in-onze-klas.md");
  const parsed = parseFrontmatter(serialiseCmsRecord(draft));
  assert.equal(parsed.data.status, "draft");
  assert.equal(parsed.data.seo.canonical_path, "/onderwijs/ai-in-onze-klas");
  assert.equal(parsed.data.seo.noindex, true);
  assert.match(parsed.body, /Schrijf hier/);
});

test("the exported patch is deterministic when its timestamp is fixed", () => {
  const draft = createArticleDraft({ title: "Veilige patch", now: "2026-07-20T10:00:00.000Z" });
  const first = buildPatchBundle(draft, "2026-07-20T10:05:00.000Z");
  const second = buildPatchBundle(draft, "2026-07-20T10:05:00.000Z");
  assert.deepEqual(first, second);
  assert.equal(first.schema, CMS_PATCH_SCHEMA);
  assert.equal(first.operations[0].operation, "create");
  assert.equal(validatePatchBundle(first).valid, true);
});

test("unsafe CMS patch paths are rejected", () => {
  assert.equal(safeTargetPath("src/content/articles/drafts/veilig.md"), true);
  assert.equal(safeTargetPath("../package.json"), false);
  const bundle = {
    schema: CMS_PATCH_SCHEMA,
    publishing_mode: "local_patch_then_git_review",
    operations: [{ operation: "create", path: "../package.json", expected_sha256: null, content: "---\nid: bad\n---\nBad\n" }]
  };
  assert.equal(validatePatchBundle(bundle).valid, false);
});

test("an existing workshop can be edited and exported without raw YAML work", async () => {
  const file = "src/content/workshops/generated/ai-in-de-klas-van-lesmateriaal-tot-leerlijn-72c29362.md";
  const source = await readFile(new URL(`../../${file}`, import.meta.url), "utf8");
  const parsed = parseFrontmatter(source, file);
  const record = {
    collection: "workshops",
    file,
    original_sha256: createHash("sha256").update(source).digest("hex"),
    data: parsed.data,
    body: parsed.body
  };
  record.data.duration_minutes = 150;
  record.data.workshop_type = "workshop";
  const result = validateCmsRecord(record);
  assert.equal(result.valid, true, result.errors.join("\n"));
  const patch = buildPatchBundle(record, "2026-07-20T10:05:00.000Z");
  assert.equal(patch.operations[0].operation, "update");
  assert.equal(parseFrontmatter(patch.operations[0].content).data.duration_minutes, 150);
});

test("duplicating an article clears migrated publication provenance", () => {
  const original = createArticleDraft({ title: "Origineel", now: "2026-07-20T10:00:00.000Z" });
  original.original_sha256 = "a".repeat(64);
  original.data.source_url = "https://example.com/origineel";
  original.data.source_html_sha256 = "b".repeat(64);
  const copy = duplicateArticle(original, "2026-07-20T11:00:00.000Z");
  assert.equal(copy.original_sha256, null);
  assert.equal(copy.data.status, "draft");
  assert.equal(copy.data.source_url, null);
  assert.equal(copy.data.source_html_sha256, null);
  assert.match(copy.file, /-kopie\.md$/);
});
