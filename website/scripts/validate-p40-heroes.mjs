import fs from "node:fs";
import assert from "node:assert/strict";

const root = new URL("../dist/", import.meta.url);
const routes = {
  "/boek": "hero_boek",
  "/contact": "hero_contact",
  "/onderwijs": "hero_onderwijs",
  "/onderwijs/workshops-en-nascholingen": "hero_nascholingen"
};
const unrelated = ["/", "/about", "/contactinfo", "/onderwijs/archief"];
const htmlFor = (route) => {
  const path = route === "/" ? "index.html" : `${route.slice(1)}.html`;
  return fs.readFileSync(new URL(path, root), "utf8");
};
for (const [route, source] of Object.entries(routes)) {
  const html = htmlFor(route);
  assert.equal((html.match(/hero-aside--image/g) ?? []).length, 1, `${route}: expected one hero aside`);
  const start = html.indexOf("hero-aside--image");
  const hero = html.slice(start, start + 5000);
  assert.match(hero, /loading="eager"/);
  assert.match(hero, /srcset="/);
  assert.match(hero, /width="\d+" height="\d+"/);
  assert.match(html, new RegExp(`${source}[^" ]*\.webp|${source}`));
  if (route === "/boek") {
    const heading = html.match(/<h1 id="page-title"[^>]*>([\s\S]*?)<\/h1>/)?.[1] ?? "";
    assert.equal((heading.match(/<wbr\b[^>]*>/g) ?? []).length, 1);
    assert.equal(heading.replace(/<wbr\b[^>]*>/g, ""), "AI in de klas: Praktische gids voor onderwijsprofessionals");
  }
}
for (const route of unrelated) {
  const html = htmlFor(route);
  assert.equal((html.match(/hero-aside--image/g) ?? []).length, 0, `${route}: unexpected P40 hero`);
}
console.log(`P40 hero validation passed for ${Object.keys(routes).length} routes and ${unrelated.length} unrelated routes.`);
