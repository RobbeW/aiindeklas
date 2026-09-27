import { execFile } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
const run = promisify(execFile);
const root = fileURLToPath(new URL("../", import.meta.url));
export const pnpm = process.platform === "win32" ? "pnpm.cmd" : "pnpm";
const phase = (name, commands) => ({ name, commands });
export const phases = [
  phase("static", [["article-integrity","node",["scripts/validate-articles.mjs"]],["content",pnpm,["validate:content"]],["cms",pnpm,["validate:cms"]],["catalogue","node",["scripts/validate-p21-catalogue.mjs"]],["p09","node",["scripts/validate-p09.mjs"]],["p26",pnpm,["p26:validate"]],["unit",pnpm,["test"]],["check",pnpm,["check"]]]),
  phase("root-preview", [["build-root",pnpm,["build:root"]],["built-root","node",["scripts/validate-built-site.mjs","root"]],["articles-root","node",["scripts/validate-articles.mjs","--built"]],["links-root","node",["scripts/validate-p26-links.mjs","--built"]],["p09-built-root","node",["scripts/validate-p09.mjs","--built=dist"]],["responsive-root","node",["scripts/validate-responsive.mjs"]],["accessibility-root","node",["scripts/validate-accessibility.mjs"]],["p23-browser-root","node",["scripts/p23-browser-smoke.mjs","/","preview"]],["p24-browser-root","node",["scripts/p24-browser-smoke.mjs","/"]],["p25-browser-root","node",["scripts/p25-browser-smoke.mjs","/"]]]),
  phase("project-preview", [["build-project",pnpm,["build:project"]],["built-project","node",["scripts/validate-built-site.mjs","project"]],["articles-project","node",["scripts/validate-articles.mjs","--built","--base","/aiindeklas/"]],["links-project","node",["scripts/validate-p26-links.mjs","--built"]],["p09-built-project","node",["scripts/validate-p09.mjs","--built=dist","--base=/aiindeklas/"]],["responsive-project","node",["scripts/validate-responsive.mjs","--project"]],["accessibility-project","node",["scripts/validate-accessibility.mjs","--project"]],["p22-browser-project","node",["scripts/p22-browser-smoke.mjs","/aiindeklas/"]],["p23-browser-project","node",["scripts/p23-browser-smoke.mjs","/aiindeklas/","preview"]],["p24-browser-project","node",["scripts/p24-browser-smoke.mjs","/aiindeklas/"]],["p25-browser-project","node",["scripts/p25-browser-smoke.mjs","/aiindeklas/"]]]),
  phase("production", [["build-production",pnpm,["build:production-sim"]],["built-production","node",["scripts/validate-built-site.mjs","production-sim"]],["links-production","node",["scripts/validate-p26-links.mjs","--built"]],["p09-built-production","node",["scripts/validate-p09.mjs","--built=dist"]],["p23-browser-production","node",["scripts/p23-browser-smoke.mjs","/","production"]]])
];
const quick = process.argv.includes("--quick");
const started = new Date().toISOString();
const results = [];
let stopped = false;
for (const current of (quick ? phases.slice(0, 1) : phases)) {
  for (const [name, executable, args] of current.commands) {
    const entry = { phase: current.name, name, command: [executable, ...args].join(" "), status: "passed" };
    try {
      const output = await run(executable, args, {
        cwd: root,
        maxBuffer: 16 * 1024 * 1024,
        windowsHide: true,
        shell: process.platform === "win32" && executable === pnpm,
      });
      entry.stdout = output.stdout.slice(-12000);
      entry.stderr = output.stderr.slice(-4000);
    } catch (error) {
      entry.status = "failed";
      entry.exitCode = error.code ?? 1;
      entry.stdout = (error.stdout ?? "").slice(-12000);
      entry.stderr = (error.stderr ?? error.message ?? "").slice(-4000);
      stopped = true;
    }
    results.push(entry);
    if (stopped) break;
  }
  if (stopped) break;
}
const report={schema:"website-migration.p28-release-qa/v2",started_at:started,completed_at:new Date().toISOString(),quick,status:results.every(({status})=>status==="passed")?"passed":"failed",commands:results,limitations:["Production simulation retains P27's five volatile-content exclusions until live/legal verification."]};
await mkdir(join(root,"migration","reports"),{recursive:true}); await writeFile(join(root,"migration","reports","P28-release-qa.json"),`${JSON.stringify(report,null,2)}\n`);
console.log(JSON.stringify({status:report.status,phases:[...new Set(results.map(({phase})=>phase))]},null,2)); if(report.status!=="passed") process.exitCode=1;
