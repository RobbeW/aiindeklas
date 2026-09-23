import { spawn } from "node:child_process";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const workspace = fileURLToPath(new URL("../", import.meta.url));
const astroCli = resolve(workspace, "node_modules/astro/bin/astro.mjs");
const args = process.argv.slice(2);
if (args.length === 0) throw new Error("Usage: node scripts/run-astro.mjs <command> [...args]");

const exitCode = await new Promise((resolveExit, reject) => {
  const child = spawn(process.execPath, [astroCli, ...args], {
    cwd: workspace,
    stdio: "inherit",
    env: { ...process.env, ASTRO_TELEMETRY_DISABLED: "1" }
  });
  child.on("error", reject);
  child.on("exit", (code) => resolveExit(code ?? 1));
});

process.exit(exitCode);
