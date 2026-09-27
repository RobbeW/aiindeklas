import { defineCollection, reference } from "astro:content";
import { file, glob } from "astro/loaders";
import { z } from "astro/zod";

const markdown = (folder: string) =>
  glob({
    base: `./src/content/${folder}`,
    pattern: "**/*.{md,mdx}",
    retainBody: true,
    generateId: ({ data, entry }) => {
      if (typeof data.id !== "string" || data.id.length === 0) {
        throw new Error(`${entry}: missing stable frontmatter id`);
      }
      return data.id;
    }
  });

const yamlSettings = glob({
  base: "./src/content/settings",
  pattern: "**/*.{yaml,yml}"
});

const locale = z.enum(["nl-BE", "en"]);
const status = z.enum(["draft", "review", "published", "archived"]);
const migrationStatus = z.enum([
  "not_started",
  "extracted",
  "transformed",
  "needs_review",
  "approved",
  "excluded"
]);
const isoDateTime = z.iso.datetime({ offset: true });
const sha256 = z.string().regex(/^[a-f0-9]{64}$/);
const path = z.string().startsWith("/");
const absoluteUrl = z.url();

const mediaReference = reference("media");

const seo = z.object({
  title: z.string().min(1).max(70).nullable(),
  description: z.string().min(1).max(180).nullable(),
  canonical_path: path.nullable(),
  image: mediaReference.nullable(),
  noindex: z.boolean()
}).strict();

const commonShape = {
  id: z.string().min(1),
  title: z.string().min(1),
  slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  locale,
  translation_key: z.string().min(1).nullable(),
  status,
  source_url: absoluteUrl.nullable(),
  source_html_sha256: sha256.nullable(),
  migration_status: migrationStatus,
  created_at: isoDateTime.nullable(),
  updated_at: isoDateTime.nullable(),
  published_at: isoDateTime.nullable(),
  author: reference("authors"),
  excerpt: z.string().min(1).nullable(),
  hero: mediaReference.nullable(),
  seo
};

const validateDocument = (value: z.infer<z.ZodObject<typeof commonShape>>, ctx: z.RefinementCtx) => {
  if ((value.source_url === null) !== (value.source_html_sha256 === null)) {
    ctx.addIssue({
      code: "custom",
      path: ["source_url"],
      message: "source_url and source_html_sha256 must be supplied together"
    });
  }

  if (value.status === "published") {
    if (!value.published_at) {
      ctx.addIssue({ code: "custom", path: ["published_at"], message: "published content requires published_at" });
    }
    if (!value.seo.title || !value.seo.description || !value.seo.canonical_path) {
      ctx.addIssue({ code: "custom", path: ["seo"], message: "published content requires complete SEO metadata" });
    }
    if (value.source_url && value.migration_status !== "approved") {
      ctx.addIssue({
        code: "custom",
        path: ["migration_status"],
        message: "migrated published content must be approved"
      });
    }
  }
};

const navigationPlacement = z.object({
  area: z.enum(["primary", "secondary", "footer"]),
  label: z.string().min(1).nullable(),
  order: z.int().nonnegative()
}).strict();

const cta = z.object({
  label: z.string().min(1),
  href: z.string().min(1),
  style: z.enum(["primary", "secondary", "text"])
}).strict();

const externalReference = z.object({
  label: z.string().min(1),
  url: absoluteUrl
}).strict();

const pages = defineCollection({
  loader: markdown("pages"),
  schema: z.object({
    ...commonShape,
    template: z.enum(["home", "profile", "book", "contact", "education", "projects", "generic"]),
    navigation: z.array(navigationPlacement),
    call_to_actions: z.array(cta)
  }).strict().superRefine(validateDocument)
});

const articles = defineCollection({
  loader: markdown("articles"),
  schema: z.object({
    ...commonShape,
    tags: z.array(z.string().min(1)),
    categories: z.array(z.string().min(1)),
    featured: z.boolean(),
    previous_source_url: absoluteUrl.nullable(),
    next_source_url: absoluteUrl.nullable(),
    gallery: z.array(mediaReference),
    downloads: z.array(externalReference),
    citations: z.array(externalReference)
  }).strict().superRefine(validateDocument)
});

const workshops = defineCollection({
  loader: markdown("workshops"),
  schema: z.object({
    ...commonShape,
    workshop_type: z.enum(["keynote", "workshop", "training", "webinar", "trajectory", "other"]),
    duration_minutes: z.int().nonnegative().nullable(),
    duration_display: z.string(),
    summary: z.string().min(1),
    programme: z.string(),
    goals: z.object({
      knowledge: z.array(z.string().min(1)),
      skills: z.array(z.string().min(1)),
      attitudes: z.array(z.string().min(1))
    }).strict(),
    target_audience: z.string(),
    prerequisites: z.array(z.string().min(1)),
    delivery_modes: z.array(z.enum(["on_site", "online", "hybrid", "cno", "other"])),
    location_notes: z.string(),
    price: z.object({
      amount_eur: z.number().nonnegative().nullable(),
      includes_vat: z.boolean().nullable(),
      display: z.string()
    }).strict(),
    travel_cost: z.object({
      amount_per_km_eur: z.number().nonnegative().nullable(),
      public_transport_policy: z.string().min(1).nullable(),
      display: z.string()
    }).strict(),
    group_size: z.object({
      minimum: z.int().nonnegative().nullable(),
      maximum: z.int().positive().nullable(),
      display: z.string()
    }).strict().refine(
      ({ minimum, maximum }) => minimum === null || maximum === null || minimum <= maximum,
      "group_size.minimum cannot exceed group_size.maximum"
    ),
    booking_cta: cta,
    source_details: z.array(z.object({
      heading: z.string().min(1),
      html: z.string().min(1),
      text: z.string().min(1),
      volatile: z.boolean()
    }).strict()).default([])
  }).strict().superRefine(validateDocument)
});

const projects = defineCollection({
  loader: markdown("projects"),
  schema: z.object({
    ...commonShape,
    external_url: absoluteUrl,
    repository_url: absoluteUrl.nullable(),
    project_family: z.enum(["platform", "steam_project", "publication", "research", "other"]),
    target_age: z.string().min(1).nullable(),
    technologies: z.array(z.string().min(1)),
    learning_goals: z.array(z.string().min(1)),
    privacy_profile: z.string().min(1).nullable(),
    hardware: z.array(z.string().min(1)),
    featured: z.boolean()
  }).strict().superRefine(validateDocument)
});

const authorShape = {
  id: z.string().min(1),
  name: z.string().min(1),
  slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  locale,
  translation_key: z.string().min(1).nullable(),
  status,
  source_url: absoluteUrl.nullable(),
  source_html_sha256: sha256.nullable(),
  migration_status: migrationStatus,
  created_at: isoDateTime.nullable(),
  updated_at: isoDateTime.nullable(),
  published_at: isoDateTime.nullable(),
  portrait: mediaReference.nullable(),
  social_links: z.array(z.object({
    platform: z.string().min(1),
    label: z.string().min(1),
    url: absoluteUrl
  }).strict()),
  seo
};

const authors = defineCollection({
  loader: markdown("authors"),
  schema: z.object(authorShape).strict().superRefine((value, ctx) => {
    if ((value.source_url === null) !== (value.source_html_sha256 === null)) {
      ctx.addIssue({
        code: "custom",
        path: ["source_url"],
        message: "source_url and source_html_sha256 must be supplied together"
      });
    }
  })
});

const settings = defineCollection({
  loader: yamlSettings,
  schema: z.discriminatedUnion("kind", [
    z.object({
      kind: z.literal("site"),
      schema_version: z.string(),
      name: z.string().min(1),
      default_locale: locale,
      supported_locales: z.array(locale).min(1),
      canonical_origin: absoluteUrl,
      contact_email: z.email().nullable()
    }).strict(),
    z.object({
      kind: z.literal("navigation"),
      schema_version: z.string(),
      locales: z.record(locale, z.object({
        label: z.string().min(1),
        items: z.array(z.object({ label: z.string().min(1), path }).strict())
      }).strict())
    }).strict(),
    z.object({
      kind: z.literal("footer"),
      schema_version: z.string(),
      copyright_name: z.string().min(1),
      business_registration: z.string().min(1),
      locales: z.record(locale, z.object({
        links: z.array(z.object({
          label: z.string().min(1),
          path,
          destination_locale: locale
        }).strict())
      }).strict())
    }).strict(),
    z.object({
      kind: z.literal("social"),
      schema_version: z.string(),
      links: z.array(z.object({ platform: z.string().min(1), label: z.string().min(1), url: absoluteUrl }).strict())
    }).strict(),
    z.object({
      kind: z.literal("redirects"),
      schema_version: z.string(),
      redirects: z.array(z.object({
        source_path: path,
        target_path: path,
        status: z.union([z.literal(301), z.literal(308)]),
        implementation: z.literal("static_redirect_stub"),
        decision_gate: z.string().min(1)
      }).strict()),
      excluded_routes: z.object({
        decision_gate: z.string().min(1),
        reason: z.string().min(1),
        paths: z.array(path)
      }).strict()
    }).strict()
  ])
});

const media = defineCollection({
  loader: file("./src/content/media/media.yaml"),
  schema: z.object({
    id: z.string().min(1),
    source_url: absoluteUrl,
    source_filename: z.string().min(1),
    original_path: z.string().min(1),
    output_path: z.string().min(1),
    sha256,
    mime_type: z.string().min(1),
    byte_size: z.int().positive(),
    width: z.int().positive().nullable(),
    height: z.int().positive().nullable(),
    animated: z.boolean(),
    derivatives: z.array(z.object({
      path: z.string().min(1),
      format: z.string().min(1),
      width: z.int().positive().nullable(),
      height: z.int().positive().nullable(),
      byte_size: z.int().positive()
    }).strict()).min(1),
    alt: z.string().min(1).nullable(),
    alt_candidates: z.array(z.string().min(1)),
    caption: z.string().min(1).nullable(),
    caption_candidates: z.array(z.string().min(1)),
    decorative: z.boolean(),
    requires_alt_review: z.boolean(),
    rights: z.string().min(1).nullable(),
    needs_rights_review: z.boolean(),
    used_by: z.array(z.string().min(1))
  }).strict()
});

export const collections = { pages, articles, workshops, projects, authors, settings, media };
