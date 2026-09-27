import type { APIRoute } from "astro";
import { withBase } from "../lib/routing";
import { productionSitemapPaths } from "../lib/route-policy";

const escapeXml = (value: string) => value
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;")
  .replaceAll("'", "&apos;");

export const GET: APIRoute = async ({ site }) => {
  const canAdvertise = import.meta.env.PUBLIC_INDEXING_ENABLED === "true";
  const urls = canAdvertise ? productionSitemapPaths().map((route) => {
    const loc = new URL(withBase(route), site ?? "http://localhost:4321").href;
    return `  <url><loc>${escapeXml(loc)}</loc></url>`;
  }) : [];
  const body = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...urls,
    "</urlset>",
    ""
  ].join("\n");
  return new Response(body, { headers: { "Content-Type": "application/xml; charset=utf-8" } });
};
