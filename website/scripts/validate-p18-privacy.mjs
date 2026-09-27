import { readFile, readdir, writeFile } from "node:fs/promises";
import { join, relative, resolve } from "node:path";
import { load } from "cheerio";

const siteRoot = resolve(import.meta.dirname, "..");
const artifact = resolve(siteRoot, "..", "_site");
const origin = "https://robbew.github.io";
const files = [];
const walk = async (directory) => {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) await walk(path);
    else files.push(path);
  }
};
await walk(artifact);

const problems = [];
let htmlPages = 0;
let pagesWithNotice = 0;
let automaticExternalResources = 0;
const selectors = [
  ["script[src]", "src"], ["iframe[src]", "src"], ["embed[src]", "src"],
  ["object[data]", "data"], ["img[src]", "src"], ["source[src]", "src"],
  ["video[src]", "src"], ["audio[src]", "src"],
  ["link[rel~='stylesheet'][href]", "href"], ["link[rel~='preload'][href]", "href"],
  ["link[rel~='modulepreload'][href]", "href"], ["link[rel~='preconnect'][href]", "href"]
];
const checkResource = (raw, label) => {
  if (!raw || /^(?:data:|blob:|#)/i.test(raw)) return;
  try {
    const url = new URL(raw, origin);
    if (url.origin !== origin) {
      automaticExternalResources++;
      problems.push(`${label}: automatic external resource ${url.href}`);
    }
  } catch { problems.push(`${label}: invalid resource URL ${raw}`); }
};

for (const file of files) {
  const label = relative(artifact, file).replaceAll("\\", "/");
  if (file.endsWith(".html")) {
    htmlPages++;
    const html = await readFile(file, "utf8");
    const $ = load(html);
    if ($("footer.site-footer").length) {
      pagesWithNotice++;
      if ($("[data-privacy-notice]").length !== 1 || $("[data-privacy-dismiss]").length !== 1 || $("[data-privacy-open][aria-controls='privacy-notice']").length !== 1) {
        problems.push(`${label}: privacy notice or reopening control is missing`);
      }
      if (!html.includes("rw-privacy-notice-v1")) problems.push(`${label}: privacy notice preference script is missing`);
    }
    for (const [selector, attribute] of selectors) {
      $(selector).each((_, element) => checkResource($(element).attr(attribute), label));
    }
    $("img[srcset], source[srcset]").each((_, element) => {
      const candidates = ($(element).attr("srcset") ?? "").split(",");
      for (const candidate of candidates) checkResource(candidate.trim().split(/\s+/)[0], label);
    });
    if (/document\.cookie\s*=/.test(html)) problems.push(`${label}: page script writes a cookie`);
  } else if (/\.(?:js|css)$/.test(file)) {
    const source = await readFile(file, "utf8");
    if (/document\.cookie\s*=/.test(source)) problems.push(`${label}: asset script writes a cookie`);
    if (file.endsWith(".css")) {
      for (const match of source.matchAll(/url\(\s*["']?([^"')]+)["']?\s*\)/gi)) checkResource(match[1], label);
    }
  }
}

const report = {
  schema: "website-migration.p18-privacy-audit/v1",
  artifact: relative(siteRoot, artifact).replaceAll("\\", "/"),
  html_pages: htmlPages,
  pages_with_notice: pagesWithNotice,
  automatic_external_resources: automaticExternalResources,
  passed: problems.length === 0,
  problems
};
const reportPath = resolve(siteRoot, "migration/reports/P18-privacy-audit.json");
await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report, null, 2));
if (problems.length) process.exitCode = 1;
