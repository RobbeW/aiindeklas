import assert from "node:assert/strict";
import test from "node:test";
import { parseFrontmatter, validateDocuments, validateRepositoryContent } from "../../scripts/validate-content-model.mjs";

const valid = (overrides = {}) => ({
  collection: "pages",
  file: "fixture.md",
  body: "Verified body",
  data: {
    id: "fixture",
    locale: "nl-BE",
    translation_key: null,
    status: "review",
    source_url: "https://example.com/source",
    source_html_sha256: "a".repeat(64),
    migration_status: "transformed",
    published_at: null,
    seo: { title: null, description: null, canonical_path: "/fixture" },
    ...overrides
  }
});

test("repository representative content passes cross-entry validation", async () => {
  const result = await validateRepositoryContent();
  assert.equal(result.documents, 155);
  assert.deepEqual(result.collections, {
    authors: 1,
    pages: 9,
    articles: 124,
    workshops: 12,
    projects: 9
  });
  assert.equal(result.paired_translations, 3);
  assert.equal(result.media_records, 829);
});

test("frontmatter parser separates YAML and body", () => {
  const parsed = parseFrontmatter("---\nid: example\n---\nBody\n");
  assert.equal(parsed.data.id, "example");
  assert.equal(parsed.body.trim(), "Body");
});

test("blank bodies fail intentionally", () => {
  assert.throws(() => validateDocuments([{ ...valid(), body: "  " }]), /must not be blank/);
});

test("unpaired provenance fails intentionally", () => {
  assert.throws(() => validateDocuments([valid({ source_html_sha256: null })]), /must be paired/);
});

test("duplicate canonical routes fail intentionally", () => {
  const first = valid();
  const second = valid({ id: "fixture-2" });
  second.file = "fixture-2.md";
  assert.throws(() => validateDocuments([first, second]), /canonical path duplicates/);
});

test("published migrated records require approval and complete metadata", () => {
  assert.throws(
    () => validateDocuments([valid({ status: "published", migration_status: "transformed" })]),
    /published content requires/
  );
});
