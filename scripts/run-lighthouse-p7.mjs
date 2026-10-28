import { createReadStream } from "node:fs";
import { access, mkdir, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import { dirname, extname, join, normalize, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import lighthouse from "lighthouse";
import { launch } from "chrome-launcher";

const ROOT = fileURLToPath(new URL("../", import.meta.url));
const REPORT = resolve(ROOT, "migration/reports/P7-lighthouse.json");
const DIST = resolve(ROOT, "dist");
const chromePath = process.env.CHROME_PATH ?? "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const routes = ["/", "/onderwijs", "/onderwijs/ai-geletterdheid-waarom-moeten-wij-dit-kennen"];
const thresholds = { performance: 0.9, accessibility: 0.95, "best-practices": 0.95, seo: 0.95 };
const mimeTypes = new Map([
  [".css", "text/css; charset=utf-8"], [".html", "text/html; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"], [".json", "application/json; charset=utf-8"],
  [".png", "image/png"], [".svg", "image/svg+xml"], [".webp", "image/webp"],
  [".xml", "application/xml; charset=utf-8"], [".txt", "text/plain; charset=utf-8"]
]);
const canAccess = async (target) => { try { await access(target); return true; } catch { return false; } };
const server = createServer(async (request, response) => {
  const pathname = decodeURI(new URL(request.url ?? "/", "http://localhost").pathname);
  let relativePath = pathname.replace(/^\/+/, "");
  if (!relativePath || pathname.endsWith("/")) relativePath += "index.html";
  else if (!extname(relativePath)) relativePath += ".html";
  const target = normalize(join(DIST, relativePath));
  if (!target.startsWith(DIST) || !await canAccess(target)) {
    response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    response.end("Not found");
    return;
  }
  response.writeHead(200, { "Content-Type": mimeTypes.get(extname(target)) ?? "application/octet-stream" });
  createReadStream(target).pipe(response);
});
await new Promise((resolveListen) => server.listen(0, "127.0.0.1", resolveListen));
const address = server.address();
if (!address || typeof address === "string") throw new Error("Unable to start the P7 preview server");
const origin = `http://127.0.0.1:${address.port}`;
const chrome = await launch({
  chromePath,
  chromeFlags: ["--headless=new", "--disable-gpu", "--no-first-run", "--no-default-browser-check"]
});

const results = [];
const errors = [];
try {
  for (const route of routes) {
    const url = new URL(route, origin).href;
    const run = await lighthouse(url, {
      port: chrome.port,
      output: "json",
      logLevel: "error",
      onlyCategories: Object.keys(thresholds),
      skipAudits: ["is-crawlable"],
      formFactor: "mobile",
      screenEmulation: { mobile: true, width: 390, height: 844, deviceScaleFactor: 2, disabled: false }
    });
    if (!run) throw new Error(`Lighthouse returned no result for ${url}`);
    const scores = Object.fromEntries(Object.keys(thresholds).map((category) => [category, run.lhr.categories[category].score]));
    const failingAudits = Object.values(run.lhr.audits)
      .filter((audit) => audit.score !== null && audit.score < 1 && audit.scoreDisplayMode !== "notApplicable")
      .map((audit) => ({
        id: audit.id,
        title: audit.title,
        score: audit.score,
        details: Array.isArray(audit.details?.items)
          ? audit.details.items.slice(0, 10).map((item) => ({
            node: item.node ? {
              selector: item.node.selector,
              snippet: item.node.snippet,
              label: item.node.nodeLabel,
              explanation: item.node.explanation
            } : undefined,
            source: item.source,
            description: item.description
          }))
          : []
      }))
      .slice(0, 30);
    for (const [category, threshold] of Object.entries(thresholds)) {
      if ((scores[category] ?? 0) < threshold) errors.push(`${route}: ${category} score ${scores[category]} is below ${threshold}`);
    }
    results.push({ route, url, scores, failing_audits: failingAudits });
  }
} finally {
  await new Promise((resolveClose) => server.close(resolveClose));
}

const report = {
  schema_version: "1.0.0",
  generated_at: new Date().toISOString(),
  form_factor: "mobile",
  thresholds,
  results,
  errors,
  status: errors.length ? "failed" : "passed"
};
await mkdir(dirname(REPORT), { recursive: true });
await writeFile(REPORT, `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report, null, 2));
try {
  chrome.kill();
} catch (error) {
  // Chrome is already terminated when this Windows-only temp-profile cleanup
  // race occurs. The completed audit report remains valid and is written first.
  console.warn(`Lighthouse Chrome cleanup warning: ${error.message}`);
}
if (errors.length) process.exitCode = 1;
