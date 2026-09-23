import type { APIRoute } from "astro";
import { getCollection } from "astro:content";
import { withBase } from "../lib/routing";
import { isAdvertisableContent } from "../lib/discoverability";

const escapeXml = (value: string) => value
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;")
  .replaceAll("'", "&apos;");

export const GET: APIRoute = async ({ site }) => {
  const canAdvertise = import.meta.env.PUBLIC_INDEXING_ENABLED === "true";
  const [pages, articles] = await Promise.all([getCollection("pages"), getCollection("articles")]);
  const eligible = [...pages, ...articles].filter(({ data }) => isAdvertisableContent(data, canAdvertise));
  const urls = eligible.map(({ data }) => {
    const loc = new URL(withBase(data.seo.canonical_path!), site ?? "http://localhost:4321").href;
    return `  <url><loc>${escapeXml(loc)}</loc></url>`;
  });
  const body = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...urls,
    "</urlset>",
    ""
  ].join("\n");
  return new Response(body, { headers: { "Content-Type": "application/xml; charset=utf-8" } });
};
