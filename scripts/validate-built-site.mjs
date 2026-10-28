import { access, mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { load } from "cheerio";
import YAML from "yaml";

const workspace = fileURLToPath(new URL("../", import.meta.url));
const seoManifest = YAML.parse(await readFile(resolve(workspace, "../docs/implementation/manifests/seo-geo.yaml"), "utf8"));
const collisionCounterparts = new Map((seoManifest.logical_route_exceptions ?? []).map(({ path, counterpart_path }) => [path, counterpart_path]));

export const normaliseBasePath = (value = "/") => {
  const trimmed = value.trim().replace(/^\/+|\/+$/g, "");
  return trimmed ? `/${trimmed}/` : "/";
};

export const logicalPathFromDeployed = (pathname, base = "/") => {
  const normalisedBase = normaliseBasePath(base);
  if (normalisedBase === "/") return pathname || "/";
  const baseWithoutSlash = normalisedBase.slice(0, -1);
  if (pathname === baseWithoutSlash || pathname === normalisedBase) return "/";
  if (!pathname.startsWith(normalisedBase)) return null;
  return `/${pathname.slice(normalisedBase.length)}`.replace(/\/$/, "") || "/";
};

export const outputFileForLogicalPath = (logicalPath, outputDirectory) => {
  if (logicalPath === "/") return join(outputDirectory, "index.html");
  const relativePath = logicalPath.replace(/^\//, "");
  if (/\.[a-z0-9]+$/i.test(relativePath)) return join(outputDirectory, relativePath);
  return join(outputDirectory, `${relativePath}.html`);
};

const srcsetUrls = (value) => value
  .split(",")
  .map((candidate) => candidate.trim().split(/\s+/, 1)[0])
  .filter(Boolean);

const cssUrls = (value) => [...value.matchAll(/url\(\s*["']?([^"')]+)["']?\s*\)/gi)]
  .map((match) => match[1]);

export const urlsFromHtml = (source) => {
  const $ = load(source);
  const urls = [];
  const attributes = [
    ["a[href]", "href", "anchor"],
    ["link[href]", "href", "link"],
    ["script[src]", "src", "script"],
    ["img[src]", "src", "image"],
    ["source[src]", "src", "source"],
    ["video[src]", "src", "video"],
    ["video[poster]", "poster", "poster"],
    ["audio[src]", "src", "audio"],
    ["iframe[src]", "src", "iframe"],
    ["object[data]", "data", "object"],
    ['meta[property="og:image"][content]', "content", "social-image"],
    ['meta[name="twitter:image"][content]', "content", "social-image"]
  ];
  for (const [selector, attribute, kind] of attributes) {
    for (const element of $(selector).toArray()) {
      const value = $(element).attr(attribute);
      if (value) urls.push({ kind, url: value });
    }
  }
  for (const selector of ["img[srcset]", "source[srcset]"]) {
    for (const element of $(selector).toArray()) {
      for (const url of srcsetUrls($(element).attr("srcset") ?? "")) urls.push({ kind: "srcset", url });
    }
  }
  for (const element of $("meta[http-equiv]").toArray()) {
    if ($(element).attr("http-equiv")?.toLowerCase() !== "refresh") continue;
    const match = ($(element).attr("content") ?? "").match(/(?:^|;)\s*url\s*=\s*(.+)$/i);
    if (match) urls.push({ kind: "refresh", url: match[1].trim().replace(/^['"]|['"]$/g, "") });
  }
  for (const element of $("style").toArray()) {
    for (const url of cssUrls($(element).html() ?? "")) urls.push({ kind: "inline-style", url });
  }
  for (const element of $("[style]").toArray()) {
    for (const url of cssUrls($(element).attr("style") ?? "")) urls.push({ kind: "style-attribute", url });
  }
  return urls;
};

const listFiles = async (directory) => {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await listFiles(path));
    if (entry.isFile()) files.push(path);
  }
  return files;
};

const exists = async (path) => {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
};

export const validateBuiltSite = async ({
  outputDirectory = resolve(workspace, "dist"),
  base = "/",
  site = "http://localhost:4321",
  profile = "root",
  expectIndexing = false,
  reportPath = null
} = {}) => {
  const normalisedBase = normaliseBasePath(base);
  const origin = new URL(site);
  const files = await listFiles(outputDirectory);
  const htmlFiles = files.filter((file) => file.endsWith(".html"));
  const cssFiles = files.filter((file) => file.endsWith(".css"));
  const errors = [];
  let internalUrls = 0;
  let indexablePages = 0;
  let noindexPages = 0;

  const validateUrl = async (rawUrl, label, kind) => {
    if (!rawUrl || rawUrl.startsWith("#") || /^(mailto:|tel:|data:|blob:)/i.test(rawUrl)) return;
    if (/^javascript:/i.test(rawUrl)) {
      errors.push(`${label}: unsafe javascript URL in ${kind}`);
      return;
    }
    let target;
    try {
      target = new URL(rawUrl, new URL(normalisedBase, origin));
    } catch {
      errors.push(`${label}: invalid ${kind} URL ${rawUrl}`);
      return;
    }
    if (target.origin !== origin.origin) return;
    if (normalisedBase !== "/" && /^https?:/i.test(rawUrl) && !target.pathname.startsWith(normalisedBase)) {
      // A same-origin absolute URL can intentionally point to a sibling GitHub Pages project.
      return;
    }
    internalUrls += 1;
    let decodedPathname = target.pathname;
    try { decodedPathname = decodeURI(target.pathname); } catch { /* Keep the original encoded path for diagnostics. */ }
    const logical = logicalPathFromDeployed(decodedPathname, normalisedBase);
    if (logical === null) {
      errors.push(`${label}: internal ${kind} escapes configured base (${rawUrl})`);
      return;
    }
    const targetFile = outputFileForLogicalPath(logical, outputDirectory);
    if (!await exists(targetFile)) {
      const counterpart = collisionCounterparts.get(logical);
      if (counterpart) {
        const counterpartFile = outputFileForLogicalPath(counterpart, outputDirectory);
        if (await exists(counterpartFile)) return;
      }
      errors.push(`${label}: broken internal ${kind} ${rawUrl}`);
    }
  };

  for (const file of htmlFiles) {
    const source = await readFile(file, "utf8");
    const $ = load(source);
    const label = relative(outputDirectory, file).replaceAll("\\", "/");
    const lang = $("html").attr("lang");
    const robots = $('meta[name="robots"]').attr("content") ?? "";
    const isNoindex = robots.includes("noindex");
    if (isNoindex) noindexPages += 1;
    else indexablePages += 1;

    if (!new Set(["nl-BE", "en"]).has(lang)) errors.push(`${label}: invalid or missing html lang`);
    if ($("h1").length !== 1) errors.push(`${label}: expected exactly one h1, found ${$("h1").length}`);
    if ($("main#main-content").length !== 1) errors.push(`${label}: missing unique main#main-content`);
    const shellExemptions = new Set(["admin.html", "contact-english.html", "english.html", "over.html"]);
    if (!shellExemptions.has(label)) {
      if ($("header.site-header").length !== 1) errors.push(`${label}: expected exactly one site header`);
      if ($("nav#primary-navigation").length !== 1) errors.push(`${label}: expected exactly one primary navigation`);
      if ($("footer.site-footer").length !== 1) errors.push(`${label}: expected exactly one site footer`);
      if ($(".site-header .brand").text().trim() !== "Robbe Wulgaert" || $(".site-header .brand-mark").length > 0) {
        errors.push(`${label}: header must use the source text wordmark without an invented badge`);
      }
      const socialLinks = $("footer.site-footer a[target='_blank']").toArray();
      if (socialLinks.length !== 6) errors.push(`${label}: expected all six source social links in the footer`);
      for (const element of socialLinks) {
        const rel = new Set(($(element).attr("rel") ?? "").split(/\s+/));
        if (!$(element).text().trim() || !$(element).attr("aria-label") || !rel.has("noopener") || !rel.has("noreferrer")) {
          errors.push(`${label}: footer social links need a discernible label and safe external-link attributes`);
          break;
        }
      }
      const menuButton = $("[data-menu-button]");
      if (menuButton.length !== 1 || menuButton.attr("aria-controls") !== "primary-navigation") {
        errors.push(`${label}: mobile menu button must control primary-navigation`);
      }
      if (!new Set(["true", "false"]).has(menuButton.attr("aria-expanded"))) {
        errors.push(`${label}: mobile menu button must expose a boolean aria-expanded state`);
      }
    }
    if ($('a.skip-link[href="#main-content"]').length !== 1) errors.push(`${label}: missing skip link`);
    if (!$('meta[name="description"]').attr("content")?.trim()) errors.push(`${label}: missing description`);
    if (!expectIndexing && !isNoindex) errors.push(`${label}: preview must remain noindex`);
    if (expectIndexing && ["404.html", "contact-english.html", "english.html"].includes(label) && !isNoindex) {
      errors.push(`${label}: system/redirect output must remain noindex`);
    }
    if (!$('link[rel="canonical"]').attr("href")) errors.push(`${label}: missing canonical`);
    if (!$("title").text().trim()) errors.push(`${label}: missing title`);

    const ids = $("[id]").toArray().map((element) => $(element).attr("id"));
    if (new Set(ids).size !== ids.length) errors.push(`${label}: duplicate id attribute`);
    const canonicalHref = $("link[rel=canonical]").attr("href");
    const currentPath = canonicalHref ? logicalPathFromDeployed(new URL(canonicalHref).pathname, normalisedBase) : null;
    const navLinks = $("#primary-navigation .navigation-list a").toArray().map((element) => ({
      href: $(element).attr("href"),
      path: $(element).attr("href") ? logicalPathFromDeployed(new URL($(element).attr("href"), origin).pathname, normalisedBase) : null
    }));
    const expectedCurrent = currentPath === null ? null : navLinks
      .filter(({ path }) => path && (path === "/" ? currentPath === "/" || currentPath === "/over" : currentPath === path || currentPath.startsWith(`${path}/`)))
      .sort((a, b) => b.path.length - a.path.length)[0] ?? null;
    const markedCurrent = $("#primary-navigation .navigation-list a[aria-current='page']").toArray();
    if (expectedCurrent && (markedCurrent.length !== 1 || $(markedCurrent[0]).attr("href") !== expectedCurrent.href)) {
      errors.push(`${label}: active primary-navigation link does not match the canonical page`);
    } else if (!expectedCurrent && markedCurrent.length !== 0) {
      errors.push(`${label}: primary navigation marks a page current without a matching route`);
    }

    for (const { url, kind } of urlsFromHtml(source)) await validateUrl(url, label, kind);
  }

  for (const file of cssFiles) {
    const label = relative(outputDirectory, file).replaceAll("\\", "/");
    for (const url of cssUrls(await readFile(file, "utf8"))) await validateUrl(url, label, "stylesheet asset");
  }

  const robotsPath = join(outputDirectory, "robots.txt");
  const sitemapPath = join(outputDirectory, "sitemap.xml");
  if (!await exists(robotsPath)) errors.push("robots.txt: missing generated output");
  if (!await exists(sitemapPath)) errors.push("sitemap.xml: missing generated output");
  if (await exists(robotsPath)) {
    const robots = await readFile(robotsPath, "utf8");
    if (expectIndexing && indexablePages > 0 && !robots.includes("Allow: /")) errors.push("robots.txt: indexable production profile must allow crawling");
    if ((indexablePages === 0 || !expectIndexing) && !robots.includes("Disallow: /")) errors.push("robots.txt: noindex profile must disallow crawling");
    if (!robots.includes(new URL(`${normalisedBase}sitemap.xml`, origin).href)) errors.push("robots.txt: sitemap URL is not base-aware");
  }
  if (await exists(sitemapPath)) {
    const sitemap = await readFile(sitemapPath, "utf8");
    const $xml = load(sitemap, { xmlMode: true });
    const locations = $xml("loc").toArray().map((element) => $xml(element).text().trim());
    if (expectIndexing && indexablePages > 0 && locations.length === 0) errors.push("sitemap.xml: no locations found in indexable production profile");
    for (const location of locations) await validateUrl(location, "sitemap.xml", "location");
  }
  if (expectIndexing && indexablePages === 0) errors.push("production simulation: no indexable page exists");

  const report = {
    schema_version: "1.0.0",
    profile,
    site: origin.href,
    base: normalisedBase,
    html_files: htmlFiles.length,
    internal_urls_checked: internalUrls,
    indexable_pages: indexablePages,
    noindex_pages: noindexPages,
    generated_system_outputs: 2,
    errors,
    status: errors.length === 0 ? "passed" : "failed"
  };

  if (reportPath) {
    await mkdir(dirname(reportPath), { recursive: true });
    await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);
  }
  if (errors.length) throw new Error(`Built-site validation failed:\n${errors.join("\n")}`);
  return report;
};

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const profile = process.argv[2] ?? "root";
  const base = profile === "project" ? "/aiindeklas/" : "/";
  const site = profile === "project" ? "https://robbew.github.io" : profile === "production-sim" ? "https://www.robbewulgaert.be" : "http://localhost:4321";
  console.log(JSON.stringify(await validateBuiltSite({ profile, base, site, expectIndexing: profile === "production-sim" }), null, 2));
}
