import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import {
  excludedRouteReasons,
  normalizeRoute,
  parseCsv,
  productionRouteContract,
  productionSitemapPaths,
  routeKey,
  shouldIndexPath
} from "../../src/lib/route-policy.ts";
import { canonicalTaxonomyRoutes } from "../../src/lib/taxonomy-routes.mjs";
import { logicalRouteFromHtmlLabel, setDifferences } from "../../scripts/validate-built-site.mjs";

test("CSV parsing preserves quoted commas, quotes and line breaks", () => {
  const rows = parseCsv('name,note\r\nalpha,"one, two"\r\nbeta,"line 1\nline ""2"""\r\n');
  assert.deepEqual(rows, [
    { name: "alpha", note: "one, two" },
    { name: "beta", note: 'line 1\nline "2"' }
  ]);
});

test("production route policy is exact and fail closed", () => {
  const contract = productionRouteContract();
  const sitemap = productionSitemapPaths();
  assert.equal(contract.length, 361);
  assert.equal(sitemap.length, 356);
  assert.equal(Object.keys(excludedRouteReasons).length, 10);
  assert.equal(new Set(contract.map(routeKey)).size, 361);
  assert.equal(shouldIndexPath("/onderwijs/archief", true), true);
  assert.equal(shouldIndexPath("/boek", true), false);
  assert.equal(shouldIndexPath("/unknown-output", true), false);
  assert.equal(shouldIndexPath("/onderwijs/archief", false), false);
  assert.equal(excludedRouteReasons["/over"], "legacy home alias canonical /");
  assert.match(excludedRouteReasons["/onderwijs/workshops-en-nascholingen"], /pricing and claim verification/);
});

test("taxonomy case aliases resolve to the production contract's canonical spelling", () => {
  const taxonomyRoutes = JSON.parse(readFileSync(resolve(import.meta.dirname, "../../src/data/taxonomy-routes.json"), "utf8"));
  const canonicalRoutes = canonicalTaxonomyRoutes(taxonomyRoutes);
  const canonicalPaths = new Set(canonicalRoutes.map(({ path }) => path));
  const contractPaths = new Set(productionRouteContract());
  const routeCounts = new Map();
  for (const { path } of taxonomyRoutes) routeCounts.set(routeKey(path), (routeCounts.get(routeKey(path)) ?? 0) + 1);

  assert.equal(taxonomyRoutes.length - canonicalRoutes.length, 17);
  assert.equal(new Set(canonicalRoutes.map(({ path }) => routeKey(path))).size, canonicalRoutes.length);
  assert.equal(canonicalPaths.has("/education/tag/AI"), true);
  assert.equal(canonicalPaths.has("/education/tag/ai"), false);
  assert.equal(canonicalPaths.has("/onderwijs/tag/VR"), true);
  assert.equal(canonicalPaths.has("/onderwijs/tag/vr"), false);
  for (const { path } of canonicalRoutes.filter(({ path }) => routeCounts.get(routeKey(path)) > 1)) {
    assert.equal(contractPaths.has(normalizeRoute(path)), true, `${path} does not match the production contract's canonical spelling`);
  }
});

test("HTML output labels map to logical routes", () => {
  assert.equal(logicalRouteFromHtmlLabel("index.html"), "/");
  assert.equal(logicalRouteFromHtmlLabel("onderwijs/archief.html"), "/onderwijs/archief");
  assert.equal(logicalRouteFromHtmlLabel("onderwijs/tag/artificiële+intelligentie.html"), "/onderwijs/tag/artificiële+intelligentie");
  assert.equal(logicalRouteFromHtmlLabel("onderwijs/tag/%23VlaanderenLeest.html"), "/onderwijs/tag/%23VlaanderenLeest");
});

test("set parity reports missing and extra values", () => {
  assert.deepEqual(setDifferences(new Set(["a", "b"]), new Set(["b", "c"])), {
    missing: ["a"],
    extra: ["c"]
  });
});
