import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { readFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { load } from "cheerio";
import YAML from "yaml";

const workspace = fileURLToPath(new URL("../", import.meta.url));
const profile = process.argv[2];
if (!new Set(["root", "project"]).has(profile)) throw new Error("Usage: node scripts/crawl-seo-geo.mjs <root|project>");
const dist = resolve(workspace, "dist");
const reportDir = resolve(workspace, "migration/reports");
const manifestPath = resolve(workspace, "../docs/implementation/manifests/seo-geo.yaml");
const files = [];
async function walk(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) await walk(path);
    else if (entry.isFile() && path.endsWith(".html")) files.push(path);
  }
}
await walk(dist);
const pathForFile = (file) => {
  const rel = relative(dist, file).replaceAll("\\", "/");
  if (rel === "index.html") return "/";
  return `/${rel.replace(/\.html$/, "")}`;
};
const buildReport = JSON.parse(readFileSync(join(reportDir, `build-${profile}.json`), "utf8"));
const expectedOrigin = new URL(buildReport.site).origin;
const logicalPathFromCanonical = (canonical) => {
  const pathname = new URL(canonical).pathname;
  return profile === "project" ? pathname.replace(/^\/aiindeklas(?=\/)/, "") : pathname;
};
const pages = files.sort().map((file) => {
  const $ = load(readFileSync(file));
  const main = $("main").first();
  const collection = main.attr("data-content-collection") ?? null;
  const contentId = main.attr("data-content-id") ?? null;
  const isRedirect = Boolean($("meta[http-equiv='refresh']").length);
  const pageType = collection === "articles" ? "article"
    : collection === "pages" ? "content_page"
      : $("[data-cms-studio]").length ? "admin"
        : isRedirect ? "redirect"
          : $(".listing-layout").length ? "listing"
            : pathForFile(file) === "/404" ? "not_found"
              : "system_or_special";
  const description = $("meta[name='description']").attr("content") ?? null;
  const title = $("title").text().trim() || null;
  const canonical = $("link[rel='canonical']").attr("href") ?? null;
  const jsonld = $("script[type='application/ld+json']").toArray().map((node) => {
    try { return JSON.parse($(node).text()); } catch { return { parse_error: true }; }
  });
  const imageAlt = $("main img").toArray().map((image) => $(image).attr("alt") ?? null);
  const contextualLinks = $("main a[href]").toArray().filter((anchor) => {
    const href = $(anchor).attr("href") ?? "";
    return href.startsWith("/") && !href.startsWith("//") && !href.startsWith("#");
  }).length;
  const publishedAt = $("meta[property='article:published_time']").attr("content") ?? null;
  const modifiedAt = $("meta[property='article:modified_time']").attr("content") ?? null;
  const socialImage = $("meta[property='og:image']").attr("content") ?? null;
  let canonicalProfileMatch = false;
  try {
    const canonicalUrl = new URL(canonical);
    const canonicalPathMatchesBase = profile === "project"
      ? canonicalUrl.pathname === "/aiindeklas" || canonicalUrl.pathname.startsWith("/aiindeklas/")
      : !canonicalUrl.pathname.startsWith("/aiindeklas/");
    canonicalProfileMatch = canonicalUrl.origin === expectedOrigin && canonicalPathMatchesBase;
  } catch { /* missing or malformed canonicals are reported below */ }
  return {
    path: pathForFile(file), canonical_logical_path: canonical ? logicalPathFromCanonical(canonical) : null,
    file: relative(dist, file).replaceAll("\\", "/"), page_type: pageType,
    content_id: contentId, locale: $("html").attr("lang") ?? null,
    title, description, canonical, robots: $("meta[name='robots']").attr("content") ?? null,
    canonical_profile_match: canonicalProfileMatch,
    open_graph: {
      type: $("meta[property='og:type']").attr("content") ?? null,
      title: $("meta[property='og:title']").attr("content") ?? null,
      description: $("meta[property='og:description']").attr("content") ?? null,
      image: socialImage
    },
    social_image_status: socialImage ? "present" : "not_provided_or_review_gated",
    author_date: pageType === "article"
      ? { author: "source_reference_present_review_gated", published: publishedAt ? "present" : "missing", published_at: publishedAt, modified_at: modifiedAt }
      : { status: "not_applicable" },
    image_alt: {
      image_count: imageAlt.length, empty_alt_count: imageAlt.filter((alt) => !alt).length,
      status: imageAlt.length === 0 ? "not_applicable" : pageType === "listing" && imageAlt.every((alt) => !alt) ? "linked_card_title_covers_empty_alt" : imageAlt.every(Boolean) ? "all_nonempty" : "source_image_alt_review_required"
    },
    contextual_internal_links: {
      count: contextualLinks,
      status: contextualLinks > 0 ? "present" : ["redirect", "admin", "not_found", "system_or_special"].includes(pageType) ? "not_applicable" : "none_review_required"
    },
    headings: { h1_count: $("h1").length, h1: $("h1").first().text().trim() || null },
    schema: jsonld.length ? { status: "present", types: jsonld.flatMap((item) => Array.isArray(item["@type"]) ? item["@type"] : [item["@type"]]).filter(Boolean) }
      : { status: "not_present_review_gate", types: [] },
    breadcrumb: "not_present_review_gate"
  };
});
const taxonomyRoutes = JSON.parse(readFileSync(resolve(workspace, "src/data/taxonomy-routes.json"), "utf8"));
const acceptedRouteRows = parseCsv(readFileSync(resolve(workspace, "migration/route-map.csv"), "utf8"));
const acceptedCollisionIds = new Map(acceptedRouteRows
  .filter((row) => row.case_collision_id)
  .map((row) => [row.source_path, row.case_collision_id]));
const physicalRoutePaths = files.map(pathForFile);
const taxonomyByCaseFoldedPath = new Map();
for (const route of taxonomyRoutes) {
  const key = decodeURIComponent(route.path).toLocaleLowerCase("en-US");
  taxonomyByCaseFoldedPath.set(key, [...(taxonomyByCaseFoldedPath.get(key) ?? []), route]);
}
const collisionGroups = [...taxonomyByCaseFoldedPath.values()].filter((routes) => routes.length > 1);
if (collisionGroups.length !== 17 || collisionGroups.some((routes) => routes.length !== 2)) {
  throw new Error(`Expected 17 two-route case collision groups; found ${collisionGroups.length} groups with sizes ${collisionGroups.map((routes) => routes.length).join(",")}`);
}
const logicalRouteExceptions = collisionGroups.map((routes) => {
  const decodedPaths = routes.map((route) => decodeURIComponent(route.path));
  const physicalPath = physicalRoutePaths.find((path) => decodedPaths.includes(path));
  if (!physicalPath) throw new Error(`No physical counterpart found for taxonomy collision ${routes.map((route) => route.path).join(" / ")}`);
  const physicalPage = pages.find((page) => page.path === physicalPath);
  if (!physicalPage?.canonical) throw new Error(`No canonical found for physical collision file ${physicalPath}`);
  const renderedLogicalPath = logicalPathFromCanonical(physicalPage.canonical);
  const counterpart = routes.find((route) => route.path === renderedLogicalPath);
  if (!counterpart) throw new Error(`Rendered canonical ${renderedLogicalPath} does not match either route in ${routes.map((route) => route.path).join(" / ")}`);
  const unrendered = routes.find((route) => route !== counterpart);
  const collisionId = acceptedCollisionIds.get(unrendered.path);
  if (!collisionId || acceptedCollisionIds.get(counterpart.path) !== collisionId) {
    throw new Error(`Accepted P02 collision ID missing or inconsistent for ${routes.map((route) => route.path).join(" / ")}`);
  }
  return {
    path: unrendered.path,
    case_collision_id: collisionId,
    counterpart_path: counterpart.path,
    rendered_logical_path: counterpart.path,
    rendered_status: "not_independently_rendered_windows_case_collision",
    metadata_status: "pending_case_sensitive_build",
    schema_status: "pending_case_sensitive_build",
    evidence: {
      taxonomy_source: "src/data/taxonomy-routes.json",
      accepted_route_source: "migration/route-map.csv",
      route_count_in_collision_group: routes.length,
      physical_file_count: 1,
      rendered_file: `dist${physicalPath}.html`,
      rendered_logical_path: renderedLogicalPath,
      rendered_canonical: physicalPage.canonical,
      taxonomy_labels: routes.map((route) => route.label)
    }
  };
}).sort((a, b) => a.path.localeCompare(b.path));
if (logicalRouteExceptions.length !== 17 || new Set(logicalRouteExceptions.map((item) => item.path)).size !== 17) {
  throw new Error(`Logical route exception assertion failed: ${logicalRouteExceptions.length} records`);
}
if (new Set(logicalRouteExceptions.map((item) => item.case_collision_id)).size !== 17) {
  throw new Error("Expected 17 unique accepted P02 case_collision_id values");
}
const encodedRouteFilenameMappings = taxonomyRoutes.flatMap((route) => {
  const decodedPath = decodeURIComponent(route.path);
  if (decodedPath === route.path || logicalRouteExceptions.some((exception) => exception.path === route.path || exception.counterpart_path === route.path)) return [];
  const expectedFile = `${decodedPath.slice(1)}.html`;
  const renderedFile = files.find((file) => relative(dist, file).replaceAll("\\", "/") === expectedFile);
  if (!renderedFile) return [];
  const renderedPage = pages.find((page) => page.path === decodedPath);
  if (!renderedPage?.canonical) throw new Error(`Decoded filename has no crawled canonical: ${decodedPath}`);
    const canonicalPath = new URL(renderedPage.canonical).pathname.replace(/^\/aiindeklas(?=\/)/, "");
  if (canonicalPath !== route.path) throw new Error(`Encoded canonical mismatch for ${route.path}: ${canonicalPath}`);
  return [{
    logical_path: route.path,
    decoded_filename_path: decodedPath,
    rendered_status: "rendered_at_decoded_unicode_filename",
    metadata_status: "rendered_metadata_recorded",
    schema_status: renderedPage.schema.status,
    canonical_status: "source_percent_encoding_preserved",
    rendered_canonical: renderedPage.canonical,
    evidence: { taxonomy_source: "src/data/taxonomy-routes.json", rendered_file: `dist/${expectedFile}` }
  }];
});
if (encodedRouteFilenameMappings.length !== 2) {
  throw new Error(`Expected 2 percent-encoded taxonomy paths with decoded filenames; found ${encodedRouteFilenameMappings.length}`);
}
const summary = {
  profile, physical_html_files: pages.length, pages, logical_route_exceptions: logicalRouteExceptions,
  encoded_route_filename_mappings: encodedRouteFilenameMappings,
  checks: {
    missing_title: pages.filter((page) => !page.title).length,
    missing_description: pages.filter((page) => !page.description).length,
    overlong_description: pages.filter((page) => (page.description?.length ?? 0) > 180).length,
    missing_canonical: pages.filter((page) => !page.canonical).length,
    canonical_profile_mismatch: pages.filter((page) => !page.canonical_profile_match).length,
    non_noindex: pages.filter((page) => page.robots !== "noindex, nofollow").length,
    missing_h1: pages.filter((page) => page.headings.h1_count === 0 && !["redirect", "admin"].includes(page.page_type)).length
  }
};
await mkdir(reportDir, { recursive: true });
const reportPath = join(reportDir, `P12-rendered-${profile}.json`);
if (buildReport.html_files !== pages.length) throw new Error(`${profile} crawl has ${pages.length} pages; build report says ${buildReport.html_files}`);
summary.build_validation = { html_files: buildReport.html_files, indexable_pages: buildReport.indexable_pages, noindex_pages: buildReport.noindex_pages, errors: buildReport.errors.length, status: buildReport.status };
const failedChecks = Object.entries(summary.checks).filter(([, count]) => count > 0);
if (failedChecks.length) throw new Error(`P12 rendered-page checks failed: ${failedChecks.map(([name, count]) => `${name}=${count}`).join(", ")}`);
await writeFile(reportPath, `${JSON.stringify(summary, null, 2)}\n`);
const reportPaths = ["root", "project"].map((name) => join(reportDir, `P12-rendered-${name}.json`));
const reports = [];
for (const path of reportPaths) {
  try { reports.push(JSON.parse(await readFile(path, "utf8"))); } catch { /* wait for both profiles */ }
}
if (reports.length === 2) {
  const byPath = new Map();
  for (const report of reports) for (const page of report.pages) {
    const row = byPath.get(page.path) ?? { path: page.path, canonical_logical_path: page.canonical_logical_path, page_type: page.page_type, content_id: page.content_id, locale: page.locale, profiles: {} };
    row.profiles[report.profile] = {
      file: page.file, title: page.title, description: page.description, canonical: page.canonical,
      canonical_profile_match: page.canonical_profile_match, robots: page.robots, open_graph: page.open_graph, headings: page.headings,
      schema: page.schema, breadcrumb: page.breadcrumb, social_image_status: page.social_image_status,
      author_date: page.author_date, image_alt: page.image_alt, contextual_internal_links: page.contextual_internal_links
    };
    byPath.set(page.path, row);
  }
  const exceptionByPath = new Map();
  for (const report of reports) for (const item of report.logical_route_exceptions) {
    const row = exceptionByPath.get(item.path) ?? {
      path: item.path, case_collision_id: item.case_collision_id, counterpart_path: item.counterpart_path,
      rendered_logical_path: item.rendered_logical_path,
      rendered_status: item.rendered_status, metadata_status: item.metadata_status, schema_status: item.schema_status,
      evidence: { ...item.evidence, profiles: {} }
    };
    row.evidence.profiles[report.profile] = {
      rendered_file: item.evidence.rendered_file,
      rendered_logical_path: item.evidence.rendered_logical_path,
      rendered_canonical: item.evidence.rendered_canonical
    };
    exceptionByPath.set(item.path, row);
  }
  const encodedByPath = new Map();
  for (const report of reports) for (const item of report.encoded_route_filename_mappings) {
    const row = encodedByPath.get(item.logical_path) ?? {
      logical_path: item.logical_path, decoded_filename_path: item.decoded_filename_path,
      rendered_status: item.rendered_status, metadata_status: item.metadata_status,
      schema_status: item.schema_status, canonical_status: item.canonical_status, profiles: {}
    };
    row.profiles[report.profile] = { rendered_canonical: item.rendered_canonical, rendered_file: item.evidence.rendered_file };
    encodedByPath.set(item.logical_path, row);
  }
  const manifest = {
    schema: "website-migration.seo-geo/v1",
    generated_from: "Rendered root and /aiindeklas/ profile HTML; content facts are bounded by source frontmatter and visible rendered headings.",
    coverage: {
      physical_html_files_per_profile: reports.map((report) => ({ profile: report.profile, count: report.physical_html_files })),
      logical_route_gap: "Earlier accepted builds report 382 generated routes and 365 physical Windows HTML files. The 17 exact case-only taxonomy route collisions are listed individually under logical_route_exceptions; none is claimed as independently crawled.",
      encoded_route_filename_mappings: "The two percent-encoded diacritic taxonomy routes that render to decoded Unicode filenames are listed separately; they are not case collisions.",
      non_html_system_outputs: ["/admin/content.json", "/education/rss.xml", "/onderwijs/rss.xml", "/robots.txt", "/sitemap.xml"]
    },
    logical_route_exceptions: [...exceptionByPath.values()].sort((a, b) => a.path.localeCompare(b.path)),
    encoded_route_filename_mappings: [...encodedByPath.values()].sort((a, b) => a.logical_path.localeCompare(b.logical_path)),
    indexing_gate: "All rendered HTML remains noindex, nofollow while migrated content is in review.",
    schema_policy: "JSON-LD and breadcrumbs are deferred because migration records and their source authorship/date relationships remain in review; content approval and fact-level confirmation must precede structured claims. The noindex gate alone does not prohibit structured data. Never publish volatile or unsupported business facts as schema.",
    social_image_policy: "Rendered Open Graph images are source-linked P08 media. Rights review remains pending for all 829 downloaded assets, so images remain part of the gated review build until rights clearance.",
    pages: [...byPath.values()].sort((a, b) => a.path.localeCompare(b.path))
  };
  await writeFile(manifestPath, YAML.stringify(manifest, { lineWidth: 110 }));
}
console.log(JSON.stringify({ report: reportPath, pages: pages.length, checks: summary.checks, manifest_written: reports.length === 2 }, null, 2));

function parseCsv(source) {
  const rows = [];
  let row = [];
  let value = "";
  let quoted = false;
  for (let index = 0; index < source.length; index += 1) {
    const character = source[index];
    if (quoted) {
      if (character === '"' && source[index + 1] === '"') { value += '"'; index += 1; }
      else if (character === '"') quoted = false;
      else value += character;
      continue;
    }
    if (character === '"' && value.length === 0) quoted = true;
    else if (character === ",") { row.push(value); value = ""; }
    else if (character === "\n" || character === "\r") {
      if (character === "\r" && source[index + 1] === "\n") index += 1;
      row.push(value); value = "";
      if (row.some((cell) => cell.length > 0)) rows.push(row);
      row = [];
    } else value += character;
  }
  if (value.length || row.length) { row.push(value); rows.push(row); }
  const [headers, ...data] = rows;
  return data.map((cells) => Object.fromEntries(headers.map((header, index) => [header, cells[index] ?? ""])));
}
