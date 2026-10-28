import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const root = new URL("../../", import.meta.url);
const read = (p) => readFile(new URL(p, root), "utf8");

test("P25 preserves gateway copy and one-link card structure", async () => {
  const page = await read("src/pages/[...path].astro");
  const card = await read("src/components/RouteListingPage.astro");
  const onderwijs = await read("src/content/pages/generated/onderwijs.md");
  const intro = "Hier vind je lesmateriaal, projecten en artikels over artificiële intelligentie, computationeel denken en programmeren in het onderwijs.";
  assert.match(onderwijs, new RegExp(intro));
  assert.match(page, /onderwijs\/archief/);
  assert.match(page, /countLabel: "recente artikels"/);
  assert.match(card, /listing-card-link/);
  assert.doesNotMatch(card, /class="listing-image" href=/);
});

test("P25 retains article descriptions for metadata", async () => {
  const view = await read("src/lib/content-view.ts");
  const content = await read("src/components/ContentPage.astro");
  const article = await read("src/content/articles/generated/nl-project-fijnstof-8e151641.md");
  assert.match(article, /^excerpt:\s*"Project Fijnstof is een STEaM-project/m);
  assert.match(view, /data\.seo\.description\s*\?\? data\.excerpt\s*\?\?/);
  assert.match(content, /description=\{seoDescription\}/);
  assert.match(content, /view\.collection === "articles" \? undefined/);
});
