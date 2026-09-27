import fs from "node:fs";
import path from "node:path";
import { load } from "cheerio";

const root = process.cwd();
const dirs = ["src/content/articles/generated", "src/content/pages/generated"];
const files = dirs.flatMap((dir) => fs.readdirSync(path.join(root, dir)).filter((f) => f.endsWith(".md")).map((f) => path.join(root, dir, f)));
const ownedUi = [path.join(root, "src/pages/[...path].astro"), path.join(root, "src/components/RouteListingPage.astro")];
const built = process.argv.includes("--built") ? path.join(root, "dist") : null;
if (built && fs.existsSync(built)) for (const name of fs.readdirSync(built, { recursive: true })) if (name.endsWith(".html")) files.push(path.join(built, name));
const errors = [], retained = [], counts = { files: files.length, links: 0, newTabs: 0, migrationPhrases: 0, rawUrls: 0 };
const rawUrlPattern = /\b(?:https?:\/\/|www\.)\S+/gi;
const inspectAnchor = (file, tag) => {
  counts.links++;
  if (!/target\s*=\s*["']_blank/i.test(tag)) return;
  counts.newTabs++;
  if (!/rel\s*=\s*["'][^"']*noopener[^"']*noreferrer/i.test(tag)) errors.push(`${file}: unsafe new-tab rel`);
  const href = tag.match(/href=["']([^"']+)/i)?.[1] ?? "";
  const justified = /\.(?:pdf|zip|docx?|xlsx?|pptx?)(?:[?#]|$)/i.test(href) || /(?:colab\.research\.google\.com|robbew\.github\.io|netlify\.app)/i.test(href);
  if (/^(?:\/|#)/.test(href)) errors.push(`${file}: internal _blank link`);
  if (!justified) errors.push(`${file}: unclassified external _blank: ${href}`);
  else retained.push(`${path.relative(root, file)}: ${href} (${/\.(?:pdf|zip|docx?|xlsx?|pptx?)/i.test(href) ? "direct download" : "interactive tool"})`);
};

for (const file of files) {
  const text = fs.readFileSync(file, "utf8");
  if (file.endsWith(".html")) {
    const $ = load(text);
    $("script, style, template, noscript, svg").remove();
    const scope = $("main").first().length ? $("main").first() : $("body");
    scope.find(".preview-notice, .business-review").remove();
    scope.find("a[target='_blank']").each((_, element) => inspectAnchor(file, $.html(element)));
    const visibleText = scope.text().replace(/\s+/g, " ");
    const rawMatches = visibleText.match(rawUrlPattern) ?? [];
    if (rawMatches.length) { counts.rawUrls += rawMatches.length; errors.push(`${file}: raw visitor URL(s): ${rawMatches.join(", ")}`); }
    if (/(?:Browse the migrated .*articles|gemigreerde .*artikels|bronarchief|source archive|live verificatie|verification required)/i.test(visibleText)) { counts.migrationPhrases++; errors.push(`${file}: visitor migration/source phrase`); }
    continue;
  }
  const frontmatterEnd = text.indexOf("\n---", 3);
  const visitor = frontmatterEnd >= 0 ? text.slice(frontmatterEnd + 4) : text;
  if (/\]\(\s*\[/.test(visitor)) errors.push(`${file}: nested Markdown link`);
  for (const match of visitor.matchAll(/<a\b[^>]*>/gi)) inspectAnchor(file, match[0]);
  const labelled = visitor
    .replace(/!\[([^\]]*)\]\([^\n]*?\)/g, "$1")
    .replace(/\[([^\]]+)\]\([^\n]*?\)/g, "$1");
  const $ = load(`<main>${labelled}</main>`);
  const visibleText = $("main").text().replace(/\s+/g, " ");
  const rawMatches = visibleText.match(rawUrlPattern) ?? [];
  if (rawMatches.length) { counts.rawUrls += rawMatches.length; errors.push(`${file}: raw visitor URL(s): ${rawMatches.join(", ")}`); }
  if (/(?:Browse the migrated .*articles|gemigreerde .*artikels|bronarchief|source archive|live verificatie|verification required)/i.test(visibleText)) { counts.migrationPhrases++; errors.push(`${file}: visitor migration/source phrase`); }
}
for (const file of ownedUi) {
  const text = fs.readFileSync(file, "utf8");
  if (/(?:source\s+(?:archive|articles?)|bronarchief|gemigreerde|migrated\s+(?:English|Nederlandstalige))/i.test(text)) { counts.migrationPhrases++; errors.push(`${file}: visitor migration/source phrase`); }
  if (/target\s*=\s*["']_blank/i.test(text)) errors.push(`${file}: owned UI contains blanket _blank policy`);
}
console.log(JSON.stringify({ counts, retainedNewTabs: retained }, null, 2));
if (errors.length) { console.error(errors.join("\n")); process.exitCode = 1; }
