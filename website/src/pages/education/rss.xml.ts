import rss from "@astrojs/rss";
import { getCollection } from "astro:content";
import { withBase } from "../../lib/routing";
import { isAdvertisableContent } from "../../lib/discoverability";

export const prerender = true;

export async function GET(context: { site?: URL }) {
  if (!context.site) throw new Error("Astro site configuration is required for RSS");
  const canAdvertise = import.meta.env.PUBLIC_INDEXING_ENABLED === "true";
  const articles = (await getCollection("articles"))
    .filter(({ data }) => data.locale === "en" && isAdvertisableContent(data, canAdvertise))
    .sort((a, b) => String(b.data.published_at).localeCompare(String(a.data.published_at)));

  return rss({
    title: "Education articles by Robbe Wulgaert",
    description: "Articles about programming, artificial intelligence, computational thinking and education.",
    site: new URL(withBase("/", import.meta.env.BASE_URL), context.site),
    trailingSlash: false,
    customData: "<language>en</language>",
    items: articles.map(({ data }) => ({
      title: data.title,
      link: withBase(data.seo.canonical_path ?? `/education/${data.slug}`),
      description: data.seo.description ?? data.excerpt ?? data.title,
      pubDate: data.published_at ? new Date(data.published_at) : undefined,
      categories: [...data.categories, ...data.tags]
    }))
  });
}
