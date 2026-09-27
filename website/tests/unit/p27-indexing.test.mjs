import assert from "node:assert/strict";
import test from "node:test";
import {
  excludedRouteReasons,
  parseCsv,
  productionRouteContract,
  productionSitemapPaths,
  routeKey,
  shouldIndexPath
} from "../../src/lib/route-policy.ts";
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
