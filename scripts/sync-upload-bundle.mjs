import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { cp, mkdir, readFile, readdir, rm } from "node:fs/promises";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const run = promisify(execFile);
const repo = fileURLToPath(new URL("../", import.meta.url));
const output = resolve(repo, "../UPLOAD_THIS");
const excluded = /^(?:\.git(?:\/|$)|UPLOAD_THIS(?:\/|$)|website\/(?:node_modules|dist|_site|\.astro|migration\/screenshots)(?:\/|$)|(?:node_modules|dist|_site|\.astro|\.pnpm-store)(?:\/|$))/;
const { stdout } = await run("git", ["-c", `safe.directory=${repo}`, "-C", repo, "ls-files", "--cached", "--others", "--exclude-standard"], { windowsHide: true });
const files = [...new Set(stdout.split(/\r?\n/)
  .map((v) => v.trim())
  .filter(Boolean)
  .filter((v) => !excluded.test(v))
  .filter((v) => existsSync(resolve(repo, v))))].sort();
await rm(output, { recursive: true, force: true });
const digest = async (path) => createHash("sha256").update(await readFile(path)).digest("hex");
for (const file of files) {
  const source = resolve(repo, file);
  const target = join(output, file);
  await mkdir(dirname(target), { recursive: true });
  await cp(source, target, { force: true });
}
const list = async (directory, prefix = "") => {
  const result = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    const name = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) result.push(...await list(path, name));
    else result.push(name.replaceAll(sep, "/"));
  }
  return result;
};
const actual = (await list(output)).sort();
const expected = files.map((v) => v.replaceAll("\\", "/"));
const missing = expected.filter((v) => !actual.includes(v));
const extra = actual.filter((v) => !expected.includes(v));
const mismatches = [];
for (const file of expected) if (!missing.includes(file) && await digest(resolve(repo, file)) !== await digest(join(output, file))) mismatches.push(file);
if (missing.length || extra.length || mismatches.length) throw new Error(JSON.stringify({ missing, extra, mismatches }, null, 2));
console.log(JSON.stringify({ source_files: expected.length, missing: 0, extra: 0, hash_mismatches: 0, status: "passed" }, null, 2));
