import { stringify as stringifyYaml } from "yaml";

export const CMS_PATCH_SCHEMA = "robbew-cms-patch/v1";
export const EDITABLE_COLLECTIONS = ["articles", "workshops"];

const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const isoPattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?(?:Z|[+-]\d{2}:\d{2})$/;
const safeContentPath = /^src\/content\/(articles|workshops)\/[a-z0-9_/-]+\.mdx?$/;

const commonKeys = [
  "id", "title", "slug", "locale", "translation_key", "status", "source_url",
  "source_html_sha256", "migration_status", "created_at", "updated_at", "published_at",
  "author", "excerpt", "hero", "seo"
];

const collectionKeys = {
  articles: [
    "tags", "categories", "featured", "previous_source_url", "next_source_url",
    "gallery", "downloads", "citations"
  ],
  workshops: [
    "workshop_type", "duration_minutes", "duration_display", "summary", "programme",
    "goals", "target_audience", "prerequisites", "delivery_modes", "location_notes",
    "price", "travel_cost", "group_size", "booking_cta"
  ]
};

const clone = (value) => JSON.parse(JSON.stringify(value));

export const slugify = (value) => String(value ?? "")
  .normalize("NFKD")
  .replace(/[\u0300-\u036f]/g, "")
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, "-")
  .replace(/^-+|-+$/g, "")
  .slice(0, 90);

export const splitList = (value) => String(value ?? "")
  .split(/\r?\n|,/)
  .map((item) => item.trim())
  .filter(Boolean);

export const getPath = (object, path) => path.split(".").reduce((value, key) => value?.[key], object);

export const setPath = (object, path, value) => {
  const keys = path.split(".");
  const last = keys.pop();
  let target = object;
  for (const key of keys) {
    if (!target[key] || typeof target[key] !== "object") target[key] = {};
    target = target[key];
  }
  target[last] = value;
  return object;
};

export const safeTargetPath = (value) => {
  const normalised = String(value ?? "").replaceAll("\\", "/");
  return safeContentPath.test(normalised) && !normalised.includes("../");
};

export const createArticleDraft = ({
  title = "Nieuw artikel",
  locale = "nl-BE",
  now = new Date().toISOString()
} = {}) => {
  const slug = slugify(title) || "nieuw-artikel";
  return {
    collection: "articles",
    file: `src/content/articles/drafts/${slug}.md`,
    original_sha256: null,
    data: {
      id: `draft-article-${slug}`,
      title,
      slug,
      locale,
      translation_key: null,
      status: "draft",
      source_url: null,
      source_html_sha256: null,
      migration_status: "not_started",
      created_at: now,
      updated_at: now,
      published_at: null,
      author: "robbe-wulgaert",
      excerpt: null,
      hero: null,
      seo: {
        title,
        description: null,
        canonical_path: locale === "en" ? `/education/${slug}` : `/onderwijs/${slug}`,
        image: null,
        noindex: true
      },
      tags: [],
      categories: [],
      featured: false,
      previous_source_url: null,
      next_source_url: null,
      gallery: [],
      downloads: [],
      citations: []
    },
    body: "Schrijf hier de inhoud van het nieuwe artikel."
  };
};

export const duplicateArticle = (record, now = new Date().toISOString()) => {
  if (record.collection !== "articles") throw new Error("Only articles can be duplicated");
  const copy = clone(record);
  const slug = `${slugify(copy.data.slug || copy.data.title) || "artikel"}-kopie`;
  copy.file = `src/content/articles/drafts/${slug}.md`;
  copy.original_sha256 = null;
  copy.data.id = `draft-article-${slug}`;
  copy.data.title = `${copy.data.title} (kopie)`;
  copy.data.slug = slug;
  copy.data.status = "draft";
  copy.data.source_url = null;
  copy.data.source_html_sha256 = null;
  copy.data.migration_status = "not_started";
  copy.data.created_at = now;
  copy.data.updated_at = now;
  copy.data.published_at = null;
  copy.data.seo.title = copy.data.title;
  copy.data.seo.canonical_path = copy.data.locale === "en" ? `/education/${slug}` : `/onderwijs/${slug}`;
  copy.data.seo.noindex = true;
  return copy;
};

export const validateCmsRecord = (record) => {
  const errors = [];
  const data = record?.data ?? {};
  const collection = record?.collection;

  if (!EDITABLE_COLLECTIONS.includes(collection)) errors.push("Collection must be articles or workshops.");
  if (!safeTargetPath(record?.file)) errors.push("Target file is outside an editable content collection.");
  if (!String(data.id ?? "").trim()) errors.push("ID is required.");
  if (!String(data.title ?? "").trim()) errors.push("Title is required.");
  if (!slugPattern.test(String(data.slug ?? ""))) errors.push("Slug may contain lowercase letters, numbers, and hyphens only.");
  if (!["nl-BE", "en"].includes(data.locale)) errors.push("Locale must be nl-BE or en.");
  if (!["draft", "review", "published", "archived"].includes(data.status)) errors.push("Choose a valid publication status.");
  if (!String(record?.body ?? "").trim()) errors.push("Body may not be empty.");
  if (!String(data.seo?.canonical_path ?? "").startsWith("/")) errors.push("Canonical path must start with /.");
  if (data.updated_at && !isoPattern.test(data.updated_at)) errors.push("Updated date must be an ISO date-time.");
  if ((data.source_url === null) !== (data.source_html_sha256 === null)) {
    errors.push("Source URL and source hash must remain paired.");
  }

  if (data.status === "published") {
    if (!data.published_at) errors.push("Published content requires a publication date.");
    if (!data.seo?.title || !data.seo?.description || !data.seo?.canonical_path) {
      errors.push("Published content requires a complete SEO title, description, and canonical path.");
    }
    if (data.source_url && data.migration_status !== "approved") {
      errors.push("Migrated content must be approved before publication.");
    }
  }

  if (collection === "articles") {
    if (!Array.isArray(data.tags) || !Array.isArray(data.categories)) errors.push("Tags and categories must be lists.");
    if (typeof data.featured !== "boolean") errors.push("Featured must be true or false.");
  }

  if (collection === "workshops") {
    if (!String(data.summary ?? "").trim()) errors.push("Workshop summary is required.");
    if (!["keynote", "workshop", "training", "webinar", "trajectory", "other"].includes(data.workshop_type)) {
      errors.push("Choose a valid workshop type.");
    }
    if (data.duration_minutes !== null && (!Number.isInteger(data.duration_minutes) || data.duration_minutes < 0)) {
      errors.push("Duration must be a whole number of minutes or blank.");
    }
    const allowedDeliveryModes = ["on_site", "online", "hybrid", "cno", "other"];
    if (!Array.isArray(data.delivery_modes) || data.delivery_modes.some((mode) => !allowedDeliveryModes.includes(mode))) {
      errors.push("Workshop delivery modes contain an unsupported value.");
    }
    for (const goalType of ["knowledge", "skills", "attitudes"]) {
      if (!Array.isArray(data.goals?.[goalType])) errors.push(`Workshop goals.${goalType} must be a list.`);
    }
    if (data.price?.amount_eur !== null && (typeof data.price?.amount_eur !== "number" || data.price.amount_eur < 0)) {
      errors.push("Workshop price must be a positive number or blank.");
    }
    if (![true, false, null].includes(data.price?.includes_vat)) errors.push("VAT inclusion must be yes, no, or unknown.");
    if (data.travel_cost?.amount_per_km_eur !== null && (typeof data.travel_cost?.amount_per_km_eur !== "number" || data.travel_cost.amount_per_km_eur < 0)) {
      errors.push("Travel cost must be a positive number or blank.");
    }
    if (data.group_size?.minimum !== null && data.group_size?.maximum !== null && data.group_size.minimum > data.group_size.maximum) {
      errors.push("Minimum group size cannot exceed maximum group size.");
    }
    if (!String(data.booking_cta?.label ?? "").trim() || !String(data.booking_cta?.href ?? "").trim()) {
      errors.push("Workshop booking button requires a label and link.");
    }
    if (!["primary", "secondary", "text"].includes(data.booking_cta?.style)) errors.push("Choose a valid booking button style.");
  }

  return { valid: errors.length === 0, errors };
};

const orderedFrontmatter = (record) => {
  const output = {};
  for (const key of [...commonKeys, ...(collectionKeys[record.collection] ?? [])]) {
    if (Object.hasOwn(record.data, key)) output[key] = clone(record.data[key]);
  }
  return output;
};

export const serialiseCmsRecord = (record) => {
  const result = validateCmsRecord(record);
  if (!result.valid) throw new Error(result.errors.join("\n"));
  const yaml = stringifyYaml(orderedFrontmatter(record), {
    lineWidth: 0,
    defaultStringType: "QUOTE_DOUBLE",
    defaultKeyType: "PLAIN"
  });
  return `---\n${yaml}---\n\n${String(record.body).trim()}\n`;
};

export const buildPatchBundle = (record, generatedAt = new Date().toISOString()) => {
  const content = serialiseCmsRecord(record);
  return {
    schema: CMS_PATCH_SCHEMA,
    generated_at: generatedAt,
    publishing_mode: "local_patch_then_git_review",
    operations: [{
      operation: record.original_sha256 ? "update" : "create",
      path: record.file.replaceAll("\\", "/"),
      expected_sha256: record.original_sha256 ?? null,
      content
    }]
  };
};

export const validatePatchBundle = (bundle) => {
  const errors = [];
  if (bundle?.schema !== CMS_PATCH_SCHEMA) errors.push(`Patch schema must be ${CMS_PATCH_SCHEMA}.`);
  if (bundle?.publishing_mode !== "local_patch_then_git_review") errors.push("Unsupported publishing mode.");
  if (!Array.isArray(bundle?.operations) || bundle.operations.length === 0) errors.push("Patch has no operations.");
  for (const [index, operation] of (bundle?.operations ?? []).entries()) {
    if (!["create", "update"].includes(operation?.operation)) errors.push(`Operation ${index + 1} has an invalid type.`);
    if (!safeTargetPath(operation?.path)) errors.push(`Operation ${index + 1} has an unsafe target path.`);
    if (operation?.operation === "update" && !/^[a-f0-9]{64}$/.test(operation?.expected_sha256 ?? "")) {
      errors.push(`Operation ${index + 1} is missing a valid expected hash.`);
    }
    if (operation?.operation === "create" && operation?.expected_sha256 !== null) {
      errors.push(`Operation ${index + 1} must not carry an expected hash for a new file.`);
    }
    if (typeof operation?.content !== "string" || !operation.content.startsWith("---\n")) {
      errors.push(`Operation ${index + 1} does not contain a Markdown document.`);
    }
  }
  return { valid: errors.length === 0, errors };
};
