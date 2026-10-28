import { createHash } from "node:crypto";
import { spawn } from "node:child_process";
import { access, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { validatePatchBundle } from "../src/lib/cms-studio-core.mjs";
import { parseFrontmatter, validateDocuments, validateRepositoryContent } from "./validate-content-model.mjs";

const workspace = resolve(fileURLToPath(new URL("../", import.meta.url)));
const sha256 = (source) => createHash("sha256").update(source).digest("hex");
const exists = async (path) => access(path).then(() => true, () => false);

const usage = () => {
  console.log("Usage: pnpm cms:patch <validate|apply> <path-to-patch.json>");
  console.log("  validate  checks the bundle, safe paths, current hashes, and Markdown shape");
  console.log("  apply     applies it transactionally, then runs repository content validation");
};

const resolveOperation = async (operation) => {
  const absolute = resolve(workspace, operation.path);
  if (absolute !== workspace && !absolute.startsWith(`${workspace}${sep}`)) {
    throw new Error(`Unsafe patch path: ${operation.path}`);
  }
  const relativePath = relative(workspace, absolute).replaceAll("\\", "/");
  if (relativePath !== operation.path) throw new Error(`Non-canonical patch path: ${operation.path}`);

  const present = await exists(absolute);
  if (operation.operation === "create" && present) throw new Error(`${operation.path}: create target already exists`);
  if (operation.operation === "update" && !present) throw new Error(`${operation.path}: update target does not exist`);

  const original = present ? await readFile(absolute, "utf8") : null;
  if (original !== null && sha256(original) !== operation.expected_sha256) {
    throw new Error(`${operation.path}: source changed since Studio export; reopen the current record before editing`);
  }

  const parsed = parseFrontmatter(operation.content, operation.path);
  const collection = operation.path.includes("/articles/") ? "articles" : "workshops";
  validateDocuments([{ collection, file: operation.path, ...parsed }]);
  return { ...operation, absolute, original };
};

const runAstroCheck = () => new Promise((resolvePromise, reject) => {
  const child = spawn(process.execPath, [resolve(workspace, "scripts/run-astro.mjs"), "check"], {
    cwd: workspace,
    stdio: "inherit",
    shell: false
  });
  child.on("error", reject);
  child.on("exit", (code) => code === 0 ? resolvePromise() : reject(new Error(`Astro schema check failed with exit code ${code}`)));
});

const applyOperations = async (operations) => {
  const changed = [];
  try {
    for (const operation of operations) {
      await mkdir(dirname(operation.absolute), { recursive: true });
      await writeFile(operation.absolute, operation.content, "utf8");
      changed.push(operation);
    }
    await validateRepositoryContent();
    await runAstroCheck();
  } catch (error) {
    for (const operation of changed.reverse()) {
      if (operation.original === null) await rm(operation.absolute, { force: true });
      else await writeFile(operation.absolute, operation.original, "utf8");
    }
    throw new Error(`Patch was rolled back: ${error instanceof Error ? error.message : String(error)}`);
  }
};

const [command, bundlePath] = process.argv.slice(2);
if (["--help", "-h"].includes(command)) {
  usage();
} else if (!["validate", "apply"].includes(command) || !bundlePath) {
  usage();
  process.exitCode = 1;
} else {
  try {
    const bundle = JSON.parse(await readFile(resolve(bundlePath), "utf8"));
    const result = validatePatchBundle(bundle);
    if (!result.valid) throw new Error(result.errors.join("\n"));
    const operations = [];
    for (const operation of bundle.operations) operations.push(await resolveOperation(operation));
    if (command === "apply") await applyOperations(operations);
    console.log(JSON.stringify({
      status: command === "apply" ? "applied" : "valid",
      operations: operations.map(({ operation, path }) => ({ operation, path })),
      next: command === "apply" ? "Review the resulting Git diff before committing." : "Run the same command with apply when ready."
    }, null, 2));
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
