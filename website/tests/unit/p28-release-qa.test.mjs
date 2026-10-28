import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
test("P28 runner keeps the release phases and required gates ordered", async () => {
  const source = await readFile(join(root, "scripts", "p28-release-qa.mjs"), "utf8");
  for (const token of ["phase(\"static\"", "phase(\"root-preview\"", "phase(\"project-preview\"", "phase(\"production\""]) assert.ok(source.includes(token), `missing ${token}`);
  assert.ok(source.indexOf('"build-root"') < source.indexOf('"built-root"'));
  assert.ok(source.indexOf('"build-project"') < source.indexOf('"built-project"'));
  assert.ok(source.indexOf('"build-production"') > source.indexOf('"build-project"'));
  for (const gate of ["validate:content", "validate:cms", "validate-p21-catalogue.mjs", "validate-p09.mjs", "p26:validate", '"test"', '"check"']) assert.ok(source.includes(gate), `missing gate ${gate}`);
  assert.match(source, /process\.platform === "win32" \? "pnpm\.cmd" : "pnpm"/);
  assert.match(source, /p23-browser-root.*"preview"/);
  assert.match(source, /p23-browser-project.*"preview"/);
  for (const gate of ["articles-root", "articles-project", "p09-built-root", "p09-built-project", "p09-built-production"]) assert.ok(source.includes(gate), `missing rendered gate ${gate}`);
});
