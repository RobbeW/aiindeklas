import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { load } from "cheerio";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PROJECT = path.resolve(ROOT, "..");
const source = JSON.parse(await fs.readFile(path.join(ROOT, "migration/source-manifest.json"), "utf8"));
const routeOf = (record) => {
  try { return new URL(record.url).pathname; } catch { return record.url; }
};
const resources = new Map();
const blocks = new Map();
const providers = new Map();
const routesWithEmbedly = new Set();
const routesWithSquarespaceRuntime = new Set();
const formRoutes = new Set();
const newsletterRoutes = new Set();
const nativeVideoRoutes = new Set();
const audioRoutes = new Set();
let iframeTags = 0;
let mediaTags = 0;
let audioElements = 0;
let htmlRecordsScanned = 0;

function bump(map, key, route) {
  const value = map.get(key) ?? { instances: 0, routes: new Set() };
  value.instances += 1;
  value.routes.add(route);
  map.set(key, value);
}

for (const record of source.pages) {
  if (!record.raw_path?.endsWith(".html")) continue;
  const rawPath = path.resolve(ROOT, record.raw_path);
  let raw;
  try { raw = await fs.readFile(rawPath, "utf8"); } catch { continue; }
  const $ = load(raw);
  const route = routeOf(record);
  htmlRecordsScanned += 1;

  $("script[src]").each((_, element) => {
    const url = $(element).attr("src");
    if (!url || !/squarespace|sqspcdn|embedly/i.test(url)) return;
    bump(resources, url, route);
    routesWithSquarespaceRuntime.add(route);
  });

  $(".sqs-block").each((_, element) => {
    const classes = $(element).attr("class") ?? "";
    const typedClasses = classes.split(/\s+/).filter((name) => /^sqs-block-(?:website-component|html|image|button|horizontalrule|video|spacer|form|socialaccountlinks|gallery|audio|accordion|quote|code|summary-v2|embed|map|calendar|newsletter)$/.test(name));
    const typedClass = typedClasses.find((name) => name !== "sqs-block-website-component") ?? typedClasses[0];
    if (!typedClass) return;
    const kind = typedClass.replace(/^sqs-block-/, "").toLowerCase();
    bump(blocks, kind, route);
    if (kind === "form") formRoutes.add(route);
    if (/newsletter|signup/.test(kind)) newsletterRoutes.add(route);
    if (kind === "audio") audioRoutes.add(route);
  });

  $("iframe,object,embed").each(() => { iframeTags += 1; });
  $("video,audio").each(() => { mediaTags += 1; });
  audioElements += $("audio").length;
  if (/embedly-embed|cdn\.embedly\.com/i.test(raw)) routesWithEmbedly.add(route);
  if (/sqs-native-video\s*\[?data-config-video|class=["'][^"']*sqs-native-video/i.test(raw)) nativeVideoRoutes.add(route);

  $(".sqs-video-wrapper").each((_, element) => {
    const html = $(element).attr("data-html") ?? "";
    const embedded = load(html);
    const src = embedded("iframe").attr("src") ?? "";
    let host = "unknown provider";
    try {
      const wrapperUrl = new URL(src.startsWith("//") ? `https:${src}` : src);
      const nestedSource = wrapperUrl.searchParams.get("src");
      host = nestedSource ? new URL(nestedSource).hostname : wrapperUrl.hostname;
    } catch {}
    const provider = $(element).attr("data-provider-name")?.trim() || (host === "www.youtube.com" ? "YouTube (unlabelled wrapper)" : "unknown provider");
    bump(providers, `${provider} (${host})`, route);
    routesWithEmbedly.add(route);
  });
}

const p08 = JSON.parse(await fs.readFile(path.join(PROJECT, "docs/implementation/manifests/native-video-deferrals.json"), "utf8"));
const migratedProviderRecords = [];
const contentRoot = path.join(ROOT, "src/content");
const walkContent = async (directory) => {
  for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) await walkContent(entryPath);
    else if (/\.(?:md|mdx)$/.test(entry.name)) {
      const markdown = await fs.readFile(entryPath, "utf8");
      const body = markdown.match(/^---\s*\r?\n[\s\S]*?\r?\n---\s*\r?\n([\s\S]*)$/)?.[1] ?? markdown;
      const links = [...body.matchAll(/\[([^\]]+)\]\((https?:\/\/[^)\s]*(?:youtube\.com|youtu\.be|vimeo\.com)[^)]*)\)/gi)]
        .map((match) => ({ label: match[1].trim(), destination: match[2] }));
      if (links.length) migratedProviderRecords.push({
        file: path.relative(ROOT, entryPath),
        source_url: markdown.match(/^source_url:\s*["']?([^"'\r\n]+)["']?\s*$/m)?.[1] ?? null,
        provider_links: links
      });
    }
  }
};
await walkContent(contentRoot);
const asList = (map) => [...map].map(([name, value]) => ({
  name,
  instances: value.instances,
  routes: [...value.routes].sort()
})).sort((a, b) => a.name.localeCompare(b.name));
const manifest = {
  schema: "website-migration.p09-dependencies/v1",
  generated_from: {
    snapshot_manifest: "legacy_migration/migration/source-manifest.json",
    route_records: source.summary.page_records,
    reconciliation: {
      route_records: source.pages.length,
      snapshotted: source.pages.filter((page) => page.crawl_status === "snapshotted").length,
      snapshotted_html: source.pages.filter((page) => page.crawl_status === "snapshotted" && page.raw_path?.endsWith(".html")).length,
      snapshotted_non_html: source.pages.filter((page) => page.crawl_status === "snapshotted" && page.raw_path && !page.raw_path.endsWith(".html")).length,
      http_error_html_snapshots: source.pages.filter((page) => page.crawl_status === "http_error" && page.raw_path?.endsWith(".html")).length,
      fetch_errors_without_snapshot: source.pages.filter((page) => page.crawl_status === "fetch_error" && !page.raw_path).length,
      all_preserved_html_scanned: source.pages.filter((page) => page.raw_path?.endsWith(".html")).length
    }
  },
  source_facts: {
    snapshots_scanned: htmlRecordsScanned,
    forms_and_newsletters: {
      form_block_instances: blocks.get("form")?.instances ?? 0,
      routes: [...formRoutes].sort(),
      form_evidence: [
        { source_route: "/contact", purpose: "Receive questions about teaching projects and workshops.", source_block: "Squarespace website.components.form", source_fields: ["Voornaam", "Achternaam", "Jouw e-mailadres", "Jouw vraag ..."], config_summary: "required name and email fields plus a question textarea; no submission target or credential copied" },
        { source_route: "/contactinfo", purpose: "Receive collaboration and project enquiries.", source_block: "Squarespace website.components.form", source_fields: ["Name", "E-mail", "Message"], config_summary: "name, required email, and message fields; no submission target or credential copied" }
      ],
      newsletter_block_instances: [...blocks].filter(([name]) => /newsletter|signup/.test(name)).reduce((sum, [, value]) => sum + value.instances, 0),
      newsletter_routes: [...newsletterRoutes].sort()
    },
    squarespace_runtime: {
      distinct_external_script_urls: resources.size,
      script_route_occurrences: [...resources.values()].reduce((sum, value) => sum + value.instances, 0),
      routes: [...routesWithSquarespaceRuntime].sort(),
      resources: asList(resources)
    },
    squarespace_blocks: asList(blocks),
    squarespace_block_inventory_scope: "Complete counts of typed Squarespace block containers in preserved HTML, including static content block types. Counts are source route occurrences, so duplicate locale routes and paginated/archive snapshots are represented as seen; they are not unique migrated content records.",
    external_video_embeds: {
      embedly_wrapper_routes: [...routesWithEmbedly].sort(),
      embedly_wrapper_instances: [...providers.values()].reduce((sum, value) => sum + value.instances, 0),
      providers: asList(providers),
      raw_iframe_object_embed_tags: iframeTags
    },
    native_video: {
      source_routes: [...nativeVideoRoutes].sort(),
      p08_deferred_candidate_count: p08.items.length,
      p08_deferred_ids: p08.items.map((item) => item.id)
    },
    audio: { source_routes: [...audioRoutes].sort(), audio_block_instances: blocks.get("audio")?.instances ?? 0, source_audio_element_instances: audioElements, migrated_rendering: "local direct media-file links; no browser-native audio element" },
    custom_code: { source_block_instances: blocks.get("code")?.instances ?? 0, source_routes: [...(blocks.get("code")?.routes ?? [])], migrated_rendering: "static Markdown/code content in the migrated article bodies" },
    block_inventory_scope: "Only Squarespace block containers with the actual .sqs-block class and a sqs-block-{type} class are counted. CSS helper classes and their children are excluded.",
    other_features: {
      social_account_blocks: { instances: blocks.get("socialaccountlinks")?.instances ?? 0, routes: [...(blocks.get("socialaccountlinks")?.routes ?? [])], disposition: "retained as static/native" },
      newsletter_map_calendar_blocks: { instances: [...blocks].filter(([name]) => /newsletter|map|calendar/.test(name)).reduce((sum, [, value]) => sum + value.instances, 0), disposition: "not present/no action" }
    }
  },
  migration_observations: {
    direct_provider_links_in_migrated_records: migratedProviderRecords.reduce((sum, record) => sum + record.provider_links.length, 0),
    records_with_direct_provider_links: migratedProviderRecords,
    automatic_embed_wrappers_in_migrated_markdown: 0
  },
  decisions: [
    { feature: "Contact form blocks", source_evidence: "Squarespace form blocks on /contact and /contactinfo; source field labels and purposes are recorded above. The captured pages contain no native form tag, but have form component config and visitor scripts.", disposition: "replaced", decision: "Client-side form opens a prefilled mailto draft to the approved recipient without publishing the address as visible page content. The preserved /contact-english redirect alias points to the form. No hosted processor or submission backend.", authority: "legacy_migration/docs/adr/ADR-003-contact-form-replacement.md" },
    { feature: "Squarespace runtime scripts and block visitors", source_evidence: "External Squarespace scripts and component visitor scripts are listed above with source route occurrences.", disposition: "removed", decision: "Static Astro components replace the runtime; no Squarespace runtime scripts are shipped.", authority: "docs/implementation/decisions/ADR-P03-static-architecture.md" },
    { feature: "Embedly and provider video wrappers", source_evidence: "Encoded provider iframes and Embedly wrappers listed above; migrated direct-provider links are listed separately with their source record, label, and URL.", disposition: "removed", decision: "No Embedly wrappers, keys, iframe tags, or automatic provider scripts. Direct links disclose the known provider; unknown providers remain links.", authority: "legacy_migration/docs/adr/ADR-010-external-embeds.md" },
    { feature: "Native video assets awaiting source recovery", source_evidence: "18 candidates are recorded in the accepted P08 deferral manifest; detected native-video source routes are listed above. The wider Squarespace video block count is reported separately.", disposition: "deferred", decision: "P08-owned deferrals are referenced without changing their media decisions.", authority: "docs/implementation/manifests/native-video-deferrals.json" },
    { feature: "Audio blocks", source_evidence: "Squarespace audio blocks and source URLs occur on the routes listed above; P08 media ledger tracks local asset copies.", disposition: "retained as static/native", decision: "Local audio files are retained as labelled direct links; no remote player script or audio widget is loaded.", authority: "docs/implementation/manifests/assets-p08.json" },
    { feature: "Custom code blocks", source_evidence: "Two code blocks contain instructional content on the two source routes listed above.", disposition: "retained as static/native", decision: "Content is emitted as static Markdown/code; it has no execution or external runtime dependency.", authority: "legacy_migration/docs/adr/ADR-010-external-embeds.md" },
    { feature: "Newsletter, map, and calendar widgets", source_evidence: "No matching source blocks were found in the preserved HTML snapshots.", disposition: "not present/no action", decision: "No replacement required.", authority: "legacy_migration/migration/source-manifest.json" },
    { feature: "Social account links", source_evidence: "Social account link blocks occur on /contact and /contactinfo.", disposition: "retained as static/native", decision: "Provider destinations remain labelled direct links; no social widget script is used.", authority: "legacy_migration/docs/adr/ADR-010-external-embeds.md" }
  ]
};

const target = path.join(PROJECT, "docs/implementation/manifests/p09-dynamic-dependencies.json");
await fs.mkdir(path.dirname(target), { recursive: true });
await fs.writeFile(target, `${JSON.stringify(manifest, null, 2)}\n`);
console.log(JSON.stringify({ target: path.relative(PROJECT, target), htmlSnapshots: manifest.source_facts.snapshots_scanned, formRoutes: formRoutes.size, embedlyWrapperInstances: manifest.source_facts.external_video_embeds.embedly_wrapper_instances, embedlyRoutes: routesWithEmbedly.size, migratedProviderLinks: manifest.migration_observations.direct_provider_links_in_migrated_records, runtimeScriptUrls: resources.size, runtimeRoutes: routesWithSquarespaceRuntime.size, nativeVideoRoutes: nativeVideoRoutes.size, p08Deferrals: p08.items.length }, null, 2));
