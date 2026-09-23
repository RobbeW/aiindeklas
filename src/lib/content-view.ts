import type { CollectionEntry } from "astro:content";
import type { SiteLocale } from "./routing";
import type { ImageMetadata } from "astro";

export type BodyEntry =
  | CollectionEntry<"pages">
  | CollectionEntry<"articles">
  | CollectionEntry<"workshops">
  | CollectionEntry<"projects">;

export interface DocumentViewModel {
  collection: BodyEntry["collection"];
  id: string;
  title: string;
  socialImage: ImageMetadata | null;
  locale: SiteLocale;
  canonicalPath: string;
  description: string;
  status: "draft" | "review" | "published" | "archived";
  migrationStatus: "not_started" | "extracted" | "transformed" | "needs_review" | "approved" | "excluded";
  translationKey: string | null;
  noindex: boolean;
  publishedAt: string | null;
  modifiedAt: string | null;
}

const firstBodyPassage = (entry: BodyEntry) => {
  const body = (entry as BodyEntry & { body?: string }).body;
  if (!body) return null;
  const passage = body.split(/\r?\n\s*\r?\n/).map((block) => block
    .replace(/^\s{0,3}#{1,6}\s*/, "")
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, "")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/<[^>]*>/g, "")
    .replace(/[*_`>#]/g, "")
    .replace(/\s+/g, " ").trim()
  ).find((block) => block.length > 50 && /[.!?]/.test(block));
  return passage ? fitDescription(passage, 150) : null;
};

export const fitDescription = (text: string, maxLength = 180) => {
  const normalised = text.replace(/\s+/g, " ").trim();
  if (normalised.length <= maxLength) return normalised;
  const clipped = normalised.slice(0, maxLength + 1);
  const boundary = clipped.lastIndexOf(" ");
  return clipped.slice(0, boundary > 0 ? boundary : maxLength).replace(/[\s,;:—-]+$/g, "");
};

export const toDocumentViewModel = (entry: BodyEntry, socialImage: ImageMetadata | null = null): DocumentViewModel => {
  const { data } = entry;
  return {
    collection: entry.collection,
    id: data.id,
    title: data.seo.title ?? data.title,
    socialImage,
    locale: data.locale,
    canonicalPath: data.seo.canonical_path ?? "/",
    description: data.seo.description
      ?? data.excerpt
      ?? firstBodyPassage(entry)
      ?? data.title,
    status: data.status,
    migrationStatus: data.migration_status,
    translationKey: data.translation_key,
    noindex: data.seo.noindex || data.status !== "published",
    publishedAt: data.published_at,
    modifiedAt: data.updated_at
  };
};
