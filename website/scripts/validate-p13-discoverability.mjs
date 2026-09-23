import { readFile, readdir, writeFile, mkdir } from "node:fs/promises";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { load } from "cheerio";
import YAML from "yaml";

const root = fileURLToPath(new URL("../", import.meta.url));
const profile = process.argv[2];
if (!new Set(["root", "project"]).has(profile)) throw new Error("Usage: node scripts/validate-p13-discoverability.mjs <root|project>");
const base = profile === "project" ? "/aiindeklas/" : "/";
const build = JSON.parse(await readFile(join(root, `migration/reports/build-${profile}.json`), "utf8"));
const origin = new URL(build.site).origin;
const manifest = YAML.parse(await readFile(resolve(root, "../docs/implementation/manifests/seo-geo.yaml"), "utf8"));
const exceptions = new Map((manifest.logical_route_exceptions ?? []).map((item) => [item.path, item]));
const exceptionByEitherPath = new Map();
for (const item of manifest.logical_route_exceptions ?? []) { exceptionByEitherPath.set(item.path, item); exceptionByEitherPath.set(item.counterpart_path, item); }
const encodedMappings = new Map((manifest.encoded_route_filename_mappings ?? []).map((item) => [item.decoded_filename_path, item]));
const manifestPages = new Map((manifest.pages ?? []).map((item) => [item.path, item]));
const files = [];
async function walk(dir) { for (const entry of await readdir(dir, { withFileTypes: true })) { const file = join(dir, entry.name); if (entry.isDirectory()) await walk(file); else if (file.endsWith(".html")) files.push(file); } }
await walk(join(root, "dist"));
const logicalForFile = (file) => { const rel = relative(join(root, "dist"), file).replaceAll("\\", "/"); return rel === "index.html" ? "/" : `/${rel.replace(/\.html$/, "")}`; };
const fileForLogical = (logical) => join(root, "dist", logical === "/" ? "index.html" : /\.[a-z0-9]+$/i.test(logical) ? logical.slice(1) : `${logical.slice(1)}.html`);
const canonicalLogical = (canonical) => { const path = new URL(canonical).pathname; return profile === "project" ? path.replace(/^\/aiindeklas(?=\/)/, "") || "/" : path || "/"; };
const readText = async (file) => { try { return await readFile(file, "utf8"); } catch { return null; } };
let internalChecked = 0, broken = 0, collisionLinks = 0;
const brokenExamples = [];
let redirectLinks = 0, noncanonicalInternalTargets = 0;
let canonicalMismatch = 0, redirectCanonicalMismatch = 0, collisionCanonicalMismatch = 0, encodedCanonicalMappings = 0;
let schemaBlocks = 0, schemaParsed = 0, schemaParseErrors = 0, schemaTypedBlocks = 0, schemaManifestMismatches = 0;
const indexableCanonicals = new Set();
const canonicalMismatches = [];
for (const file of files) {
  const source = await readFile(file, "utf8"); const $ = load(source); const path = logicalForFile(file);
  const canonical = $("link[rel=canonical]").attr("href") ?? null;
  const redirect = Boolean($("meta[http-equiv='refresh']").length);
  let canonicalPath = null;
  if (canonical) {
    try {
      const u = new URL(canonical); canonicalPath = canonicalLogical(canonical);
      if (u.origin !== origin || (profile === "project" ? !u.pathname.startsWith(base) : u.pathname.startsWith("/aiindeklas/"))) canonicalMismatch++;
      else if (canonicalPath !== path) {
        const expectedCollision = exceptionByEitherPath.get(path);
        if (expectedCollision && new Set([expectedCollision.path, expectedCollision.counterpart_path]).has(canonicalPath)) collisionCanonicalMismatch++;
        else if (encodedMappings.has(path) && encodedMappings.get(path).logical_path === canonicalPath) encodedCanonicalMappings++;
        else if (redirect) redirectCanonicalMismatch++;
        else { canonicalMismatch++; canonicalMismatches.push({ file: relative(join(root, "dist"), file).replaceAll("\\", "/"), path, canonical_path: canonicalPath }); }
      }
    } catch { canonicalMismatch++; }
  } else canonicalMismatch++;
  if (!$("meta[name=robots]").attr("content")?.includes("noindex")) indexableCanonicals.add(canonical);
  for (const script of $("script[type='application/ld+json']").toArray()) {
    schemaBlocks++; try { const parsed = JSON.parse($(script).text()); if (parsed && typeof parsed === "object") { schemaParsed++; if (parsed["@type"] || Array.isArray(parsed["@graph"]) && parsed["@graph"].some((item) => item?.["@type"])) schemaTypedBlocks++; else schemaParseErrors++; } else schemaParseErrors++; } catch { schemaParseErrors++; }
  }
  const manifestPage = manifestPages.get(path);
  const expectedSchema = manifestPage?.profiles?.[profile]?.schema?.status;
  if (expectedSchema && ((expectedSchema === "not_present_review_gate") !== ($("script[type='application/ld+json']").length === 0))) schemaManifestMismatches++;
  for (const a of $("a[href]").toArray()) {
    const href = $(a).attr("href") ?? ""; if (!href || href.startsWith("#") || /^(mailto:|tel:|data:|blob:|javascript:)/i.test(href)) continue;
    let target; try { target = new URL(href, new URL(base, origin)); } catch { continue; }
    if (target.origin !== origin) continue;
    // GitHub Pages sibling projects share an origin but are outside this configured base.
    if (base !== "/" && !target.pathname.startsWith(base)) continue;
    internalChecked++;
    let logical = decodeURI(target.pathname);
    if (base !== "/") { if (logical === base.slice(0,-1) || logical === base) logical = "/"; else if (logical.startsWith(base)) logical = `/${logical.slice(base.length)}`; else { broken++; brokenExamples.push({ source: relative(join(root, "dist"), file).replaceAll("\\", "/"), href }); continue; } }
    logical = logical.replace(/\/$/, "") || "/";
    const requestedFile = fileForLogical(logical);
    let targetHtml = await readText(requestedFile);
    if (!targetHtml) {
      const exception = exceptionByEitherPath.get(logical);
      if (exception) {
        const counterpart = logical === exception.path ? exception.counterpart_path : exception.path;
        targetHtml = await readText(fileForLogical(counterpart));
        if (targetHtml) { collisionLinks++; const target$ = load(targetHtml); if (canonicalLogical(target$("link[rel=canonical]").attr("href") ?? "") !== exception.counterpart_path) broken++; continue; }
      }
      broken++; brokenExamples.push({ source: relative(join(root, "dist"), file).replaceAll("\\", "/"), href, logical }); continue;
    }
    const target$ = load(targetHtml); const targetCanonical = target$("link[rel=canonical]").attr("href") ?? "";
    if (target$("meta[http-equiv='refresh']").length) { redirectLinks++; continue; }
    if (targetCanonical && canonicalLogical(targetCanonical) !== logical) {
      const exception = exceptionByEitherPath.get(logical);
      if (exception && new Set([exception.path, exception.counterpart_path]).has(canonicalLogical(targetCanonical))) collisionLinks++;
      else if (encodedMappings.has(logical) && encodedMappings.get(logical).logical_path === canonicalLogical(targetCanonical)) { /* Source percent encoding is preserved in canonical URLs. */ }
      else noncanonicalInternalTargets++;
    }
  }
}
const xml = async (name) => load(await readFile(join(root, "dist", name), "utf8"), { xmlMode: true });
const sitemap = await xml("sitemap.xml"); const sitemapLocations = sitemap("loc").toArray().map((node) => sitemap(node).text().trim());
const feeds = {};
for (const [name, file] of [["nl", "onderwijs/rss.xml"], ["en", "education/rss.xml"]]) { const feed = await xml(file); feeds[name] = { items: feed("channel > item").length, channel_link: feed("channel > link").first().text().trim() }; }
const robotsText = await readFile(join(root, "dist", "robots.txt"), "utf8");
const expectedRobotsAllow = indexableCanonicals.size > 0;
const robotsSitemap = robotsText.match(/^Sitemap:\s*(.+)$/m)?.[1] ?? null;
const expectedSitemapUrl = new URL(`${base}sitemap.xml`, origin).href;
const feedChannelBaseMatches = Object.values(feeds).every(({ channel_link }) => channel_link === new URL(base, origin).href.replace(/\/$/, ""));
const sitemapMatchesIndexableCanonicals = sitemapLocations.length === indexableCanonicals.size && sitemapLocations.every((url) => indexableCanonicals.has(url));
const feedItemsWhileNoindex = indexableCanonicals.size === 0 && Object.values(feeds).some(({ items }) => items > 0);
const robotsPostureMatches = expectedRobotsAllow ? /Allow:\s*\//.test(robotsText) : /Disallow:\s*\//.test(robotsText);
const robotsSitemapMatches = robotsSitemap === expectedSitemapUrl;
const report = {
  schema_version: "1.0.0", profile, site: origin, base, rendered_html_files: files.length,
  internal_links_checked: internalChecked, genuine_broken_links: broken, genuine_broken_link_examples: brokenExamples.slice(0, 40),
  links_to_accepted_case_collisions: collisionLinks, links_to_accepted_redirects: redirectLinks, noncanonical_internal_html_targets: noncanonicalInternalTargets,
  canonical_mismatches: canonicalMismatch, redirect_canonical_mismatches: redirectCanonicalMismatch,
  accepted_case_collision_canonical_mismatches: collisionCanonicalMismatch, encoded_filename_canonical_mappings: encodedCanonicalMappings, canonical_mismatch_examples: canonicalMismatches.slice(0, 20),
  sitemap_locations: sitemapLocations.length, sitemap_locations_matching_indexable_canonicals: sitemapLocations.filter((loc) => indexableCanonicals.has(loc)).length,
  sitemap_set_matches_indexable_canonicals: sitemapMatchesIndexableCanonicals,
  indexable_canonicals: indexableCanonicals.size, feed_items: feeds,
  feed_channel_base_matches: feedChannelBaseMatches, feed_items_while_noindex: feedItemsWhileNoindex,
  robots: { disallows_all: /Disallow:\s*\//.test(robotsText), allows_root: /Allow:\s*\//.test(robotsText), expected_allow: expectedRobotsAllow, posture_matches: robotsPostureMatches, sitemap_url: robotsSitemap, sitemap_url_matches: robotsSitemapMatches },
  json_ld: { blocks: schemaBlocks, parsed_object_blocks: schemaParsed, parse_errors: schemaParseErrors, typed_blocks: schemaTypedBlocks, P12_manifest_mismatches: schemaManifestMismatches },
  unresolved_case_collision_routes: [...exceptions.keys()],
  accepted_exception_counts_match: redirectCanonicalMismatch === 3 && collisionCanonicalMismatch === 17 && encodedCanonicalMappings === 2 && exceptions.size === 17,
  status: broken === 0 && canonicalMismatch === 0 && noncanonicalInternalTargets === 0 && schemaParseErrors === 0 && schemaManifestMismatches === 0 && sitemapMatchesIndexableCanonicals && feedChannelBaseMatches && !feedItemsWhileNoindex && robotsPostureMatches && robotsSitemapMatches && redirectCanonicalMismatch === 3 && collisionCanonicalMismatch === 17 && encodedCanonicalMappings === 2 && exceptions.size === 17 ? "passed" : "findings"
};
const output = join(root, `migration/reports/P13-discoverability-${profile}.json`); await mkdir(dirname(output), { recursive: true }); await writeFile(output, `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report, null, 2));
if (report.status !== "passed") process.exitCode = 1;
