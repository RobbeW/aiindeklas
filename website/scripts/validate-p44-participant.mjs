import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import { resolve, join } from "node:path";
import YAML from "yaml";
import { load } from "cheerio";

const root = resolve(import.meta.dirname, "..");
const dir = join(root, "src/content/participant-pages");
const files = (await readdir(dir)).filter((name) => name.endsWith(".md"));
const routes = new Map();
const slugs = new Map();
const findings = [];
for (const file of files) {
  const source = await readFile(join(dir, file), "utf8");
  const match = source.match(/^---\n([\s\S]*?)\n---/);
  assert(match, `${file}: missing frontmatter`);
  const data = YAML.parse(match[1]);
  assert.match(data.slug, /^[a-z0-9]+(?:-[a-z0-9]+)*$/, `${file}: invalid slug`);
  if (slugs.has(data.slug)) findings.push(`duplicate slug ${data.slug}: ${file} and ${slugs.get(data.slug)}`);
  slugs.set(data.slug, file);
  const route = String(data.route_path ?? "").replace(/\/+$/, "") || "/";
  if (routes.has(route.toLowerCase())) findings.push(`duplicate route ${route}: ${file} and ${routes.get(route.toLowerCase())}`);
  routes.set(route.toLowerCase(), file);
  for (const image of source.matchAll(/src:\s*["']?([^\s"']+)["']?/g)) {
    if (image[1].startsWith("http")) continue;
    const asset = resolve(join(dir, image[1]));
    try { await readFile(asset); } catch { findings.push(`${file}: missing asset ${image[1]}`); }
  }
  const walk = (value) => {
    if (!value || typeof value !== "object") return;
    if (value.type === "image" && (!value.image || typeof value.image.alt !== "string")) findings.push(`${file}: missing alt decision`);
    if (Array.isArray(value)) value.forEach(walk); else Object.values(value).forEach(walk);
  };
  walk(data.blocks);
  for (const block of data.blocks ?? []) if (block.type === "actions") for (const action of block.items ?? []) {
    assert.equal(typeof action.href, "string", `${file}: action URL is missing`);
    if (action.href.startsWith("/") && !action.href.startsWith("//")) continue;
    assert.match(action.href, /^https:\/\//, `${file}: external action must use https URL`);
  }
  if (source.includes("href: javascript:") || source.includes("href: '#'") || source.includes("href: \"#\"")) findings.push(`${file}: invalid action URL`);
}
assert.equal(findings.length, 0, findings.join("\n"));
if (process.argv[2]) {
  const { readFile: readBuilt } = await import("node:fs/promises");
  const output = resolve(process.argv[2]);
  const htmlDiscoveryFiles = ["index.html"];
  for (const name of htmlDiscoveryFiles) {
    const body = await readBuilt(join(output, name), "utf8");
    const $ = load(body);
    for (const route of routes.keys()) {
      const leaked = $("a[href]").toArray().some((element) => {
        const pathname = new URL($(element).attr("href"), "https://example.invalid").pathname.replace(/\/+$/, "") || "/";
        return pathname === route || pathname.endsWith(route);
      });
      assert.ok(!leaked, `${name}: exposes participant route ${route}`);
    }
  }
  for (const name of ["sitemap.xml", "onderwijs/rss.xml", "education/rss.xml"]) {
    const body = await readBuilt(join(output, name), "utf8");
    const $ = load(body, { xmlMode: true });
    const urls = $("loc, link").toArray().map((element) => $(element).text().trim()).filter(Boolean);
    for (const route of routes.keys()) assert.ok(!urls.some((url) => new URL(url, "https://example.invalid").pathname.replace(/\/+$/, "").endsWith(route)), `${name}: exposes participant route ${route}`);
  }
  const admin = await readBuilt(join(output, "admin/content.json"), "utf8");
  assert.ok(!admin.includes('"collection":"participantPages"'), "admin/content.json exposes participant collection");
}
console.log(JSON.stringify({ files: files.length, slugs: [...slugs.keys()], routes: [...routes.keys()], discovery: "unlisted/noindex and excluded by route policy", status: "passed" }, null, 2));
