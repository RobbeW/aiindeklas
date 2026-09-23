import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const globalCss = await readFile(new URL("../../src/styles/global.css", import.meta.url), "utf8");
const validator = await readFile(new URL("../../scripts/validate-responsive.mjs", import.meta.url), "utf8");

test("responsive content contains wide media and scrollable source tables locally", () => {
  assert.match(globalCss, /main p:not\([^)]*\)\s*\{[^}]*text-align:\s*start/);
  assert.doesNotMatch(globalCss, /text-align:\s*justify/);
  assert.match(globalCss, /\.prose iframe[\s\S]*?width:\s*100%[\s\S]*?aspect-ratio:\s*16\s*\/\s*9/);
  assert.match(globalCss, /\.prose table[\s\S]*?overflow-x:\s*auto/);
  assert.match(globalCss, /\.prose pre[\s\S]*?overflow-x:\s*auto/);
  assert.match(globalCss, /overflow-wrap:\s*anywhere/);
});

test("P10 browser validator covers every required viewport and representative route", () => {
  assert.match(validator, /const widths = \[320, 768, 1440\]/);
  for (const path of ["/", "/onderwijs", "/education", "latijnse-wordle", "ithaca-teaching-history-journal", "avontuuropdeakropolis", "workshops-en-nascholingen", "/boek", "/contactinfo", "/projects"]) {
    assert.ok(validator.includes(path), `missing route ${path}`);
  }
  assert.match(validator, /pageOverflow/);
  assert.match(validator, /clippedText/);
  assert.match(validator, /Page\.captureScreenshot/);
  assert.match(validator, /detailEvidence/);
  assert.match(validator, /taskkill\.exe/);
});
