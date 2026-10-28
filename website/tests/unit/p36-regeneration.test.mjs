import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
const root = resolve(import.meta.dirname, "../..");
const read = (p) => readFile(resolve(root, p), "utf8");
test("P36 regeneration mappings remain explicit and deterministic", async () => {
  const generator = await read("scripts/migrate-content.mjs");
  assert.match(generator, /\["\/contact", "Contact"\]/);
  assert.match(generator, /button button--primary/);
  assert.match(generator, /Hier vind je lesmateriaal, projecten en artikels/);
  assert.match(generator, /Bestel het boek/);
  assert.match(generator, /home-action--workshops/);
  assert.match(generator, /home-action--education/);
  assert.match(generator, /home-action--book/);
});
