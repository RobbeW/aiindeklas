import { mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const basePath = "/aiindeklas/";
const args = process.argv.slice(2);
const argValue = (name) => { const index = args.indexOf(name); return index < 0 ? null : args[index + 1] ?? null; };
const localDir = argValue("--local");
const deployedUrl = argValue("--url");
if (Boolean(localDir) === Boolean(deployedUrl)) throw new Error("Usage: pnpm p14:smoke -- --local dist | --url https://<owner>.github.io/aiindeklas/");

const taxonomyRoutes = JSON.parse(await readFile(resolve(root, "src/data/taxonomy-routes.json"), "utf8"));
const routeGroups = new Map();
for (const { path } of taxonomyRoutes) {
  const key = path.toLocaleLowerCase("en-US");
  const routes = routeGroups.get(key) ?? new Set();
  routes.add(path);
  routeGroups.set(key, routes);
}
const collisions = [...routeGroups.values()]
  .filter((routes) => routes.size > 1)
  .map((routes) => [...routes].sort((a, b) => a.localeCompare(b)));
const collisionPairs = collisions.map(([path, counterpart_path]) => ({ path, counterpart_path }));
if (collisionPairs.length !== 17) throw new Error(`Expected 17 reviewed case-collision pairs; found ${collisionPairs.length}`);
const requiredPaths = ["/", "/onderwijs", "/education", "/contactinfo", "/robots.txt", "/sitemap.xml"];
const attribute = (tag, name) => tag.match(new RegExp(`\\b${name}=["']([^"']+)["']`, "i"))?.[1] ?? null;
const assetPath = (html) => (html.match(/<(?:link|script)\b[^>]*>/gi) ?? []).flatMap((tag) => {
  if (/^<script\b/i.test(tag)) return [attribute(tag, "src")];
  const rel = attribute(tag, "rel")?.toLowerCase() ?? "";
  return /(?:stylesheet|icon)/.test(rel) ? [attribute(tag, "href")] : [];
}).filter((value) => value?.startsWith(basePath));

const deployedFailures = [];
let checkedRoutes = 0;
let checkedAssets = 0;
let caseSensitiveVerification = Boolean(deployedUrl) || process.platform !== "win32";
if (localDir) {
  const output = resolve(root, localDir);
  const routeFile = (path) => path === "/" ? join(output, "index.html") : /\.[a-z0-9]+$/i.test(path) ? join(output, path.slice(1)) : join(output, `${path.slice(1)}.html`);
  const readRoute = async (path) => { try { return await readFile(routeFile(path), "utf8"); } catch { return null; } };
  for (const path of requiredPaths) {
    const file = routeFile(path);
    try { await stat(file); checkedRoutes++; } catch { deployedFailures.push(`missing local route output for ${path}`); }
  }
  const index = await readRoute("/");
  if (index) {
    if (!/<meta\b(?=[^>]*\bname=["']robots["'])(?=[^>]*\bcontent=["'][^"']*noindex)/i.test(index)) deployedFailures.push("preview homepage does not retain noindex");
    if (!/<link\b(?=[^>]*\brel=["']canonical["'])(?=[^>]*\bhref=["'][^"']*\/aiindeklas\/)/i.test(index)) deployedFailures.push("project canonical is missing /aiindeklas/ prefix");
    for (const asset of assetPath(index)) {
      const pathname = new URL(asset, "https://local.invalid").pathname;
      try { await stat(join(output, pathname.slice(basePath.length))); checkedAssets++; } catch { deployedFailures.push(`missing local asset ${asset}`); }
    }
  }
  for (const { path, counterpart_path: counterpart } of collisionPairs) {
    // Verify both spellings independently on a case-sensitive runner; Windows collapses case-only names.
    for (const candidate of [path, counterpart]) {
      if (!await readRoute(candidate)) deployedFailures.push(`case-sensitive route output missing: ${candidate}`);
      else checkedRoutes++;
    }
  }
  if (!await readRoute("/404")) deployedFailures.push("missing rendered 404 page");
  const nojekyll = join(output, ".nojekyll");
  try { await stat(nojekyll); } catch { deployedFailures.push("missing .nojekyll in Pages artifact"); }
} else {
  const base = new URL(deployedUrl);
  if (!base.pathname.endsWith("/")) base.pathname += "/";
  if (!base.pathname.endsWith(basePath)) throw new Error(`Expected project Pages prefix ${basePath}; got ${base.pathname}`);
  const get = async (pathname) => {
    const url = pathname.startsWith(basePath)
      ? new URL(pathname, base.origin)
      : new URL(pathname.replace(/^\/+/, ""), base);
    const response = await fetch(url, { redirect: "follow" });
    return { response, body: await response.text(), url };
  };
  for (const path of requiredPaths) {
    const { response, body } = await get(path);
    checkedRoutes++;
    if (!response.ok) deployedFailures.push(`${path} returned HTTP ${response.status}`);
    if (path === "/" && !/<meta\b(?=[^>]*\bname=["']robots["'])(?=[^>]*\bcontent=["'][^"']*noindex)/i.test(body)) deployedFailures.push("deployed preview homepage does not retain noindex");
  }
  const { body: homepage } = await get("/");
  for (const asset of assetPath(homepage)) {
    const { response } = await get(asset);
    checkedAssets++;
    if (!response.ok) deployedFailures.push(`${asset} returned HTTP ${response.status}`);
  }
  for (const { path, counterpart_path: counterpart } of collisionPairs) {
    for (const candidate of [path, counterpart]) {
      const { response } = await get(candidate);
      checkedRoutes++;
      if (!response.ok) deployedFailures.push(`${candidate} returned HTTP ${response.status}`);
    }
  }
  const notFound = await get("/p14-smoke-route-that-must-not-exist-2d2971");
  if (notFound.response.status !== 404) deployedFailures.push(`unknown route returned HTTP ${notFound.response.status}, expected 404`);
}

const report = {
  schema_version: "1.0.0",
  profile: "github-pages-project",
  deployment_url: deployedUrl ?? null,
  base: basePath,
  smoke_kind: deployedUrl ? "deployed_http" : "local_artifact",
  checked_routes: checkedRoutes,
  checked_assets: checkedAssets,
  case_collision_pairs: collisionPairs.length,
  unresolved_case_collision_pairs: collisionPairs.map(({ path, counterpart_path }) => [path, counterpart_path]),
  case_sensitive_route_verification: caseSensitiveVerification,
  noindex_review_gate_preserved: true,
  status: deployedFailures.length ? "failed" : "passed",
  failures: deployedFailures
};
const reportPath = resolve(root, `migration/reports/P14-pages-smoke${deployedUrl ? "-deployed" : ""}.json`);
await mkdir(dirname(reportPath), { recursive: true });
await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report, null, 2));
if (deployedFailures.length) process.exitCode = 1;
