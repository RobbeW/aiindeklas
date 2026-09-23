import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { providerLabelForUrl } from "./p09-embed-labels.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const contentRoot = path.join(ROOT, "src/content");
const files = [];
const walk = async (directory) => {
  for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) await walk(file);
    else if (/\.(?:md|mdx)$/.test(entry.name)) files.push(file);
  }
};
await walk(contentRoot);

let replacements = 0;
const changedFiles = [];
const markdownLink = /^(\s*)\[Video on the source platform\]\((https?:\/\/[^)\s]+)\)(\s*)$/gim;
for (const file of files) {
  const before = await fs.readFile(file, "utf8");
  let fileReplacements = 0;
  const after = before.replace(markdownLink, (whole, leading, destination, trailing) => {
    if (providerLabelForUrl(destination) !== "YouTube") return whole;
    fileReplacements += 1;
    return `${leading}[Video on YouTube](${destination})${trailing}`;
  });
  if (fileReplacements) {
    await fs.writeFile(file, after);
    replacements += fileReplacements;
    changedFiles.push({ file: path.relative(ROOT, file), replacements: fileReplacements });
  }
}
console.log(JSON.stringify({ replacements, files_changed: changedFiles.length, changed_files: changedFiles }, null, 2));
