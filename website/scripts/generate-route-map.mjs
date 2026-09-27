import { readFile, writeFile } from "node:fs/promises";

const manifestUrl = new URL("../migration/source-manifest.json", import.meta.url);
const outputUrl = new URL("../migration/route-map.csv", import.meta.url);
const manifest = JSON.parse(await readFile(manifestUrl, "utf8"));

const csvCell = (value) => {
  const text = value === null || value === undefined ? "" : String(value);
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
};

const localeForPath = (pathname) =>
  pathname === "/english" ||
  pathname === "/about" ||
  pathname === "/contactinfo" ||
  pathname === "/projects" ||
  pathname === "/education" ||
  pathname.startsWith("/education/")
    ? "en"
    : "nl-BE";

const routeAction = (record) => {
  const source = new URL(record.url);

  // These two unavailable snapshots were approved as derivable target routes at H1.
  if (record.classification === "tag_archive") {
    return { action: "derive_tag_archive_at_exact_path", target: source.pathname };
  }
  if (source.pathname === "/english") {
    return { action: "redirect_stub", target: "/about", decisionGate: "H2" };
  }
  if (record.disposition === "redirect") {
    return { action: "redirect_stub", target: record.target_path };
  }
  if (record.disposition === "excluded_noncanonical") {
    return { action: "exclude_noncanonical_query", target: "" };
  }
  if (record.disposition?.startsWith("excluded_")) {
    return { action: "exclude_hard_route", target: "" };
  }

  if (source.search) {
    if (source.searchParams.get("format") === "rss") {
      return {
        action: "replace_with_locale_feed",
        target: source.pathname === "/education" ? "/education/rss.xml" : "/onderwijs/rss.xml"
      };
    }
    return { action: "map_legacy_query_to_canonical_pagination", target: source.pathname };
  }

  if (record.classification === "sitemap") return { action: "replace_with_generated_system_output", target: "/sitemap.xml" };
  if (record.classification === "robots") return { action: "replace_with_generated_system_output", target: "/robots.txt" };
  return { action: "preserve_exact_path", target: source.pathname };
};

const semanticClassification = (record) => {
  const pathname = new URL(record.url).pathname;
  return pathname.includes("/category/") ? "tag_archive" : record.classification;
};

const collisionGroups = new Map();
for (const record of manifest.pages.filter((record) => semanticClassification(record) === "tag_archive")) {
  const pathname = new URL(record.url).pathname;
  const folded = pathname.toLocaleLowerCase("en-US");
  const group = collisionGroups.get(folded) ?? [];
  group.push(pathname);
  collisionGroups.set(folded, group);
}

const collisionIds = new Map();
let collisionNumber = 0;
for (const [, paths] of [...collisionGroups.entries()].sort(([a], [b]) => a.localeCompare(b))) {
  if (new Set(paths).size < 2) continue;
  collisionNumber += 1;
  const id = `tag-case-${String(collisionNumber).padStart(2, "0")}`;
  for (const pathname of paths) collisionIds.set(pathname, id);
}

const rows = manifest.pages.map((record) => {
  const source = new URL(record.url);
  const effectiveRecord = { ...record, classification: semanticClassification(record) };
  const { action, target, decisionGate } = routeAction(effectiveRecord);
  const isSitemapContent =
    action === "preserve_exact_path" && !["/404", "/over"].includes(source.pathname) ||
    action === "derive_tag_archive_at_exact_path";
  return {
    source_url: record.url,
    final_url: record.final_url || "",
    source_path: source.pathname,
    source_query: source.search.slice(1),
    classification: effectiveRecord.classification,
    crawl_status: record.crawl_status,
    http_status: record.http_status,
    decision_gate: decisionGate ?? record.decision_gate,
    disposition: record.disposition,
    target_action: action,
    target_path: target,
    canonical_path: source.pathname === "/over" ? "/" : target,
    locale: localeForPath(source.pathname),
    include_in_sitemap: isSitemapContent,
    case_collision_id: collisionIds.get(source.pathname) ?? ""
  };
});

const columns = [
  "source_url", "final_url", "source_path", "source_query", "classification", "locale",
  "crawl_status", "http_status", "decision_gate", "disposition", "target_action",
  "target_path", "canonical_path", "include_in_sitemap", "case_collision_id"
];

const allowedActions = new Set([
  "preserve_exact_path",
  "derive_tag_archive_at_exact_path",
  "redirect_stub",
  "map_legacy_query_to_canonical_pagination",
  "replace_with_locale_feed",
  "replace_with_generated_system_output",
  "exclude_hard_route",
  "exclude_noncanonical_query"
]);
if (rows.length !== 429 || new Set(rows.map(({ source_url }) => source_url)).size !== 429) {
  throw new Error(`Expected exactly 429 unique page records, received ${rows.length}`);
}
for (const row of rows) {
  if (!allowedActions.has(row.target_action)) throw new Error(`Unrecognised target action for ${row.source_url}`);
}
const overAlias = rows.find(({ source_path }) => source_path === "/over");
if (!overAlias || overAlias.target_action !== "preserve_exact_path" || overAlias.canonical_path !== "/" || overAlias.include_in_sitemap) {
  throw new Error("The /over home alias must be preserved, canonicalise to /, and stay out of the sitemap");
}

const output = [columns.join(",")];
for (const row of rows.sort((a, b) => a.source_url.localeCompare(b.source_url))) {
  output.push(columns.map((column) => csvCell(row[column])).join(","));
}
await writeFile(outputUrl, `${output.join("\n")}\n`);

const actionCounts = Object.fromEntries(
  Object.entries(Object.groupBy(rows, (row) => row.target_action)).map(([action, group]) => [action, group.length])
);
const expectedActionCounts = {
  preserve_exact_path: 136,
  derive_tag_archive_at_exact_path: 243,
  redirect_stub: 2,
  map_legacy_query_to_canonical_pagination: 31,
  replace_with_locale_feed: 2,
  replace_with_generated_system_output: 2,
  exclude_hard_route: 12,
  exclude_noncanonical_query: 1
};
if (Object.entries(expectedActionCounts).some(([action, count]) => actionCounts[action] !== count)) {
  throw new Error(`Route action totals changed: ${JSON.stringify(actionCounts)}`);
}

console.log(JSON.stringify({
  rows: rows.length,
  action_counts: actionCounts,
  case_insensitive_tag_collision_groups: collisionNumber
}, null, 2));
