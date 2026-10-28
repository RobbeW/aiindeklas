import { createHash } from "node:crypto";
import { readFile, readdir, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { load as loadHtml } from "cheerio";
import { parse as parseYaml } from "yaml";

const root = fileURLToPath(new URL("../", import.meta.url));
const manifestPath = path.resolve(root, "../docs/implementation/manifests/content.yaml");
const sourceManifestPath = path.join(root, "migration/source-manifest.json");
const articleRoot = path.join(root, "src/content/articles/generated");
const errors = [];
const records = [];
const sha256 = (value) => createHash("sha256").update(value).digest("hex");
const fail = (record, message) => errors.push(`${record?.id ?? "articles"}: ${message}`);
const normalizedPath = (value) => value.replaceAll("\\", "/");

const manifest = parseYaml(await readFile(manifestPath, "utf8"));
const sourceManifest = JSON.parse(await readFile(sourceManifestPath, "utf8"));
const sourceArticles = new Map(sourceManifest.pages
  .filter((page) => page.classification === "article")
  .map((page) => [page.url, page]));
const articles = manifest.content_records?.articles ?? [];
const articleFiles = (await readdir(articleRoot)).filter((name) => /\.mdx?$/.test(name)).sort();
const allRecords = Object.values(manifest.content_records ?? {}).flat();
const knownPaths = new Set([...allRecords.map((record) => record.current_path).filter(Boolean), "/onderwijs/workshops-en-nascholingen"]);
const ids = new Set();
const routes = new Set();
const localeCounts = { "nl-BE": 0, en: 0 };
const exceptionRecords = [];
const videoRefs = [];
const referenceCounts = { internal: 0, local_media: 0, external: 0 };
const fidelityEvidence = [];
const textTokens = (value) => String(value ?? "")
  .normalize("NFKC")
  .toLocaleLowerCase("en")
  .match(/[\p{L}\p{N}]+/gu) ?? [];
const shingles = (tokens, size = 5) => {
  const width = Math.min(size, tokens.length);
  if (!width) return [];
  const result = [];
  for (let i = 0; i <= tokens.length - width; i += 1) result.push(tokens.slice(i, i + width).join(" "));
  return result;
};
const textCoverage = (sourceText, transformedBody) => {
  const sourceWords = textTokens(sourceText);
  const transformedText = transformedBody
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1");
  const targetWords = textTokens(loadHtml(`<div>${transformedText}</div>`).root().text());
  const sourceShingles = shingles(sourceWords);
  const targetCounts = new Map();
  for (const item of shingles(targetWords)) targetCounts.set(item, (targetCounts.get(item) ?? 0) + 1);
  if (!sourceShingles.length) {
    return {
      method: "ordered 5-word shingles with multiset recall; NFKC, case-folded Unicode word tokens; Markdown link/image URLs excluded, visible labels retained",
      status: "no_extractable_editorial_text_in_source_block",
      source_word_count: 0,
      transformed_word_count: targetWords.length,
      source_shingle_count: 0,
      matched_source_shingles: 0,
      coverage: null
    };
  }
  let matched = 0;
  for (const item of sourceShingles) {
    const available = targetCounts.get(item) ?? 0;
    if (available > 0) {
      matched += 1;
      targetCounts.set(item, available - 1);
    }
  }
  return {
    method: "ordered 5-word shingles with multiset recall; NFKC, case-folded Unicode word tokens; Markdown link/image URLs excluded, visible labels retained",
    source_word_count: sourceWords.length,
    transformed_word_count: targetWords.length,
    source_shingle_count: sourceShingles.length,
    matched_source_shingles: matched,
    coverage: sourceShingles.length ? matched / sourceShingles.length : 0
  };
};

if (articles.length !== 124) fail(null, `expected 124 manifest articles, found ${articles.length}`);
if (articleFiles.length !== 124) fail(null, `expected 124 generated article files, found ${articleFiles.length}`);

for (const record of articles) {
  localeCounts[record.locale] = (localeCounts[record.locale] ?? 0) + 1;
  if (ids.has(record.id)) fail(record, "duplicate manifest article ID");
  ids.add(record.id);
  if (routes.has(record.current_path)) fail(record, `duplicate route ${record.current_path}`);
  routes.add(record.current_path);

  const relativeFile = normalizedPath(record.source_path ?? "");
  if (!relativeFile.startsWith("legacy_migration/src/content/articles/generated/")) {
    fail(record, `source_path is outside generated article tree: ${relativeFile}`);
    continue;
  }
  const filename = path.basename(relativeFile);
  let source;
  try {
    source = await readFile(path.join(root, "src/content/articles/generated", filename), "utf8");
  } catch {
    fail(record, `missing transformed file ${filename}`);
    continue;
  }
  const frontmatterMatch = source.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
  if (!frontmatterMatch) {
    fail(record, "missing valid YAML frontmatter/body boundary");
    continue;
  }
  let frontmatter;
  try { frontmatter = parseYaml(frontmatterMatch[1]); }
  catch (error) { fail(record, `frontmatter YAML parse failed: ${error.message}`); continue; }
  const body = frontmatterMatch[2];
  if (!body.trim()) fail(record, "transformed body is blank");
  if (frontmatter.id !== record.id) fail(record, `frontmatter ID ${frontmatter.id} differs from manifest`);
  if (frontmatter.source_url !== record.source_url) fail(record, "frontmatter source_url differs from manifest");
  if (frontmatter.seo?.canonical_path !== record.current_path) fail(record, "canonical route differs from manifest current_path");
  if (frontmatter.locale !== record.locale) fail(record, "locale differs from manifest");
  if (new URL(record.source_url).pathname !== record.current_path) fail(record, "source URL pathname differs from preserved canonical route");
  if (record.source_artifacts?.transformed_record !== record.source_path) fail(record, "manifest transformed_record differs from source_path");

  const snapshotRelative = normalizedPath(record.source_artifacts?.source_snapshot ?? "");
  const sourceEntry = sourceArticles.get(record.source_url);
  if (!sourceEntry) fail(record, "source URL is not present as an article in source-manifest.json");
  if (sourceEntry && normalizedPath(sourceEntry.raw_path) !== snapshotRelative) fail(record, "source snapshot path differs from source manifest");
  if (sourceEntry && sourceEntry.sha256 !== record.source_artifacts?.source_html_sha256) fail(record, "source manifest SHA-256 differs from content inventory");
  if (frontmatter.source_html_sha256 !== record.source_artifacts?.source_html_sha256) fail(record, "frontmatter SHA-256 differs from content inventory");
  try {
    const snapshot = await readFile(path.join(root, ...snapshotRelative.split("/")));
    const actualHash = sha256(snapshot);
    if (actualHash !== record.source_artifacts?.source_html_sha256) fail(record, `source snapshot SHA-256 mismatch (${actualHash})`);
    const $source = loadHtml(snapshot.toString("utf8"));
    const sourceBlock = $source(".blog-item-content").first();
    sourceBlock.find("script,style,noscript").remove();
    const sourceText = sourceBlock.text();
    const text_fidelity = textCoverage(sourceText, body);
    if (!sourceBlock.length) fail(record, "preserved snapshot is missing the source extractor's .blog-item-content scope");
    else if (text_fidelity.coverage !== null && text_fidelity.coverage < 0.65) fail(record, `transformed body may be substantially truncated: source text coverage ${(text_fidelity.coverage * 100).toFixed(1)}% is below 65%`);
    fidelityEvidence.push({ id: record.id, source_url: record.source_url, ...text_fidelity });
  } catch (error) { fail(record, `source snapshot unavailable: ${error.message}`); }

  const links = [...body.matchAll(/!?\[[^\]]*\]\(([^\s)]+)(?:\s+[^)]*)?\)|\bhref\s*=\s*["']([^"']*)["']|\bsrc\s*=\s*["']([^"']*)["']/gi)]
    .map((match) => match[1] ?? match[2] ?? match[3]).filter((href) => href !== undefined);
  for (const href of links) {
    if (!href.trim()) {
      if (record.id === "source-article-92bcff719816e650" && /Bekijk de syllabus/.test(body)) {
        fail(record, "Ithaca source's empty syllabus destination must remain plain text, not a link");
      } else fail(record, "blank local destination");
      continue;
    }
    if (/^file:/i.test(href)) {
      exceptionRecords.push({ id: record.id, source_url: record.source_url, exception: `source-derived workstation file URI cannot work on the public site: ${href}` });
      continue;
    }
    if (/^(?:https?:|mailto:|tel:|data:|javascript:|#)/i.test(href)) {
      if (/^https?:/i.test(href)) {
        referenceCounts.external++;
        if (/^https?:\/\/video\.squarespace-cdn\.com\//i.test(href)) videoRefs.push({ id: record.id, source_url: record.source_url, url: href });
      }
      continue;
    }
    const pathname = decodeURIComponent(href.split(/[?#]/)[0]);
    if (pathname.startsWith("/media/")) {
      const mediaFile = path.join(root, "public", pathname.replace(/^\//, ""));
      try { await stat(mediaFile); referenceCounts.local_media++; }
      catch { fail(record, `local media/download does not exist: ${href}`); }
    } else if (pathname.startsWith("/")) {
      if (!knownPaths.has(pathname)) fail(record, `internal route is not in canonical content manifest: ${pathname}`);
      else referenceCounts.internal++;
    } else {
      const target = path.resolve(path.dirname(path.join(root, "src/content/articles/generated", filename)), pathname);
      try { await stat(target); referenceCounts.local_media++; }
      catch { fail(record, `relative local media/download does not exist: ${href}`); }
    }
  }

  if (/https?:\/\/video\.squarespace-cdn\.com\//i.test(body)) {
    exceptionRecords.push({ id: record.id, source_url: record.source_url, exception: "legacy Squarespace hosted video reference remains in transformed body; replace/recover source media in P08/P09/P16" });
  }
  if (record.id === "source-article-92bcff719816e650") {
    if (links.some((href) => href === "")) fail(record, "empty destination was rendered as an anchor");
    exceptionRecords.push({ id: record.id, source_url: record.source_url, exception: "source snapshot contains an empty 'Bekijk de syllabus' destination; presented as plain text; do not infer a URL" });
  }
  if (record.id === "source-article-31dcfcd88560732f") {
    if (/\]\(file:/i.test(body)) fail(record, "source workstation file URI must not render as a working link");
    if (!body.includes("huidige leerplan lichamelijke opvoeding, Katholiek Onderwijs Vlaanderen")) fail(record, "source-derived link label text was not preserved");
    exceptionRecords.push({ id: record.id, source_url: record.source_url, exception: "source contains a truncated workstation file URI for the cited lesson plan; link removed while label prose remains; destination review required, no URL inferred" });
  }
  records.push({
    id: record.id,
    locale: record.locale,
    source_url: record.source_url,
    source_snapshot: snapshotRelative,
    source_sha256: record.source_artifacts?.source_html_sha256,
    transformed_record: relativeFile,
    transformed_sha256: sha256(Buffer.from(source)),
    canonical_path: record.current_path,
    body_characters: body.trim().length,
    body_headings: (body.match(/^#{1,6}\s+/gm) ?? []).length,
    text_fidelity: fidelityEvidence.find((item) => item.id === record.id) ?? null,
    status: exceptionRecords.some((item) => item.id === record.id) ? "verified_with_exception" : "verified"
  });
}

for (const filename of articleFiles) {
  const file = path.join(articleRoot, filename);
  const text = await readFile(file, "utf8");
  const id = text.match(/^id:\s*["']?([^\r\n"']+)/m)?.[1]?.trim();
  if (id && !articles.some((record) => record.id === id)) fail({ id }, `generated article file ${filename} has no manifest record`);
}

if (localeCounts["nl-BE"] !== 78 || localeCounts.en !== 46) fail(null, `locale totals differ: ${JSON.stringify(localeCounts)}`);
if (sourceArticles.size !== 124) fail(null, `source manifest has ${sourceArticles.size} article URLs rather than 124`);

const baseFlag = process.argv.indexOf("--base");
const base = baseFlag >= 0 ? process.argv[baseFlag + 1] : "/";
if (process.argv.includes("--built")) {
  const dist = path.join(root, "dist");
  for (const record of articles) {
    const outputPath = record.current_path.replace(/^\//, "");
    // Astro's project-profile build uses base-prefixed URLs while still writing
    // the static files relative to dist/ for Pages' repository-root mapping.
    const basePath = "";
    const htmlCandidates = [
      path.join(dist, basePath, `${outputPath}.html`),
      path.join(dist, basePath, outputPath, "index.html")
    ];
    let htmlPath = htmlCandidates[0];
    try {
      let html;
      for (const candidate of htmlCandidates) {
        try { html = await readFile(candidate, "utf8"); htmlPath = candidate; break; }
        catch (error) { if (error.code !== "ENOENT") throw error; }
      }
      if (!html) throw new Error(`none of ${htmlCandidates.join(" or ")} exists`);
      if (!html.includes(`data-content-id="${record.id}"`)) fail(record, `built page lacks matching data-content-id at ${htmlPath}`);
      if (!html.includes(`data-content-collection="articles"`)) fail(record, `built page is not identified as an article at ${htmlPath}`);
      if (!html.includes(`rel="canonical"`) || !html.includes(record.current_path)) fail(record, `built page canonical does not include ${record.current_path}`);
    } catch (error) { fail(record, `built article page missing/unreadable at ${htmlPath}: ${error.message}`); }
  }
}

const report = {
  schema: "website-migration.article-integrity/v1",
  generated_at: new Date().toISOString(),
  method: "manifest-to-frontmatter/source-manifest/raw-snapshot SHA-256 trace; unique route and ID checks; nonblank body and source-derived metadata checks; Markdown/HTML link and local asset checks; optional built HTML route, canonical and content identity checks",
  limitations: [
    "SHA-256 proves snapshot identity and lineage, not semantic equivalence of every transformed sentence; prose was not mechanically rewritten or normalized.",
    "Text fidelity compares visible text from the source .blog-item-content scope with transformed body text using ordered 5-word shingle multiset recall after NFKC/case normalization. Link/image URLs are excluded while labels remain. A 65% threshold is a conservative truncation alarm, not proof of exact prose or translation quality; formatting, entities, source-only captions, and block ordering can affect coverage. Source blocks with no extractable text (such as gallery-only/video-only posts) receive explicit no_extractable_editorial_text evidence and are excluded from numeric coverage aggregates.",
    "External citations and full-size Squarespace image URLs are retained as source-derived destinations and are not fetched or availability-certified.",
    "Legacy Squarespace video CDN links are counted and reported but their media availability and replacement are unresolved downstream.",
    "The source's blank Ithaca syllabus destination is preserved as an explicit plain-text exception; no destination is inferred."
  ],
  summary: {
    articles: articles.length,
    generated_files: articleFiles.length,
    locales: localeCounts,
    verified_source_snapshots: records.length,
    unique_ids: ids.size,
    unique_routes: routes.size,
    internal_links_checked: referenceCounts.internal,
    local_media_or_downloads_checked: referenceCounts.local_media,
    external_links_counted: referenceCounts.external,
    legacy_video_links: videoRefs.length,
    unique_legacy_video_urls: new Set(videoRefs.map(({ url }) => url)).size,
    exception_entries: exceptionRecords.length,
    records_with_exceptions: new Set(exceptionRecords.map(({ id }) => id)).size,
    text_fidelity_records: fidelityEvidence.length,
    text_fidelity_compared_records: fidelityEvidence.filter(({ coverage }) => coverage !== null).length,
    text_fidelity_no_source_text: fidelityEvidence.filter(({ coverage }) => coverage === null).length,
    text_fidelity_minimum: fidelityEvidence.some(({ coverage }) => coverage !== null) ? Math.min(...fidelityEvidence.filter(({ coverage }) => coverage !== null).map(({ coverage }) => coverage)) : null,
    text_fidelity_mean: fidelityEvidence.filter(({ coverage }) => coverage !== null).length ? fidelityEvidence.filter(({ coverage }) => coverage !== null).reduce((total, { coverage }) => total + coverage, 0) / fidelityEvidence.filter(({ coverage }) => coverage !== null).length : null,
    text_fidelity_weighted: fidelityEvidence.filter(({ coverage }) => coverage !== null).length ? fidelityEvidence.filter(({ coverage }) => coverage !== null).reduce((total, { matched_source_shingles }) => total + matched_source_shingles, 0) / fidelityEvidence.filter(({ coverage }) => coverage !== null).reduce((total, { source_shingle_count }) => total + source_shingle_count, 0) : null,
    errors: errors.length,
    built_pages_checked: process.argv.includes("--built") ? articles.length : 0,
    built_base: process.argv.includes("--built") ? base : null
  },
  exceptions: exceptionRecords,
  legacy_video_references: videoRefs,
  errors,
  records
};
const reportPath = path.join(root, "migration/reports/P06-article-integrity.json");
await import("node:fs/promises").then(({ writeFile }) => writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`));
console.log(JSON.stringify(report.summary, null, 2));
if (errors.length) {
  console.error(errors.join("\n"));
  process.exitCode = 1;
}
