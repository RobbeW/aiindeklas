import type { APIRoute } from "astro";
import { withBase } from "../lib/routing";
import { getCollection } from "astro:content";
import { isAdvertisableContent } from "../lib/discoverability";

export const GET: APIRoute = async ({ site }) => {
  const indexingEnabled = import.meta.env.PUBLIC_INDEXING_ENABLED === "true";
  const [pages, articles] = await Promise.all([getCollection("pages"), getCollection("articles")]);
  const allowIndexing = [...pages, ...articles].some(({ data }) => isAdvertisableContent(data, indexingEnabled));
  const sitemap = new URL(withBase("/sitemap.xml"), site ?? "http://localhost:4321").href;
  const body = allowIndexing
    ? `User-agent: *\nAllow: /\nSitemap: ${sitemap}\n`
    : `User-agent: *\nDisallow: /\nSitemap: ${sitemap}\n`;
  return new Response(body, { headers: { "Content-Type": "text/plain; charset=utf-8" } });
};
