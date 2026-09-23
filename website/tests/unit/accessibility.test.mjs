import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("P11 mobile menu uses native button keyboard semantics", async () => {
  const source = await readFile(new URL("../../src/components/SiteHeader.astro", import.meta.url), "utf8");
  assert.match(source, /<button[\s\S]*type="button"[\s\S]*aria-expanded="false"/);
  assert.doesNotMatch(source, /button\.addEventListener\("keydown"/);
});
