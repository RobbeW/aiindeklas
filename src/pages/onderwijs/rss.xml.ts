import rss from "@astrojs/rss";
import { getCollection } from "astro:content";
import { withBase } from "../../lib/routing";
import { isAdvertisableContent } from "../../lib/discoverability";

export const prerender = true;

export async function GET(context: { site?: URL }) {
  if (!context.site) throw new Error("Astro site configuration is required for RSS");
  const canAdvertise = import.meta.env.PUBLIC_INDEXING_ENABLED === "true";
  const articles = (await getCollection("articles"))
    .filter(({ data }) => data.locale === "nl-BE" && isAdvertisableContent(data, canAdvertise))
    .sort((a, b) => String(b.data.published_at).localeCompare(String(a.data.published_at)));

  return rss({
    title: "Onderwijsartikels van Robbe Wulgaert",
    description: "Artikels over programmeren, artificiële intelligentie, computationeel denken en onderwijs.",
    site: new URL(withBase("/", import.meta.env.BASE_URL), context.site),
    trailingSlash: false,
    customData: "<language>nl-be</language>",
    items: articles.map(({ data }) => ({
      title: data.title,
      link: withBase(data.seo.canonical_path ?? `/onderwijs/${data.slug}`),
      description: data.seo.description ?? data.excerpt ?? data.title,
      pubDate: data.published_at ? new Date(data.published_at) : undefined,
      categories: [...data.categories, ...data.tags]
    }))
  });
}
