import path from "node:path";
import { fileURLToPath } from "node:url";

const WORKSHOP_DIRECTORY = path.resolve(process.cwd(), "src/content/workshops/generated");

export default function rehypeWorkshopHeadingIds() {
  return (tree, file) => {
    const filePath = file?.history?.[0] ?? file?.path;
    const frontmatter = file?.data?.astro?.frontmatter;
    let slug;
    if (filePath) {
      let absolutePath;
      try { absolutePath = String(filePath).startsWith("file:") ? fileURLToPath(filePath) : path.resolve(filePath); }
      catch { return; }
      const relative = path.relative(WORKSHOP_DIRECTORY, absolutePath);
      if (!relative || relative.startsWith("..") || path.isAbsolute(relative) || !/\.mdx?$/i.test(relative)) return;
      slug = path.basename(relative).replace(/\.mdx?$/i, "");
    } else if (typeof frontmatter?.id === "string" && frontmatter.id.startsWith("source-workshop-") && typeof frontmatter.slug === "string") {
      slug = frontmatter.slug;
    } else return;
    const idMap = new Map();
    const textOf = (node) => node?.type === "text" ? node.value : (node?.children ?? []).map(textOf).join("");
    const occurrences = new Map();
    const walk = (node) => {
      if (!node || typeof node !== "object") return;
      if (node.type === "element" && /^h[1-6]$/.test(node.tagName)) {
        node.properties = node.properties ?? {};
        const generated = textOf(node).normalize("NFKD").replace(/\p{Diacritic}/gu, "").toLocaleLowerCase("en").trim().replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-+|-+$/g, "") || "heading";
        const occurrence = occurrences.get(generated) ?? 0;
        occurrences.set(generated, occurrence + 1);
        const prior = typeof node.properties.id === "string" ? node.properties.id : generated;
        const next = `${slug}-${generated}${occurrence ? `-${occurrence}` : ""}`;
        idMap.set(generated, next);
        idMap.set(prior, next);
        node.properties.id = next;
      }
      for (const child of node.children ?? []) walk(child);
    };
    walk(tree);
    const headings = file?.data?.astro?.headings;
    if (Array.isArray(headings)) {
      for (const heading of headings) heading.slug = idMap.get(heading.slug) ?? `${slug}-${heading.slug}`;
    }
    const rewriteLinks = (node) => {
      if (!node || typeof node !== "object") return;
      if (node.type === "element" && node.tagName === "a" && typeof node.properties?.href === "string" && node.properties.href.startsWith("#")) {
        const next = idMap.get(node.properties.href.slice(1));
        if (next) node.properties.href = `#${next}`;
      }
      for (const child of node.children ?? []) rewriteLinks(child);
    };
    rewriteLinks(tree);
  };
}
