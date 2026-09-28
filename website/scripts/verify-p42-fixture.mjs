import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const base = process.argv[2] ?? "/";
const output = resolve(import.meta.dirname, "../dist");
const html = await readFile(resolve(output, "geschenk-test.html"), "utf8");
const contactHref = `${base}contact`.replaceAll("//", "/");
const order = ["Start", "Open contact", "Tijdelijke testafbeelding", "Oefeningen"].map((needle) => html.indexOf(needle));

assert.match(html, /<meta name="robots" content="noindex, nofollow"/);
assert.match(html, /data-courtesy-form/);
assert.match(html, /data-participant-content hidden/);
assert.match(html, /<strong>Belangrijk:<\/strong>/);
assert.match(html, /<ol>/);
assert.ok(html.includes(`href="${contactHref}"`), `missing base-safe contact href ${contactHref}`);
assert.ok(html.includes(`src="${base}_astro/`.replaceAll("//", "/")), "participant image is not base-safe");
assert.ok(order.every((position, index) => position >= 0 && (index === 0 || position > order[index - 1])), "participant blocks are out of order");
assert.ok(!html.includes("P42TEST"), "fixture code leaked in built HTML");

for (const file of ["sitemap.xml", "admin/content.json", "onderwijs/rss.xml", "education/rss.xml", "index.html"]) {
  const body = await readFile(resolve(output, file), "utf8");
  assert.ok(!body.includes("geschenk-test"), `${file} exposes the participant route`);
}

console.log(JSON.stringify({ base, route: "/geschenk-test", noindex: true, discoveryExcluded: true, blockOrder: order, contactHref }, null, 2));
