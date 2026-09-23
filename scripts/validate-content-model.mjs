import { readdir, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parse as parseYaml } from "yaml";

const contentRoot = new URL("../src/content/", import.meta.url);
const bodyCollections = ["authors", "pages", "articles", "workshops", "projects"];

export const parseFrontmatter = (source, file = "content entry") => {
  const match = source.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
  if (!match) throw new Error(`${file}: missing YAML frontmatter`);
  return { data: parseYaml(match[1]), body: match[2] };
};

const listMarkdown = async (directory) => {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const url = new URL(`${entry.name}${entry.isDirectory() ? "/" : ""}`, directory);
    if (entry.isDirectory()) files.push(...await listMarkdown(url));
    if (entry.isFile() && /\.mdx?$/.test(entry.name)) files.push(url);
  }
  return files;
};

export const validateDocuments = (documents) => {
  const errors = [];
  const ids = new Map();
  const routes = new Map();
  const translations = new Map();

  for (const document of documents) {
    const { collection, file, data, body } = document;
    if (!body.trim()) errors.push(`${file}: Markdown body must not be blank`);
    if (!data || typeof data !== "object") {
      errors.push(`${file}: frontmatter must be an object`);
      continue;
    }

    const collectionIds = ids.get(collection) ?? new Set();
    if (collectionIds.has(data.id)) errors.push(`${file}: duplicate ${collection} id ${data.id}`);
    collectionIds.add(data.id);
    ids.set(collection, collectionIds);

    const sourcePairMismatch = (data.source_url === null) !== (data.source_html_sha256 === null);
    if (sourcePairMismatch) errors.push(`${file}: source_url and source_html_sha256 must be paired`);
    if (data.source_html_sha256 !== null && !/^[a-f0-9]{64}$/.test(data.source_html_sha256)) {
      errors.push(`${file}: invalid source_html_sha256`);
    }

    if (data.status === "published") {
      if (!data.published_at) errors.push(`${file}: published content requires published_at`);
      if (!data.seo?.title || !data.seo?.description || !data.seo?.canonical_path) {
        errors.push(`${file}: published content requires complete SEO metadata`);
      }
      if (data.source_url && data.migration_status !== "approved") {
        errors.push(`${file}: migrated published content must be approved`);
      }
    }

    if (["pages", "articles"].includes(collection) && data.seo?.canonical_path) {
      const previous = routes.get(data.seo.canonical_path);
      if (previous) errors.push(`${file}: canonical path duplicates ${previous}`);
      routes.set(data.seo.canonical_path, file);
    }

    if (data.translation_key) {
      const group = translations.get(data.translation_key) ?? [];
      group.push({ locale: data.locale, file });
      translations.set(data.translation_key, group);
    }
  }

  for (const [key, group] of translations) {
    const locales = new Set(group.map(({ locale }) => locale));
    if (group.length !== 2 || locales.size !== 2 || !locales.has("nl-BE") || !locales.has("en")) {
      errors.push(`translation_key ${key} must identify one nl-BE and one en record`);
    }
  }

  if (errors.length) throw new Error(errors.join("\n"));
  return {
    documents: documents.length,
    collections: Object.fromEntries([...ids].map(([collection, values]) => [collection, values.size])),
    paired_translations: translations.size
  };
};

export const validateRepositoryContent = async () => {
  const documents = [];
  for (const collection of bodyCollections) {
    for (const url of await listMarkdown(new URL(`${collection}/`, contentRoot))) {
      const file = fileURLToPath(url);
      const parsed = parseFrontmatter(await readFile(url, "utf8"), file);
      documents.push({ collection, file, ...parsed });
    }
  }

  const settingsFiles = await readdir(new URL("settings/", contentRoot));
  const settingsKinds = new Set();
  for (const filename of settingsFiles.filter((name) => /\.ya?ml$/.test(name))) {
    const value = parseYaml(await readFile(new URL(`settings/${filename}`, contentRoot), "utf8"));
    if (value?.kind) settingsKinds.add(value.kind);
  }
  const requiredKinds = ["site", "navigation", "footer", "social", "redirects"];
  const missingKinds = requiredKinds.filter((kind) => !settingsKinds.has(kind));
  if (missingKinds.length) throw new Error(`Missing settings kinds: ${missingKinds.join(", ")}`);

  const media = parseYaml(await readFile(new URL("media/media.yaml", contentRoot), "utf8"));
  if (!Array.isArray(media)) throw new Error("media/media.yaml must be an array");

  return {
    ...validateDocuments(documents),
    settings_kinds: [...settingsKinds].sort(),
    media_records: media.length
  };
};

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  console.log(JSON.stringify(await validateRepositoryContent(), null, 2));
}
