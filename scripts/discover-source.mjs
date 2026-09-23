import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { load } from "cheerio";
import { parse as parseYaml } from "yaml";

const ROOT = process.cwd();
const ORCHESTRATOR_PATH = path.join(ROOT, "robbewulgaert_cms_orchestrator.yaml");
const MIGRATION_ROOT = path.join(ROOT, "migration");
const RAW_ROOT = path.join(MIGRATION_ROOT, "raw-html");
const REPORT_ROOT = path.join(MIGRATION_ROOT, "reports");
const MAX_URLS = Number.parseInt(process.env.CRAWL_MAX_URLS ?? "600", 10);
const CONCURRENCY = Number.parseInt(process.env.CRAWL_CONCURRENCY ?? "2", 10);
const REQUEST_TIMEOUT_MS = Number.parseInt(process.env.CRAWL_TIMEOUT_MS ?? "30000", 10);
const MAX_RETRIES = Number.parseInt(process.env.CRAWL_MAX_RETRIES ?? "3", 10);
const USER_AGENT = "RobbeWulgaertMigrationBot/1.0 (+local preservation crawl)";

const TRACKING_PARAMETERS = new Set([
  "fbclid",
  "gclid",
  "mc_cid",
  "mc_eid",
  "ref",
  "source"
]);

const EXCLUDED_PATH_PREFIXES = [
  "/account",
  "/api/",
  "/cart",
  "/checkout",
  "/commerce/",
  "/config/",
  "/login",
  "/oauth/",
  "/preview/",
  "/settings/"
];

const ASSET_EXTENSIONS = new Set([
  ".avif", ".css", ".csv", ".doc", ".docx", ".eot", ".gif", ".ico",
  ".jpeg", ".jpg", ".js", ".json", ".m4a", ".mov", ".mp3", ".mp4",
  ".pdf", ".png", ".ppt", ".pptx", ".svg", ".ttf", ".wav", ".webm",
  ".webp", ".woff", ".woff2", ".xls", ".xlsx", ".zip"
]);

const orchestrator = parseYaml(await readFile(ORCHESTRATOR_PATH, "utf8"));
const sourceOrigin = new URL(orchestrator.runtime_parameters.source_origin);
const canonicalHost = sourceOrigin.hostname.toLowerCase();
const acceptedHosts = new Set([canonicalHost, canonicalHost.replace(/^www\./, "")]);
const siteCdnPrefix = "https://images.squarespace-cdn.com/content/v1/6026af223ff1970db5c08fb8/";

const sha256 = (value) => createHash("sha256").update(value).digest("hex");
const shortHash = (value) => sha256(value).slice(0, 12);

const csvCell = (value) => {
  const text = value === null || value === undefined ? "" : String(value);
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
};

const isExcludedPath = (pathname) =>
  EXCLUDED_PATH_PREFIXES.some((prefix) => pathname.toLowerCase().startsWith(prefix));

const looksLikeAsset = (url) => ASSET_EXTENSIONS.has(path.extname(url.pathname).toLowerCase());

const normaliseUrl = (raw, base = sourceOrigin) => {
  if (!raw || /^(?:mailto|tel|javascript|data):/i.test(raw)) return null;
  if (raw.length > 2048 || /(?:&quot|&lt|&gt|[<>"\r\n])/i.test(raw)) return null;

  let url;
  try {
    url = new URL(raw, base);
  } catch {
    return null;
  }

  if (!/^https?:$/.test(url.protocol)) return null;
  url.hash = "";

  for (const parameter of [...url.searchParams.keys()]) {
    if (parameter.toLowerCase().startsWith("utm_") || TRACKING_PARAMETERS.has(parameter.toLowerCase())) {
      url.searchParams.delete(parameter);
    }
  }

  if (acceptedHosts.has(url.hostname.toLowerCase())) {
    url.protocol = "https:";
    url.hostname = canonicalHost;
    url.port = "";
    url.pathname = url.pathname.replace(/\/{2,}/g, "/");
    if (url.pathname !== "/") url.pathname = url.pathname.replace(/\/+$/, "");
    let decodedPathname;
    try {
      decodedPathname = decodeURIComponent(url.pathname);
    } catch {
      return null;
    }
    if (url.pathname.length > 260 || /[\s<>"']/u.test(decodedPathname)) return null;
  }

  url.searchParams.sort();
  return url;
};

const isSameSitePage = (url) =>
  acceptedHosts.has(url.hostname.toLowerCase()) && !looksLikeAsset(url) && !isExcludedPath(url.pathname);

const classify = (url, contentType = "") => {
  const pathname = url.pathname;
  if (looksLikeAsset(url) || (!contentType.includes("html") && ASSET_EXTENSIONS.has(path.extname(pathname).toLowerCase()))) {
    return "asset";
  }
  if (url.searchParams.get("format") === "rss") return "rss";
  if (pathname === "/") return "landing_page";
  if (pathname === "/onderwijs" || pathname === "/education") return "article_index";
  if (pathname === "/onderwijs/workshops-en-nascholingen") return "workshop_catalogue";
  if (["/contact", "/contactinfo", "/contact-english"].includes(pathname)) return "contact_page";
  if (pathname === "/about") return "profile_page";
  if (["/projects", "/videografie-1", "/fotografie"].includes(pathname)) return "project_portfolio";
  if (
    pathname.startsWith("/onderwijs/tag/") ||
    pathname.startsWith("/education/tag/") ||
    pathname.startsWith("/onderwijs/category/") ||
    pathname.startsWith("/education/category/")
  ) return "tag_archive";
  if (pathname.startsWith("/onderwijs/") || pathname.startsWith("/education/")) return "article";
  if (pathname.startsWith("/videografie/")) return "project_detail";
  if (pathname.endsWith("sitemap.xml")) return "sitemap";
  if (pathname.endsWith("robots.txt")) return "robots";
  return "fixed_page";
};

const rawFilename = (url, contentType) => {
  const base = (url.pathname === "/" ? "home" : url.pathname.slice(1).replaceAll(/[^a-zA-Z0-9._-]+/g, "-")).slice(0, 120);
  const extension = contentType.includes("xml") || url.pathname.endsWith(".xml") || url.searchParams.get("format") === "rss"
    ? ".xml"
    : contentType.includes("text/plain") || url.pathname.endsWith("robots.txt")
      ? ".txt"
      : ".html";
  return `${base || "page"}-${shortHash(url.href)}${extension}`;
};

const extractCandidateUrls = ($, pageUrl, html) => {
  const pages = new Map();
  const assets = new Map();

  const add = (raw, source) => {
    const url = normaliseUrl(raw, pageUrl);
    if (!url) return;
    const record = { url: url.href, discovered_from: pageUrl.href, discovery_source: source };

    if (isSameSitePage(url)) {
      pages.set(url.href, record);
    } else if (looksLikeAsset(url) || url.href.startsWith(siteCdnPrefix) || /squarespace-cdn\.com$/i.test(url.hostname)) {
      assets.set(url.href, record);
    }
  };

  $("a[href], link[href]").each((_, element) => add($(element).attr("href"), `${element.tagName}[href]`));
  $("img, source, video, audio").each((_, element) => {
    for (const attribute of ["src", "data-src", "data-image", "poster"]) {
      add($(element).attr(attribute), `${element.tagName}[${attribute}]`);
    }
    for (const attribute of ["srcset", "data-srcset"]) {
      const srcset = $(element).attr(attribute);
      if (!srcset) continue;
      for (const candidate of srcset.split(",")) add(candidate.trim().split(/\s+/)[0], `${element.tagName}[${attribute}]`);
    }
  });

  $("[style]").each((_, element) => {
    const style = $(element).attr("style") ?? "";
    for (const match of style.matchAll(/url\((['"]?)(.*?)\1\)/gi)) add(match[2], "inline-style");
  });

  for (const match of html.matchAll(/https?:\\?\/\\?\/[^\u0000-\u0020"'<>]+/g)) {
    add(match[0].replaceAll("\\/", "/").replace(/[),;]+$/, ""), "embedded-url");
  }

  return { pages: [...pages.values()], assets: [...assets.values()] };
};

const extractMetadata = ($, url) => {
  const getMeta = (selector, attribute = "content") => $(selector).attr(attribute)?.trim() ?? null;
  const jsonLd = [];
  $('script[type="application/ld+json"]').each((_, element) => {
    const raw = $(element).text().trim();
    if (!raw) return;
    try {
      jsonLd.push(JSON.parse(raw));
    } catch {
      jsonLd.push({ parse_error: true, raw_sha256: sha256(raw) });
    }
  });

  return {
    url: url.href,
    title: $("title").first().text().trim() || null,
    h1: $("h1").map((_, element) => $(element).text().replace(/\s+/g, " ").trim()).get(),
    language: $("html").attr("lang") ?? null,
    canonical: getMeta('link[rel="canonical"]', "href"),
    description: getMeta('meta[name="description"]'),
    og_title: getMeta('meta[property="og:title"]'),
    og_description: getMeta('meta[property="og:description"]'),
    og_image: getMeta('meta[property="og:image"]'),
    published_time: getMeta('meta[property="article:published_time"]'),
    modified_time: getMeta('meta[property="article:modified_time"]'),
    json_ld: jsonLd
  };
};

const initialSeeds = () => {
  const seeds = new Set();
  const addPath = (pathname) => seeds.add(normaliseUrl(pathname).href);

  for (const page of orchestrator.authoritative_sources.content_source.fixed_page_seeds) addPath(page.path);
  for (const pathname of orchestrator.authoritative_sources.content_source.known_article_seeds.paths) addPath(pathname);
  addPath("/sitemap.xml");
  addPath("/robots.txt");
  addPath("/onderwijs?format=rss");
  addPath("/education?format=rss");
  addPath("/onderwijs?offset=1700501690492");
  addPath("/education?offset=1654442992993");

  return [...seeds];
};

const wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

const fetchWithRetry = async (url) => {
  let response;
  let lastError;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt += 1) {
    try {
      response = await fetch(url, {
        redirect: "follow",
        headers: {
          "user-agent": USER_AGENT,
          accept: "text/html,application/xhtml+xml,application/xml;q=0.9,text/plain;q=0.8,*/*;q=0.5"
        },
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS)
      });
      if (response.status !== 429 && response.status < 500) return { response, attempts: attempt + 1 };
      lastError = new Error(`HTTP ${response.status}`);
      if (attempt < MAX_RETRIES) await response.body?.cancel();
    } catch (error) {
      lastError = error;
    }

    if (attempt < MAX_RETRIES) await wait([1000, 3000, 7000][attempt] ?? 7000);
  }

  if (response) return { response, attempts: MAX_RETRIES + 1 };
  throw lastError;
};

const writeFileWithRetry = async (filename, contents) => {
  let lastError;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      await writeFile(filename, contents);
      return;
    } catch (error) {
      lastError = error;
      if (attempt < 2) await wait(250 * (attempt + 1));
    }
  }
  throw lastError;
};

await mkdir(RAW_ROOT, { recursive: true });
await mkdir(REPORT_ROOT, { recursive: true });

const queue = initialSeeds();
const queued = new Set(queue);
const records = new Map();
const assets = new Map();
const metadata = [];
const errors = [];
let active = 0;
let graphAdditions = 0;

const enqueue = (candidate, discoveredFrom, discoverySource) => {
  const url = normaliseUrl(candidate);
  if (!url || !isSameSitePage(url) || queued.has(url.href) || records.has(url.href)) return false;
  if (queued.size >= MAX_URLS) return false;
  queued.add(url.href);
  queue.push(url.href);
  graphAdditions += 1;
  records.set(url.href, {
    url: url.href,
    discovered_from: discoveredFrom,
    discovery_source: discoverySource,
    classification: classify(url),
    crawl_status: "queued"
  });
  return true;
};

for (const seed of queue) {
  const url = new URL(seed);
  records.set(seed, {
    url: seed,
    discovered_from: null,
    discovery_source: "seed",
    classification: classify(url),
    crawl_status: "queued"
  });
}

const fetchOne = async (href) => {
  const requestedUrl = new URL(href);
  const existing = records.get(href);
  const startedAt = new Date().toISOString();

  try {
    const { response, attempts } = await fetchWithRetry(requestedUrl);
    const bytes = Buffer.from(await response.arrayBuffer());
    const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";
    const finalUrl = normaliseUrl(response.url) ?? requestedUrl;
    const hash = sha256(bytes);
    const filename = rawFilename(requestedUrl, contentType);
    const relativeRawPath = path.posix.join("migration/raw-html", filename);

    await writeFileWithRetry(path.join(RAW_ROOT, filename), bytes);

    const record = {
      ...existing,
      url: href,
      final_url: finalUrl.href,
      classification: classify(requestedUrl, contentType),
      http_status: response.status,
      ok: response.ok,
      content_type: contentType,
      fetched_at: startedAt,
      response_bytes: bytes.length,
      sha256: hash,
      raw_path: relativeRawPath,
      crawl_status: response.ok ? "snapshotted" : "http_error",
      attempts
    };
    records.set(href, record);

    const text = bytes.toString("utf8");
    if (contentType.includes("html") || /<html[\s>]/i.test(text)) {
      const $ = load(text);
      metadata.push({ ...extractMetadata($, finalUrl), source_html_sha256: hash, raw_path: relativeRawPath });
      const candidates = extractCandidateUrls($, finalUrl, text);
      for (const candidate of candidates.pages) enqueue(candidate.url, candidate.discovered_from, candidate.discovery_source);
      for (const asset of candidates.assets) {
        if (!assets.has(asset.url)) {
          assets.set(asset.url, {
            ...asset,
            classification: "asset",
            crawl_status: "referenced"
          });
        }
      }
    } else if (contentType.includes("xml") || /<(?:urlset|sitemapindex|rss|feed)[\s>]/i.test(text)) {
      const $ = load(text, { xmlMode: true });
      $("loc, link").each((_, element) => {
        const candidate = $(element).attr("href") ?? $(element).text();
        enqueue(candidate, finalUrl.href, element.tagName);
      });
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    records.set(href, {
      ...existing,
      url: href,
      final_url: null,
      fetched_at: startedAt,
      crawl_status: "fetch_error",
      error: message
    });
    errors.push({ url: href, error: message });
  }
};

await new Promise((resolve) => {
  const pump = () => {
    while (active < CONCURRENCY && queue.length > 0) {
      const href = queue.shift();
      active += 1;
      fetchOne(href).finally(() => {
        active -= 1;
        pump();
      });
    }
    if (active === 0 && queue.length === 0) resolve();
  };
  pump();
});

const pageRecords = [...records.values()].sort((a, b) => a.url.localeCompare(b.url));
const assetRecords = [...assets.values()].sort((a, b) => a.url.localeCompare(b.url));
const manifest = {
  schema_version: "1.0.0",
  generated_at: new Date().toISOString(),
  source_origin: sourceOrigin.href,
  crawl_policy: {
    maximum_urls: MAX_URLS,
    concurrency: CONCURRENCY,
    timeout_ms: REQUEST_TIMEOUT_MS,
    graph_closure: queue.length === 0,
    graph_additions: graphAdditions
  },
  summary: {
    page_records: pageRecords.length,
    snapshotted_pages: pageRecords.filter((record) => record.crawl_status === "snapshotted").length,
    http_errors: pageRecords.filter((record) => record.crawl_status === "http_error").length,
    fetch_errors: pageRecords.filter((record) => record.crawl_status === "fetch_error").length,
    referenced_assets: assetRecords.length
  },
  pages: pageRecords,
  assets: assetRecords,
  errors
};

await writeFile(path.join(MIGRATION_ROOT, "source-manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
await writeFile(path.join(REPORT_ROOT, "source-metadata.json"), `${JSON.stringify(metadata, null, 2)}\n`);

const columns = [
  "url", "final_url", "classification", "http_status", "ok", "content_type",
  "fetched_at", "response_bytes", "sha256", "raw_path", "crawl_status",
  "discovered_from", "discovery_source", "error"
];
const ledgerRows = [columns.join(",")];
for (const record of [...pageRecords, ...assetRecords]) {
  ledgerRows.push(columns.map((column) => csvCell(record[column])).join(","));
}
await writeFile(path.join(MIGRATION_ROOT, "url-ledger.csv"), `${ledgerRows.join("\n")}\n`);

const report = `# Source discovery report

- Generated: ${manifest.generated_at}
- Source: ${sourceOrigin.href}
- Page records: ${manifest.summary.page_records}
- Snapshotted pages: ${manifest.summary.snapshotted_pages}
- Referenced assets: ${manifest.summary.referenced_assets}
- HTTP errors: ${manifest.summary.http_errors}
- Fetch errors: ${manifest.summary.fetch_errors}
- Queue closure reached: ${manifest.crawl_policy.graph_closure}
- New graph URLs beyond seeds: ${graphAdditions}

## Accounting

Every discovered URL is represented in \`migration/url-ledger.csv\`. Raw response
bodies and SHA-256 values are stored for all successful page requests. Fetch
errors remain explicit and require bounded retry or manual classification.
`;
await writeFile(path.join(REPORT_ROOT, "discovery-report.md"), report);

console.log(JSON.stringify(manifest.summary, null, 2));
if (manifest.summary.fetch_errors > 0 || manifest.summary.http_errors > 0) process.exitCode = 2;
