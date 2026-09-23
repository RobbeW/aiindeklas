import { createHash } from "node:crypto";
import { cp, mkdir, readFile, readdir, rm, stat } from "node:fs/promises";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = fileURLToPath(new URL("../", import.meta.url));
const args = process.argv.slice(2);
const readArg = (name, fallback) => { const i = args.indexOf(name); return i < 0 ? fallback : args[i + 1] ?? fallback; };
const dist = resolve(repoRoot, readArg("--website-dist", "website/dist"));
const output = resolve(repoRoot, readArg("--output", "_site"));
if (output !== resolve(repoRoot, "_site")) throw new Error("Artifact output must be the repository-local _site directory");
if (dist === output || dist.startsWith(`${output}${sep}`)) throw new Error("Website build output cannot be inside the Pages artifact directory");
await stat(join(dist, "index.html"));

const preservedDirectories = ["aeneas", "computationeel_denken", "deepfakes", "sentimentsanalyse", "supervised_learning"];
const digest = (bytes) => createHash("sha256").update(bytes).digest("hex");
const filesBelow = async (directory) => {
  const result = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) result.push(...await filesBelow(path));
    else if (entry.isFile()) result.push(path);
  }
  return result;
};

await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });
await cp(dist, output, { recursive: true, force: true });
// The local CMS is useful during authoring, but its generated content JSON
// includes draft bodies and must never enter the published Pages artifact.
await rm(join(output, "admin.html"), { force: true });
await rm(join(output, "admin"), { recursive: true, force: true });
for (const forbidden of ["admin.html", "admin/content.json"]) {
  try {
    await stat(join(output, forbidden));
    throw new Error(`Local authoring route leaked into Pages artifact: ${forbidden}`);
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }
}
for (const path of [...preservedDirectories, "knn"]) {
  try {
    await stat(join(output, path));
    throw new Error(`Cannot preserve target content because website build already owns /${path}/`);
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }
}
await mkdir(join(output, "knn"), { recursive: true });
await cp(join(repoRoot, "knn", "index.html"), join(output, "knn", "index.html"));

const copied = {};
for (const directory of preservedDirectories) {
  const source = join(repoRoot, directory);
  const destination = join(output, directory);
  await cp(source, destination, { recursive: true, force: true });
  const sourceFiles = await filesBelow(source);
  for (const sourceFile of sourceFiles) {
    const targetFile = join(destination, relative(source, sourceFile));
    if (digest(await readFile(sourceFile)) !== digest(await readFile(targetFile))) {
      throw new Error(`Preserved file hash mismatch: ${relative(repoRoot, sourceFile)}`);
    }
  }
  copied[directory] = sourceFiles.length;
}
if (digest(await readFile(join(repoRoot, "knn", "index.html"))) !== digest(await readFile(join(output, "knn", "index.html")))) {
  throw new Error("KNN index hash mismatch after move to /knn/index.html");
}

const report = {
  schema_version: "1.0.0",
  output: relative(repoRoot, output).replaceAll("\\", "/"),
  website_homepage: "index.html",
  knn_homepage: "knn/index.html",
  excluded_local_authoring_paths: ["admin.html", "admin/content.json"],
  preserved_directory_file_counts: copied,
  knn_index_sha256: digest(await readFile(join(output, "knn", "index.html"))),
  status: "passed"
};
console.log(JSON.stringify(report, null, 2));
