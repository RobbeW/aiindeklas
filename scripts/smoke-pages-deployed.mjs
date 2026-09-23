import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = fileURLToPath(new URL("../", import.meta.url));
const urlIndex = process.argv.indexOf("--url");
const rawUrl = urlIndex < 0 ? process.env.PAGES_URL : process.argv[urlIndex + 1];
if (!rawUrl) throw new Error("Usage: node scripts/smoke-pages-deployed.mjs --url <Pages URL>");
const base = new URL(rawUrl.endsWith("/") ? rawUrl : `${rawUrl}/`);
const projectBase = "/aiindeklas/";
if (!base.pathname.endsWith(projectBase)) throw new Error(`Expected Pages path ${projectBase}; received ${base.pathname}`);
const preserved = [
  ["knn/index.html", "knn/index.html"],
  ["aeneas/syllabus/NL_Syllabus_Epigrafie_Aenaes.pdf", "aeneas/syllabus/NL_Syllabus_Epigrafie_Aenaes.pdf"],
  ["computationeel_denken/Syllabus_Computationeel_Denken_PRINT.pdf", "computationeel_denken/Syllabus_Computationeel_Denken_PRINT.pdf"],
  ["deepfakes/Latijn/Werkbundel_AI_Klassieke_Talen_Breng_Tacitus_tot_Leven_2025_2026_v3.pdf", "deepfakes/Latijn/Werkbundel_AI_Klassieke_Talen_Breng_Tacitus_tot_Leven_2025_2026_v3.pdf"],
  ["sentimentsanalyse/new_lexicondict.pickle", "sentimentsanalyse/new_lexicondict.pickle"],
  ["supervised_learning/index.html", "supervised_learning/index.html"]
];
const failures = [];
const hasMeta = (html, name, includes) => {
  const tags = html.match(/<meta\b[^>]*>/gi) ?? [];
  return tags.some((tag) => new RegExp(`\\bname=["']${name}["']`, "i").test(tag) && new RegExp(`content=["'][^"']*${includes}[^"']*["']`, "i").test(tag));
};
const canonicalIncludes = (html, fragment) => {
  const tags = html.match(/<link\b[^>]*>/gi) ?? [];
  return tags.some((tag) => /\brel=["']canonical["']/i.test(tag) && new RegExp(`href=["'][^"']*${fragment.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}[^"']*["']`, "i").test(tag));
};
const fetchPath = async (path) => {
  const response = await fetch(new URL(path.replace(/^\//, ""), base), { redirect: "follow" });
  return { response, bytes: Buffer.from(await response.arrayBuffer()) };
};
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");

const homepage = await fetchPath("/");
if (!homepage.response.ok) failures.push(`website homepage HTTP ${homepage.response.status}`);
const homeHtml = homepage.bytes.toString("utf8");
if (!hasMeta(homeHtml, "robots", "noindex")) failures.push("website homepage lost noindex review gate");
if (!canonicalIncludes(homeHtml, projectBase)) failures.push("website canonical is missing the project prefix");

const checked = [];
for (const [deployedPath, sourcePath, hashSource] of preserved) {
  const { response, bytes } = await fetchPath(deployedPath);
  if (!response.ok) { failures.push(`preserved path ${deployedPath} returned HTTP ${response.status}`); continue; }
  const localBytes = await readFile(resolve(repoRoot, hashSource ?? sourcePath));
  if (sha256(bytes) !== sha256(localBytes)) failures.push(`preserved bytes differ at ${deployedPath}`);
  checked.push(deployedPath);
}
const unknown = await fetchPath("p14-path-that-must-not-exist-4f4b63");
if (unknown.response.status !== 404) failures.push(`unknown route HTTP ${unknown.response.status}, expected 404`);
for (const privatePath of ["admin", "admin/content.json"]) {
  const { response } = await fetchPath(privatePath);
  if (response.status !== 404) failures.push(`local authoring path ${privatePath} returned HTTP ${response.status}, expected 404`);
}
const report = {
  schema_version: "1.0.0",
  deployment_url: base.href,
  preserved_paths_checked: checked,
  noindex_review_gate_preserved: hasMeta(homeHtml, "robots", "noindex"),
  unknown_route_status: unknown.response.status,
  status: failures.length ? "failed" : "passed",
  failures
};
console.log(JSON.stringify(report, null, 2));
if (failures.length) process.exitCode = 1;
