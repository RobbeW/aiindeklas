import type { APIRoute } from "astro";
import { getCollection } from "astro:content";
import { parse as parseYaml } from "yaml";

export const prerender = true;

const articleFiles = import.meta.glob<string>("../../content/articles/**/*.{md,mdx}", {
  eager: true,
  import: "default",
  query: "?raw"
});

const workshopFiles = import.meta.glob<string>("../../content/workshops/**/*.{md,mdx}", {
  eager: true,
  import: "default",
  query: "?raw"
});

const parseSource = (source: string, path: string) => {
  const match = source.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
  if (!match) throw new Error(`${path}: missing YAML frontmatter`);
  return { data: parseYaml(match[1]), body: match[2] };
};

const sha256 = async (source: string) => {
  const digest = await globalThis.crypto.subtle.digest("SHA-256", new TextEncoder().encode(source));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
};

const sourceIndex = new Map(
  await Promise.all(Object.entries({ ...articleFiles, ...workshopFiles }).map(async ([importPath, source]) => {
    const path = importPath.replace(/^\.\.\/\.\.\/content\//, "src/content/").replaceAll("\\", "/");
    const parsed = parseSource(source, path);
    return [parsed.data.id, {
      file: path,
      body: parsed.body,
      original_sha256: await sha256(source)
    }] as const;
  }))
);

export const GET: APIRoute = async () => {
  const [articles, workshops, media] = await Promise.all([
    getCollection("articles"),
    getCollection("workshops"),
    getCollection("media")
  ]);

  const records = [...articles, ...workshops].map((entry) => {
    const source = sourceIndex.get(entry.id);
    if (!source) throw new Error(`CMS source file missing for ${entry.collection}:${entry.id}`);
    return {
      collection: entry.collection,
      file: source.file,
      original_sha256: source.original_sha256,
      data: entry.data,
      body: source.body
    };
  }).sort((a, b) => a.data.title.localeCompare(b.data.title, a.data.locale));

  const mediaOptions = media.map(({ id, data }) => ({
    id,
    label: data.alt ?? data.alt_candidates[0] ?? data.source_filename,
    requires_alt_review: data.requires_alt_review,
    needs_rights_review: data.needs_rights_review
  })).sort((a, b) => a.label.localeCompare(b.label));

  return new Response(JSON.stringify({
    schema: "robbew-cms-content/v1",
    generated_at: new Date().toISOString(),
    records,
    media: mediaOptions
  }), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store"
    }
  });
};
