import { spawn } from "node:child_process";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { validateBuiltSite } from "./validate-built-site.mjs";

const workspace = fileURLToPath(new URL("../", import.meta.url));
const astroCli = resolve(workspace, "node_modules/astro/bin/astro.mjs");
const profile = process.argv[2];
if (!new Set(["root", "project", "production-sim"]).has(profile)) {
  throw new Error("Usage: node scripts/build-profile.mjs <root|project|production-sim>");
}

const config = profile === "project"
  ? { base: "/aiindeklas/", site: "https://robbew.github.io", indexing: false }
  : profile === "production-sim"
    ? { base: "/", site: "https://www.robbewulgaert.be", indexing: true }
    : { base: "/", site: "http://localhost:4321", indexing: false };

const exitCode = await new Promise((resolveExit, reject) => {
  const child = spawn(process.execPath, [astroCli, "build"], {
    cwd: workspace,
    stdio: "inherit",
    env: {
      ...process.env,
      ASTRO_TELEMETRY_DISABLED: "1",
      PUBLIC_BASE_PATH: config.base,
      SITE_URL: config.site,
      PUBLIC_INDEXING_ENABLED: String(config.indexing)
    }
  });
  child.on("error", reject);
  child.on("exit", (code) => resolveExit(code ?? 1));
});

if (exitCode !== 0) process.exit(exitCode);

const reportPath = resolve(workspace, `migration/reports/build-${profile}.json`);
const report = await validateBuiltSite({
  outputDirectory: resolve(workspace, "dist"),
  profile,
  base: config.base,
  site: config.site,
  expectIndexing: config.indexing,
  reportPath
});
console.log(JSON.stringify(report, null, 2));
