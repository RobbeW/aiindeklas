import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { load } from "cheerio";
import { replaceContactFormCopy } from "./p09-contact-copy.mjs";
import { providerLabelForUrl } from "./p09-embed-labels.mjs";
import TurndownService from "turndown";
import { parse as parseYaml, stringify as stringifyYaml } from "yaml";

const ROOT = process.cwd();
const CONTENT_ROOT = path.join(ROOT, "src", "content");
const GENERATED_ROOTS = {
  pages: path.join(CONTENT_ROOT, "pages", "generated"),
  articles: path.join(CONTENT_ROOT, "articles", "generated"),
  workshops: path.join(CONTENT_ROOT, "workshops", "generated"),
  projects: path.join(CONTENT_ROOT, "projects", "generated")
};
const MANIFEST_PATH = path.join(ROOT, "migration", "source-manifest.json");
const ASSET_CANDIDATES_PATH = path.join(ROOT, "migration", "asset-candidates.json");
const ASSET_LEDGER_PATH = path.join(ROOT, "migration", "asset-ledger.json");
const INVENTORY_PATH = path.join(ROOT, "migration", "reports", "P5-content-inventory.json");
const REVIEW_PATH = path.join(ROOT, "migration", "P5-review-queue.csv");
const TAXONOMY_ROUTES_PATH = path.join(ROOT, "src", "data", "taxonomy-routes.json");
const NATIVE_VIDEO_DEFERRALS_PATH = path.resolve(ROOT, "..", "docs", "implementation", "manifests", "native-video-deferrals.json");

const manifest = JSON.parse(await readFile(MANIFEST_PATH, "utf8"));
const generatedAt = manifest.generated_at;
const nativeVideoDeferrals = JSON.parse(await readFile(NATIVE_VIDEO_DEFERRALS_PATH, "utf8"));
if (nativeVideoDeferrals.decision !== "deferred_pending_owner_source" || nativeVideoDeferrals.items.length !== 18) {
  throw new Error("P08 native-video deferral input must contain the 18 owner-approved candidates.");
}
const orchestrator = parseYaml(await readFile(path.join(ROOT, "robbewulgaert_cms_orchestrator.yaml"), "utf8"));
let assetLedger = [];
try {
  assetLedger = JSON.parse(await readFile(ASSET_LEDGER_PATH, "utf8"));
} catch (error) {
  if (error?.code !== "ENOENT") throw error;
}
const migratedAssets = new Map(
  assetLedger.filter(({ status }) => status === "downloaded").map((record) => [record.source_url, record])
);

const sha256 = (value) => createHash("sha256").update(value).digest("hex");
const shortHash = (value) => sha256(value).slice(0, 16);
const suppressDeferredNativeVideoLinks = (body) => {
  let result = body;
  for (const item of nativeVideoDeferrals.items) {
    if (item.id !== `media-${shortHash(item.source_url)}`) {
      throw new Error(`P08 video deferral ID does not match its source URL: ${item.id}`);
    }
    result = result.replaceAll(`[Video](${item.source_url})`, `<!-- p08-deferred:${item.id} -->`);
  }
  return result;
};
const normaliseSpace = (value) => String(value ?? "").replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();
const escapeHtml = (value) => String(value ?? "")
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;");
const normaliseDate = (value) => {
  if (!value) return null;
  return value.replace(/([+-]\d{2})(\d{2})$/, "$1:$2");
};
const slugify = (value) => {
  const slug = String(value ?? "")
    .normalize("NFKD")
    .replaceAll(/\p{Diacritic}/gu, "")
    .replaceAll("&", " en ")
    .toLowerCase()
    .replaceAll(/[^a-z0-9]+/g, "-")
    .replaceAll(/^-+|-+$/g, "")
    .slice(0, 90)
    .replaceAll(/-+$/g, "");
  return slug || "record";
};
const cleanSiteTitle = (value) => normaliseSpace(value)
  .replace(/\s+[—|-]\s+Robbe Wulgaert\s*$/i, "")
  .trim();
const nullableSeo = (value, maximum) => {
  const text = normaliseSpace(value);
  return text && text.length <= maximum ? text : null;
};
const localeForPath = (pathname) => pathname === "/about" || pathname === "/contactinfo" ||
  pathname === "/projects" || pathname === "/education" || pathname.startsWith("/education/")
  ? "en"
  : "nl-BE";
const recordByPath = new Map();
for (const record of manifest.pages) {
  const url = new URL(record.url);
  if (!url.search && !recordByPath.has(url.pathname)) recordByPath.set(url.pathname, record);
}

let migratedButtonCount = 0;
const turndown = new TurndownService({
  headingStyle: "atx",
  bulletListMarker: "-",
  codeBlockStyle: "fenced",
  emDelimiter: "_"
});
turndown.addRule("iframe-link", {
  filter: "iframe",
  replacement: (_content, node) => {
    const source = node.getAttribute("src");
    return source ? `\n\n[Embedded media](${source})\n\n` : "";
  }
});
turndown.addRule("owned-media-link", {
  filter: ["audio", "video"],
  replacement: (_content, node) => {
    const source = node.getAttribute("src") ?? node.querySelector?.("source")?.getAttribute("src");
    const label = node.getAttribute("title") || (node.nodeName === "VIDEO" ? "Video" : "Audio");
    return source ? `\n\n[${label}](${source})\n\n` : "";
  }
});
turndown.addRule("squarespace-button", {
  filter: (node) => node.nodeName === "DIV" &&
    String(node.getAttribute("class") ?? "").split(/\s+/).includes("sqs-block-button-container") &&
    Boolean(node.querySelector?.("a.sqs-block-button-element[href]")),
  replacement: (_content, node) => {
    const anchor = node.querySelector("a.sqs-block-button-element[href]");
    const className = String(node.getAttribute("class") ?? "");
    const alignment = className.includes("--right") ? "right" : className.includes("--center") ? "center" : "left";
    const type = normaliseSpace(node.getAttribute("data-button-type")) || "primary";
    const size = normaliseSpace(node.getAttribute("data-button-size")) || "medium";
    const href = escapeHtml(anchor.getAttribute("href"));
    const label = escapeHtml(normaliseSpace(anchor.textContent));
    const newWindow = anchor.getAttribute("target") === "_blank";
    const target = newWindow ? ' target="_blank" rel="noreferrer"' : "";
    migratedButtonCount += 1;
    return `\n\n<div class="content-button-row content-button-row--${alignment}"><a class="content-button content-button--${type} content-button--${size}" href="${href}"${target}>${label}</a></div>\n\n`;
  }
});

const assetCandidates = new Map();
const ownerAssetHosts = new Set([
  "images.squarespace-cdn.com",
  "static1.squarespace.com",
  "video.squarespace-cdn.com",
  "www.robbewulgaert.be",
  "robbewulgaert.be"
]);
const mediaExtensions = new Set([
  ".avif", ".gif", ".jpeg", ".jpg", ".m4a", ".mov", ".mp3", ".mp4",
  ".png", ".svg", ".wav", ".webm", ".webp"
]);

const canonicalOwnerAsset = (raw, base) => {
  if (!raw || /^(?:data|mailto|tel|javascript):/i.test(raw)) return null;
  let url;
  try {
    url = new URL(raw, base);
  } catch {
    return null;
  }
  if (!ownerAssetHosts.has(url.hostname.toLowerCase())) return null;
  if (!mediaExtensions.has(path.extname(url.pathname).toLowerCase()) && url.hostname !== "video.squarespace-cdn.com") return null;
  url.protocol = "https:";
  url.search = "";
  url.hash = "";
  return url.href;
};

const registerAsset = ({ raw, base, contentId, alt = null, caption = null, role = "inline", sourceTemplate = null, sourceVariants = null }) => {
  const url = canonicalOwnerAsset(raw, base);
  if (!url) return null;
  const id = `media-${shortHash(url)}`;
  const existing = assetCandidates.get(url) ?? {
    id,
    source_url: url,
    source_filename: decodeURIComponent(new URL(url).pathname.split("/").at(-1) || id),
    roles: new Set(),
    used_by: new Set(),
    alt_candidates: new Set(),
    caption_candidates: new Set(),
    ...(sourceTemplate ? { source_template: sourceTemplate } : {}),
    ...(sourceVariants ? { source_variants: sourceVariants } : {})
  };
  existing.roles.add(role);
  existing.used_by.add(contentId);
  if (normaliseSpace(alt)) existing.alt_candidates.add(normaliseSpace(alt));
  if (normaliseSpace(caption)) existing.caption_candidates.add(normaliseSpace(caption));
  if (!existing.source_template && sourceTemplate) existing.source_template = sourceTemplate;
  if (!existing.source_variants && sourceVariants) existing.source_variants = sourceVariants;
  assetCandidates.set(url, existing);
  return { id, url, migrated: migratedAssets.get(url) ?? null };
};

const markdownAssetPath = (ledgerRecord, outputFile) => {
  if (ledgerRecord.output_path.startsWith("public/")) {
    const logicalTarget = `/${ledgerRecord.output_path.slice("public/".length)}`;
    return logicalTarget;
  }
  const absolute = path.join(ROOT, ledgerRecord.output_path);
  let relative = path.relative(path.dirname(outputFile), absolute).replaceAll("\\", "/");
  if (!relative.startsWith(".")) relative = `./${relative}`;
  return relative;
};

const prepareScope = ($, inputScope, { contentId, source, outputFile }) => {
  const scope = inputScope.clone();

  scope.find("h1").each((_, element) => {
    const heading = $(element);
    heading.replaceWith(`<h2>${heading.html() ?? ""}</h2>`);
  });

  scope.find(".sqs-audio-embed[data-asset-url]").each((_, element) => {
    const player = $(element);
    const assetUrl = player.attr("data-asset-url");
    const title = normaliseSpace(player.attr("data-title")) || "Audio";
    player.replaceWith(`<audio controls src="${assetUrl}" title="${title}"></audio>`);
  });

  scope.find(".sqs-native-video[data-config-video]").each((_, element) => {
    const wrapper = $(element);
    try {
      const config = JSON.parse(wrapper.attr("data-config-video"));
      const variants = String(config.systemDataVariants ?? "")
        .split(",")
        .map((entry) => Number.parseInt(entry.split(":")[0], 10))
        .filter(Number.isFinite)
        .sort((a, b) => b - a);
      const sourceUrl = String(config.alexandriaUrl ?? "").replace("{variant}", String(variants[0] ?? 1080));
      if (sourceUrl) {
        const title = normaliseSpace(config.title || config.filename) || "Video";
        registerAsset({
          raw: sourceUrl,
          base: source,
          contentId,
          alt: title,
          role: "native_video",
          sourceTemplate: config.alexandriaUrl ?? null,
          sourceVariants: config.systemDataVariants ?? null
        });
        wrapper.replaceWith(`<video controls src="${sourceUrl}" title="${title}"></video>`);
      }
    } catch {
      wrapper.replaceWith("<p><em>Legacy video requires manual review.</em></p>");
    }
  });

  scope.find(".sqs-video-wrapper[data-html]").each((_, element) => {
    const wrapper = $(element);
    const embeddedHtml = wrapper.attr("data-html");
    if (!embeddedHtml) return;
    const $embed = load(embeddedHtml);
    const iframeSource = $embed("iframe").attr("src");
    if (!iframeSource) return;
    let destination = iframeSource.startsWith("//") ? `https:${iframeSource}` : iframeSource;
    try {
      const embedly = new URL(destination);
      destination = embedly.searchParams.get("url") || embedly.searchParams.get("src") || destination;
      destination = decodeURIComponent(destination);
    } catch {
      // Preserve the directly embedded URL if the legacy wrapper is malformed.
    }
    wrapper.replaceWith(`<p><a href="${destination}">Video on ${providerLabelForUrl(destination, wrapper.attr("data-provider-name"))}</a></p>`);
  });

  scope.find([
    "style", "script", "noscript", "template", "svg", ".sqs-block-spacer",
    ".blog-item-comments", ".blog-item-author-profile-wrapper", ".share-buttons"
  ].join(",")).remove();

  scope.find("img").each((_, element) => {
    const image = $(element);
    const raw = image.attr("data-image") || image.attr("data-src") || image.attr("src");
    if (raw) {
      const candidate = new URL(raw, source);
      const extension = path.extname(candidate.pathname).toLowerCase();
      if (["www.robbewulgaert.be", "robbewulgaert.be"].includes(candidate.hostname.toLowerCase()) && !mediaExtensions.has(extension)) {
        image.remove();
        return;
      }
    }
    const caption = normaliseSpace(image.closest("figure").find("figcaption").first().text()) || null;
    const asset = registerAsset({
      raw,
      base: source,
      contentId,
      alt: image.attr("alt"),
      caption,
      role: "inline_image"
    });
    if (!asset) {
      if (raw) image.attr("src", new URL(raw, source).href);
      else image.remove();
      return;
    }
    image.attr("src", asset.migrated ? markdownAssetPath(asset.migrated, outputFile) : asset.url);
    image.removeAttr("srcset").removeAttr("data-srcset").removeAttr("data-src").removeAttr("data-image");
  });

  scope.find("audio, video").each((_, element) => {
    const media = $(element);
    const raw = media.attr("src") || media.find("source").first().attr("src");
    const asset = registerAsset({
      raw,
      base: source,
      contentId,
      alt: media.attr("title"),
      role: element.tagName
    });
    if (asset) media.attr("src", asset.migrated ? markdownAssetPath(asset.migrated, outputFile) : asset.url);
  });

  scope.find("a[href]").each((_, element) => {
    const anchor = $(element);
    const originalRaw = anchor.attr("href");
    if (!originalRaw || /^(?:mailto|tel|#)/i.test(originalRaw)) return;
    let raw = originalRaw.trim()
      .replace(/^\/\s+/, "/")
      .replace(/data\.europa\.\s+eu/gi, "data.europa.eu");
    if (!/^(?:https?:|\/)/i.test(raw) && /\s/.test(raw)) {
      anchor.replaceWith(anchor.contents());
      return;
    }
    try {
      const url = new URL(raw, source);
      if (["www.robbewulgaert.be", "robbewulgaert.be"].includes(url.hostname.toLowerCase())) {
        const aliases = new Map([["/contact-english", "/contactinfo"], ["/english", "/about"], ["/over", "/"], ["/info", "/contact"]]);
        const targetPath = aliases.get(url.pathname) ?? url.pathname;
        const targetRecord = recordByPath.get(targetPath);
        const isRenderable = ["article", "page", "tag_archive"].includes(targetRecord?.classification) ||
          ["/", "/about", "/boek", "/contact", "/contactinfo", "/onderwijs", "/education", "/projects", "/verkoopsvoorwaarden", "/onderwijs/workshops-en-nascholingen"].includes(targetPath);
        const isExcludedFocus = /(?:foto(?:grafie)?|video(?:grafie)?)/i.test(targetPath);
        if (!isRenderable || isExcludedFocus) {
          anchor.replaceWith(anchor.contents());
          return;
        }
        anchor.attr("href", `${targetPath}${url.search}${url.hash}`);
      } else {
        anchor.attr("href", url.href);
      }
    } catch {
      // Turndown will retain the original value for malformed legacy links.
    }
  });

  scope.find("a[href]").each((_, element) => {
    const anchor = $(element);
    if (!normaliseSpace(anchor.text()) && anchor.find("img, audio, video").length === 0) anchor.remove();
  });

  return scope;
};

const toMarkdown = ($, scope, context) => {
  const prepared = prepareScope($, scope, context);
  return turndown.turndown(prepared.html() ?? "")
    .replaceAll(/\[(!\[[^\]]*\]\([^)]+\))\s*\]\(([^)]+)\)/g, "[$1]($2)")
    .replaceAll(/https:\/\/www\.robbewulgaert\.be\/education\/\s+predicting-the-past-aeneas/gi,
      "[https://www.robbewulgaert.be/education/predicting-the-past-aeneas](/education/predicting-the-past-aeneas)")
    .replaceAll(/^([ \t]*(?:-[ \t]+)?)#{4,6}[ \t]+/gm, "$1### ")
    .replaceAll(/[ \t]+\n/g, "\n")
    .replaceAll(/\n{3,}/g, "\n\n")
    .trim();
};

const frontmatterDocument = (data, body) => {
  const yaml = stringifyYaml(data, {
    lineWidth: 0,
    defaultStringType: "QUOTE_DOUBLE",
    defaultKeyType: "PLAIN"
  }).trimEnd();
  return `---\n${yaml}\n---\n\n${body.trim()}\n`;
};

const workshopAccordionStarts = [0, 4, 8, 12, 17, 22, 27, 32, 37, 42, 46, 51];
// User decision recorded 2026-09-20: for Schrijftaken zonder AIAIAI, 2 hours
// is authoritative. The source snapshot conflicts (1.5h header/body; 2.0h
// practical accordion); normalize this one record while retaining this note.
const applyConfirmedWorkshopDuration = (data, body) => {
  if (data.id !== "source-workshop-schrijftaken-zonder-aiaiai-981050bd") return body;
  const decisionNote = "<!-- Duration confirmed by the user on 2026-09-20: 2 hours is authoritative; source header/body previously stated 1.5 hours. -->";
  const alternateDecisionNote = "<!-- Duration confirmed by the user on 2026-09-20; 2 hours is authoritative. -->";
  const normalizeHours = (value) => String(value ?? "").replace(/1\.5\s*uur/g, "2 uur").replace(/2\.0\s*uur/g, "2 uur");
  data.excerpt = normalizeHours(data.excerpt);
  data.seo.description = normalizeHours(data.seo.description);
  data.duration_minutes = 120;
  data.duration_display = "Type: Workshop - Duurtijd: 2 uur";
  data.summary = normalizeHours(data.summary);
  for (const key of ["location_notes"]) data[key] = normalizeHours(data[key]);
  for (const key of ["price", "travel_cost", "group_size"]) data[key].display = normalizeHours(data[key].display);
  data.source_details = data.source_details.map((detail) => ({
    ...detail,
    html: normalizeHours(detail.html),
    text: normalizeHours(detail.text)
  }));
  const normalizedBody = normalizeHours(body).replaceAll(decisionNote, "").replaceAll(alternateDecisionNote, "").trim();
  return `${decisionNote}\n\n${normalizedBody}`;
};
const extractWorkshopSourceDetails = ($, items, index, { contentId, source, outputFile }) => {
  const end = workshopAccordionStarts[index + 1] ?? 56;
  return items.slice(workshopAccordionStarts[index], end).map((el) => {
    const item = $(el);
    const heading = normaliseSpace(item.find(".accordion-item__title").text());
    const description = item.find(".accordion-item__description").first();
    const sourceText = normaliseSpace(description.text());
    const clean = prepareScope($, description, { contentId, source, outputFile });
    clean.find("*").addBack().each((_, node) => {
      const element = $(node);
      for (const attribute of Object.keys(element.attr() ?? {})) {
        if (!(node.tagName === "a" && attribute === "href")) element.removeAttr(attribute);
      }
      if (node.tagName === "a" && /^https?:/i.test(element.attr("href") ?? "")) element.attr("rel", "noreferrer");
    });
    const html = clean.html()?.trim() ?? "";
    const renderedText = normaliseSpace(load(html).root().text());
    if (!heading || !sourceText || sourceText !== renderedText) throw new Error(`${contentId}: accordion text changed during sanitization`);
    return { heading, html, text: sourceText, volatile: /praktische|feedback/i.test(heading) };
  });
};

// Isolated, repeatable P07 repair path: touches only the 12 generated workshop
// records and deliberately bypasses the destructive full migration path below.
if (process.argv.includes("--p07-workshops-only")) {
  const source = recordByPath.get("/onderwijs/workshops-en-nascholingen");
  if (!source?.raw_path) throw new Error("Workshop catalogue snapshot is missing");
  const $ = load(await readFile(path.join(ROOT, source.raw_path), "utf8"));
  const root = $(".blog-item-content").first();
  const expected = [
    "Kennis in tijden van AI", "Putting the chat in ChatGPT", "Schrijftaken zonder AIAIAI",
    "AI in de Klas - van lesmateriaal tot leerlijn", "ChatGPT: Een (Vergiftigd) Geschenk voor Leraar en Leerling?",
    "AI en taaltechnologie: hoe ga je er effectief mee aan de slag in je taalles?", "AI in de Klas: Van A tot Zwerfvuil",
    "Python in de Klas", "AI en Latijn - Breng Tacitus Tot Leven", "Latijnse Inscripties en AI - op tocht met Aeneas",
    "Grieks en AI - een knap duo", "Minecraft & Klassieke Talen"
  ];
  const allItems = root.find(".accordion-item").toArray();
  const items = allItems.slice(0, 56);
  const names = root.find("h3").map((_, el) => normaliseSpace($(el).text())).get().filter((x) => x && x !== "In de media");
  if (JSON.stringify(names) !== JSON.stringify(expected) || allItems.length !== 59 || items.length !== 56) throw new Error("P07 source workshop/accordion order mismatch");
  for (let index = 0; index < expected.length; index += 1) {
    const title = expected[index];
    const slug = slugify(title);
    const file = path.join(GENERATED_ROOTS.workshops, `${slug}-${shortHash(title).slice(0, 8)}.md`);
    const original = await readFile(file, "utf8");
    const match = original.match(/^---\n([\s\S]*?)\n---\n\n([\s\S]*)$/);
    if (!match) throw new Error(`${file}: invalid existing workshop document`);
    const data = parseYaml(match[1]);
    if (data.title !== title || data.id !== `source-workshop-${slug}-${shortHash(title).slice(0, 8)}`) throw new Error(`${file}: source title/id mismatch`);
    const sourceDetails = extractWorkshopSourceDetails($, items, index, { contentId: data.id, source: source.url, outputFile: file });
    const section = (prefix) => sourceDetails.find((detail) => detail.heading.toLocaleLowerCase("nl").startsWith(prefix.toLocaleLowerCase("nl")))?.text ?? "";
    const practicalSource = section("Praktische");
    const goalsSource = section("Doelen");
    data.programme = section("Programma");
    data.goals = { knowledge: goalsSource ? [goalsSource] : [], skills: [], attitudes: [] };
    data.target_audience = section("Doelgroep");
    data.location_notes = practicalSource;
    data.price = { amount_eur: null, includes_vat: /incl\.\s*BTW/i.test(practicalSource) ? true : null, display: practicalSource };
    data.travel_cost = { amount_per_km_eur: null, public_transport_policy: null, display: practicalSource };
    data.group_size = { minimum: null, maximum: null, display: practicalSource };
    data.delivery_modes = [...new Set([/online/i.test(practicalSource) && "online", /fysiek|op locatie|individuele school/i.test(practicalSource) && "on_site", /CNO/i.test(practicalSource) && "cno"].filter(Boolean))];
    data.source_details = sourceDetails;
    const body = applyConfirmedWorkshopDuration(data, match[2]);
    await writeFile(file, frontmatterDocument(data, body));
    console.log(`${title}: ${sourceDetails.length} source accordion sections`);
  }
  console.log("P07 workshop extraction updated 12 workshop records only.");
  process.exit(0);
}

const writeDocument = async (collection, filename, data, body) => {
  const outputFile = path.join(GENERATED_ROOTS[collection], filename);
  await writeFile(outputFile, frontmatterDocument(data, body));
  return outputFile;
};

const commonData = ({ id, title, slug, locale, sourceRecord = null, canonicalPath, excerpt = null, migrationStatus = "transformed" }) => ({
  id,
  title,
  slug,
  locale,
  translation_key: null,
  status: "review",
  source_url: sourceRecord?.url ?? null,
  source_html_sha256: sourceRecord?.sha256 ?? null,
  migration_status: migrationStatus,
  created_at: null,
  updated_at: null,
  published_at: null,
  author: "robbe-wulgaert",
  excerpt: normaliseSpace(excerpt) || null,
  hero: null,
  seo: {
    title: nullableSeo(title, 70),
    description: nullableSeo(excerpt, 180),
    canonical_path: canonicalPath,
    image: null,
    noindex: true
  }
});

for (const directory of Object.values(GENERATED_ROOTS)) {
  await rm(directory, { recursive: true, force: true });
  await mkdir(directory, { recursive: true });
}

const pageDefinitions = [
  ["/", "home"],
  ["/about", "profile"],
  ["/boek", "book"],
  ["/contact", "contact"],
  ["/contactinfo", "contact"],
  ["/onderwijs", "education"],
  ["/education", "education"],
  ["/projects", "projects"],
  ["/verkoopsvoorwaarden", "generic"]
];
const pageTitleOverrides = new Map([
  ["/onderwijs", "Onderwijs"],
  ["/education", "Education"],
  ["/projects", "Projects"]
]);
const pageRecords = [];

for (const [pathname, template] of pageDefinitions) {
  const sourceRecord = recordByPath.get(pathname);
  if (!sourceRecord?.raw_path || sourceRecord.crawl_status !== "snapshotted") {
    throw new Error(`Missing source snapshot for page ${pathname}`);
  }
  const source = sourceRecord.url;
  const html = await readFile(path.join(ROOT, sourceRecord.raw_path), "utf8");
  const $ = load(html);
  const locale = localeForPath(pathname);
  const rawTitle = $("h1").first().text() || $("title").first().text() || (pathname === "/" ? "Robbe Wulgaert" : pathname);
  const title = pageTitleOverrides.get(pathname) ?? cleanSiteTitle(rawTitle);
  let description = $("meta[name='description']").attr("content") ?? null;
  const slug = pathname === "/" ? "home" : slugify(pathname.split("/").at(-1));
  const id = `source-page-${slug}`;
  const outputFile = path.join(GENERATED_ROOTS.pages, `${slug}.md`);
  const scope = $("main article").first();
  scope.find("form, [data-definition-name='website.components.form']").remove();
  if (["/onderwijs", "/education", "/projects"].includes(pathname)) {
    scope.find(".summary-block, .summary-v2-block").remove();
  }
  if (pathname === "/projects") {
    scope.find(".sqs-html-content").filter((_, element) =>
      /^(?:Photography|Videography)$/i.test(normaliseSpace($(element).text()))
    ).closest(".sqs-block").remove();
  }
  let body = toMarkdown($, scope, { contentId: id, source, outputFile });
  if (!body) body = description || title;
  if (pathname === "/") {
    description = "Leraar, auteur en onderzoeker rond programmeren, artificiële intelligentie, Design Thinking en AI-geletterdheid in het onderwijs.";
    body = body
      .replace(/^##\s+Hoi, ik ben Robbe!/m, "# Hoi, ik ben Robbe!")
      .replace("Copyright: Elka Pannier (De Standaard)", "Robbe Wulgaert in een klaslokaal, foto Elka Pannier voor De Standaard")
      .replace("[**_AI inde klas_** _-_ **_Praktischegidsvooronderwijsprofessionals_**]", "[**_AI in de klas – Praktische gids voor onderwijsprofessionals_**]")
      .replace(/!\[\]\(([^)]+948800[^)]+)\)/, "![Robbe Wulgaert toont het boek AI in de klas]($1)");
  }
  if (pathname === "/about") {
    description = "Teacher, author and researcher working on programming, artificial intelligence, Design Thinking and AI literacy in education.";
    body = body
      .replace(/In my spare time I am endlessly fascinated by education, photography and \(anamorphic\) videography\.[\s\S]*?Who knows\?/i,
        "My work focuses on education, programming, artificial intelligence and Design Thinking.")
      .replace(/\n\* \* \*\n\n## Videography[\s\S]*$/i, "")
      .trim();
    body += "\n\n[Contact me about education and technology projects.](/contactinfo)";
  }
  if (pathname === "/contact") {
    description = "Neem contact op met Robbe over onderwijs, lesmateriaal, workshops en projecten.";
    body = replaceContactFormCopy(body.replace(/fotograf\w*|videograf\w*|cameraman/gi, "onderwijsprojecten")).trim();
  }
  if (pathname === "/contactinfo") {
    description = "Get in contact with Robbe about education, learning materials, workshops and technology projects.";
    body = "Would you like to collaborate on education, learning materials, a workshop or a technology project?\n\nUse the form above. The button opens a prefilled email in your default mail app.";
  }
  if (pathname === "/projects") {
    description = "Educational coding, AI, design-thinking and STEM projects by Robbe Wulgaert.";
    body = "The educational project catalogue below is generated from the approved project records.";
  }
  if (["/onderwijs", "/education"].includes(pathname)) {
    body = locale === "en"
      ? "Browse the migrated English articles below."
      : "Bekijk hieronder de gemigreerde Nederlandstalige artikels.";
  }
  const ogAsset = registerAsset({
    raw: $("meta[property='og:image']").attr("content"),
    base: source,
    contentId: id,
    role: "seo_image"
  });
  const data = {
    ...commonData({ id, title, slug, locale, sourceRecord, canonicalPath: pathname, excerpt: description }),
    template,
    navigation: [],
    call_to_actions: []
  };
  if (ogAsset?.migrated) data.seo.image = ogAsset.id;
  if (pathname === "/") data.translation_key = "profile-home";
  if (pathname === "/about") data.translation_key = "profile-home";
  if (["/contact", "/contactinfo"].includes(pathname)) data.translation_key = "contact";
  if (["/onderwijs", "/education"].includes(pathname)) data.translation_key = "education-index";
  await writeFile(outputFile, frontmatterDocument(data, body));
  pageRecords.push({ id, pathname, locale, migration_status: data.migration_status, source_hash: sourceRecord.sha256 });
}

const actualArticleRecords = manifest.pages.filter((record) =>
  record.classification === "article" && record.crawl_status === "snapshotted"
);
if (actualArticleRecords.length !== 124) {
  throw new Error(`Expected 124 semantic articles, found ${actualArticleRecords.length}`);
}
const articlePaths = new Set(actualArticleRecords.map(({ url }) => new URL(url).pathname));
const taxonomyMembership = new Map([...articlePaths].map((pathname) => [pathname, { tags: new Set(), categories: new Set() }]));
const unresolvedTaxonomy = [];

for (const archive of manifest.pages.filter(({ classification }) => classification === "tag_archive")) {
  const archiveUrl = new URL(archive.url);
  const isCategory = archiveUrl.pathname.includes("/category/");
  const marker = isCategory ? "/category/" : "/tag/";
  const rawLabel = archiveUrl.pathname.split(marker)[1] ?? "";
  const label = decodeURIComponent(rawLabel.replaceAll("+", " "));
  if (!archive.raw_path || archive.crawl_status !== "snapshotted") {
    unresolvedTaxonomy.push({ path: archiveUrl.pathname, label, type: isCategory ? "category" : "tag" });
    continue;
  }
  const html = await readFile(path.join(ROOT, archive.raw_path), "utf8");
  const $ = load(html);
  $("a[href]").each((_, element) => {
    try {
      const articlePath = new URL($(element).attr("href"), archive.url).pathname;
      const membership = taxonomyMembership.get(articlePath);
      if (membership) membership[isCategory ? "categories" : "tags"].add(label);
    } catch {
      // Ignore malformed archive links while preserving the archive itself in the route map.
    }
  });
}

const articleRecords = [];
const articleSearch = new Map();
for (const sourceRecord of actualArticleRecords.sort((a, b) => a.url.localeCompare(b.url))) {
  const source = sourceRecord.url;
  const pathname = new URL(source).pathname;
  const locale = localeForPath(pathname);
  const html = await readFile(path.join(ROOT, sourceRecord.raw_path), "utf8");
  const $ = load(html);
  const articleLd = $("script[type='application/ld+json']").map((_, element) => {
    try { return JSON.parse($(element).text()); } catch { return null; }
  }).get().find((value) => value?.["@type"] === "Article");
  if (!articleLd) throw new Error(`Missing Article JSON-LD for ${source}`);
  const title = normaliseSpace($("h1").first().text() || articleLd.headline || cleanSiteTitle($("title").text()));
  const sourceSlug = pathname.split("/").at(-1);
  const slug = slugify(sourceSlug);
  const id = `source-article-${shortHash(source)}`;
  const filename = `${locale === "en" ? "en" : "nl"}-${slug}-${shortHash(source).slice(0, 8)}.md`;
  const outputFile = path.join(GENERATED_ROOTS.articles, filename);
  const description = $("meta[name='description']").attr("content") ?? null;
  const body = suppressDeferredNativeVideoLinks(toMarkdown($, $(".blog-item-content").first(), { contentId: id, source, outputFile }));
  if (!body) throw new Error(`Blank article body for ${source}`);
  articleSearch.set(pathname, `${title}\n${body}`.toLocaleLowerCase(locale === "en" ? "en" : "nl"));

  const membership = taxonomyMembership.get(pathname);
  const externalLinks = new Map();
  $(".blog-item-content a[href]").each((_, element) => {
    const raw = $(element).attr("href");
    if (!raw) return;
    try {
      const url = new URL(raw, source);
      if (["www.robbewulgaert.be", "robbewulgaert.be"].includes(url.hostname.toLowerCase())) return;
      if (!/^https?:$/.test(url.protocol)) return;
      externalLinks.set(url.href, normaliseSpace($(element).text()) || url.hostname);
    } catch {
      // Ignore malformed source links in structured metadata; body conversion remains source-faithful.
    }
  });
  const downloadExtensions = /\.(?:csv|docx?|pdf|pptx?|xlsx?|zip)$/i;
  const downloads = [...externalLinks].filter(([url]) => downloadExtensions.test(new URL(url).pathname))
    .map(([url, label]) => ({ label, url }));
  const citations = [...externalLinks].filter(([url]) => !downloadExtensions.test(new URL(url).pathname))
    .map(([url, label]) => ({ label, url }));
  const paginationLink = (direction) => {
    const href = $(`.item-pagination-link--${direction}`).attr("href");
    if (!href) return null;
    try { return new URL(href, source).href; } catch { return null; }
  };
  const published = normaliseDate(articleLd.datePublished);
  const updated = normaliseDate(articleLd.dateModified);
  const data = {
    ...commonData({ id, title, slug, locale, sourceRecord, canonicalPath: pathname, excerpt: description }),
    created_at: published,
    updated_at: updated,
    published_at: published,
    tags: [...membership.tags].sort((a, b) => a.localeCompare(b)),
    categories: [...membership.categories].sort((a, b) => a.localeCompare(b)),
    featured: false,
    previous_source_url: paginationLink("prev"),
    next_source_url: paginationLink("next"),
    gallery: [],
    downloads,
    citations
  };
  const ogAsset = registerAsset({
    raw: $("meta[property='og:image']").attr("content"),
    base: source,
    contentId: id,
    role: "seo_image"
  });
  if (ogAsset?.migrated) data.seo.image = ogAsset.id;
  await writeFile(outputFile, frontmatterDocument(data, body));
  articleRecords.push({
    id,
    pathname,
    locale,
    title,
    published_at: published,
    migration_status: data.migration_status,
    tags: data.tags.length,
    categories: data.categories.length,
    body_characters: body.length,
    needs_seo_review: !data.seo.title || !data.seo.description
  });
}

for (const archive of unresolvedTaxonomy) {
  const locale = archive.path.startsWith("/education/") ? "en" : "nl";
  const needle = archive.label.replace(/^#/, "").toLocaleLowerCase(locale);
  for (const record of articleRecords.filter((article) => article.locale === (locale === "en" ? "en" : "nl-BE"))) {
    if (!articleSearch.get(record.pathname)?.includes(needle)) continue;
    const membership = taxonomyMembership.get(record.pathname);
    membership[archive.type === "category" ? "categories" : "tags"].add(archive.label);
  }
}

// Re-write only records changed by derived membership for the two unavailable tag snapshots.
if (unresolvedTaxonomy.length) {
  for (const filename of await readdir(GENERATED_ROOTS.articles)) {
    const file = path.join(GENERATED_ROOTS.articles, filename);
    const source = await readFile(file, "utf8");
    const match = source.match(/^---\n([\s\S]*?)\n---\n\n([\s\S]*)$/);
    if (!match) continue;
    const data = parseYaml(match[1]);
    const pathname = data.seo.canonical_path;
    const membership = taxonomyMembership.get(pathname);
    data.tags = [...membership.tags].sort((a, b) => a.localeCompare(b));
    data.categories = [...membership.categories].sort((a, b) => a.localeCompare(b));
    await writeFile(file, frontmatterDocument(data, match[2]));
    const inventoryRecord = articleRecords.find((record) => record.pathname === pathname);
    inventoryRecord.tags = data.tags.length;
    inventoryRecord.categories = data.categories.length;
  }
}

const taxonomyRoutes = manifest.pages
  .filter(({ classification }) => classification === "tag_archive")
  .map((archive) => {
    const pathname = new URL(archive.url).pathname;
    const isCategory = pathname.includes("/category/");
    const marker = isCategory ? "/category/" : "/tag/";
    const label = decodeURIComponent((pathname.split(marker)[1] ?? "").replaceAll("+", " "));
    const field = isCategory ? "categories" : "tags";
    const articles = articleRecords
      .filter(({ pathname: articlePath }) => taxonomyMembership.get(articlePath)?.[field].has(label))
      .map(({ pathname: articlePath }) => articlePath)
      .sort();
    return {
      path: pathname,
      locale: localeForPath(pathname),
      type: isCategory ? "category" : "tag",
      label,
      articles,
      source_status: archive.crawl_status
    };
  })
  .sort((a, b) => a.path.localeCompare(b.path));
await writeFile(TAXONOMY_ROUTES_PATH, `${JSON.stringify(taxonomyRoutes, null, 2)}\n`);

const workshopSource = recordByPath.get("/onderwijs/workshops-en-nascholingen");
if (!workshopSource?.raw_path) throw new Error("Workshop catalogue snapshot is missing");
const workshopHtml = await readFile(path.join(ROOT, workshopSource.raw_path), "utf8");
const $workshops = load(workshopHtml);
const workshopRoot = $workshops(".blog-item-content").first();
const workshopBlocks = workshopRoot.find(".sqs-html-content").toArray();
// Squarespace accordion components are siblings of `.sqs-html-content`, not descendants.
// Keep their source order paired with the 12 h3 offering titles recorded in P07.
const allWorkshopAccordionItems = workshopRoot.find(".accordion-item").toArray();
const workshopAccordionItems = allWorkshopAccordionItems.slice(0, 56);
const accordionOfferingTitles = [
  "Kennis in tijden van AI", "Putting the chat in ChatGPT", "Schrijftaken zonder AIAIAI",
  "AI in de Klas - van lesmateriaal tot leerlijn", "ChatGPT: Een (Vergiftigd) Geschenk voor Leraar en Leerling?",
  "AI en taaltechnologie: hoe ga je er effectief mee aan de slag in je taalles?", "AI in de Klas: Van A tot Zwerfvuil",
  "Python in de Klas", "AI en Latijn - Breng Tacitus Tot Leven", "Latijnse Inscripties en AI - op tocht met Aeneas",
  "Grieks en AI - een knap duo", "Minecraft & Klassieke Talen"
];
if (allWorkshopAccordionItems.length !== 59 || workshopAccordionItems.length !== 56) throw new Error(`Expected 56 offering and 3 general accordion items, found ${workshopAccordionItems.length} and ${allWorkshopAccordionItems.length - workshopAccordionItems.length}`);
const offeringNames = workshopRoot.find("h3").map((_, element) => normaliseSpace($workshops(element).text()))
  .get().filter((title) => title && title !== "In de media");
if (offeringNames.length !== 12) throw new Error(`Expected 12 workshops, found ${offeringNames.length}`);
const offeringStarts = offeringNames.map((title) => workshopBlocks.findIndex((block) =>
  $workshops(block).find("h3").toArray().some((heading) => normaliseSpace($workshops(heading).text()) === title)
));
if (JSON.stringify(offeringNames) !== JSON.stringify(accordionOfferingTitles)) {
  throw new Error("Workshop offering title/order does not match the verified accordion mapping");
}

const workshopRecords = [];
for (let index = 0; index < offeringNames.length; index += 1) {
  const title = offeringNames[index];
  const start = offeringStarts[index];
  const end = offeringStarts[index + 1] === undefined ? workshopBlocks.length : offeringStarts[index + 1];
  const selected = workshopBlocks.slice(start, end);
  const wrapperHtml = `<div>${selected.map((block) => $workshops.html(block)).join("\n")}</div>`;
  const $entry = load(wrapperHtml);
  const slug = slugify(title);
  const id = `source-workshop-${slug}-${shortHash(title).slice(0, 8)}`;
  const outputFile = path.join(GENERATED_ROOTS.workshops, `${slug}-${shortHash(title).slice(0, 8)}.md`);
  const body = toMarkdown($entry, $entry("div").first(), {
    contentId: id,
    source: workshopSource.url,
    outputFile
  });
  const headerDetails = normaliseSpace($entry("h3").first().nextAll("h4").first().text());
  const sectionText = (label) => {
    const heading = $entry("h4").toArray().find((element) =>
      normaliseSpace($entry(element).text()).toLocaleLowerCase("nl").startsWith(label.toLocaleLowerCase("nl"))
    );
    if (!heading) return "";
    const values = [];
    let sibling = heading.nextSibling;
    while (sibling && !["h3", "h4"].includes(sibling.tagName)) {
      values.push($entry.html(sibling));
      sibling = sibling.nextSibling;
    }
    return normaliseSpace(load(`<div>${values.join("")}</div>`)("div").text());
  };
  const programme = sectionText("Programma");
  const goalsText = sectionText("Doelen");
  const targetAudience = sectionText("Doelgroep");
  const practical = sectionText("Praktische");
  const sourceDetails = extractWorkshopSourceDetails($workshops, workshopAccordionItems, index, {
    contentId: id, source: workshopSource.url, outputFile
  });
  const detailText = (prefix) => sourceDetails.find((detail) => detail.heading.toLocaleLowerCase("nl").startsWith(prefix.toLocaleLowerCase("nl")))?.text ?? "";
  const practicalSource = detailText("Praktische");
  const goalsSource = detailText("Doelen");
  const durationMatches = [...`${headerDetails} ${practical}`.matchAll(/(\d+(?:[.,]\d+)?)\s*uur/gi)]
    .map((match) => Number.parseFloat(match[1].replace(",", ".")) * 60);
  const uniqueDurations = [...new Set(durationMatches)];
  const hasKeynote = /keynote/i.test(headerDetails);
  const hasWorkshop = /workshop/i.test(headerDetails);
  const workshopType = hasKeynote && hasWorkshop ? "other" : hasKeynote ? "keynote" : hasWorkshop ? "workshop" : "other";
  const deliveryModes = [
    /online/i.test(`${headerDetails} ${practical}`) && "online",
    /fysiek|op locatie|school/i.test(`${headerDetails} ${practical}`) && "on_site",
    /CNO/i.test(practical) && "cno"
  ].filter(Boolean);
  const data = {
    ...commonData({
      id,
      title,
      slug,
      locale: "nl-BE",
      sourceRecord: workshopSource,
      canonicalPath: "/onderwijs/workshops-en-nascholingen",
      excerpt: programme || headerDetails,
      migrationStatus: "needs_review"
    }),
    workshop_type: workshopType,
    duration_minutes: uniqueDurations.length === 1 ? Math.round(uniqueDurations[0]) : null,
    duration_display: headerDetails,
    summary: programme || normaliseSpace(body).slice(0, 500),
    programme: detailText("Programma") || programme,
    goals: { knowledge: goalsSource ? [goalsSource] : goalsText ? [goalsText] : [], skills: [], attitudes: [] },
    target_audience: detailText("Doelgroep") || targetAudience,
    prerequisites: [],
    delivery_modes: [...new Set(deliveryModes)],
    location_notes: practicalSource || practical,
    price: { amount_eur: null, includes_vat: /incl\.\s*BTW/i.test(practicalSource) ? true : null, display: practicalSource || practical },
    travel_cost: { amount_per_km_eur: null, public_transport_policy: null, display: practicalSource || practical },
    group_size: { minimum: null, maximum: null, display: practicalSource || practical },
    booking_cta: { label: "Neem contact op", href: "/contact", style: "primary" },
    source_details: sourceDetails
  };
  const normalizedBody = applyConfirmedWorkshopDuration(data, body);
  await writeFile(outputFile, frontmatterDocument(data, normalizedBody));
  workshopRecords.push({ id, title, migration_status: data.migration_status, duration_display: data.duration_display });
}

const projectTitles = {
  blockly: "Blockly",
  javascript_in_de_klas: "JavaScript in de Klas",
  html_in_de_klas: "HTML in de Klas",
  delphi: "Python in Delphi",
  smartplants: "SmartPlants",
  robothand: "Project Robothand",
  projectwind: "Project Wind",
  slimme_vuilnisbak: "Project Slimme Vuilnisbak",
  projectfijnstof: "Project Fijnstof"
};
const projectFamilies = {
  blockly: "platform",
  javascript_in_de_klas: "platform",
  html_in_de_klas: "platform",
  delphi: "platform",
  smartplants: "research",
  robothand: "steam_project",
  projectwind: "research",
  slimme_vuilnisbak: "steam_project",
  projectfijnstof: "research"
};
const projectRecords = [];
for (const project of orchestrator.authoritative_sources.design_sources) {
  const slug = slugify(project.id);
  const title = projectTitles[project.id] ?? project.id;
  const id = `source-project-${slug}`;
  const body = normaliseSpace(project.role);
  const data = {
    ...commonData({
      id,
      title,
      slug,
      locale: "en",
      sourceRecord: null,
      canonicalPath: "/projects",
      excerpt: body
    }),
    external_url: project.public_url,
    repository_url: `https://github.com/${project.repository}`,
    project_family: projectFamilies[project.id] ?? "other",
    target_age: null,
    technologies: [],
    learning_goals: [],
    privacy_profile: null,
    hardware: [],
    featured: true
  };
  await writeDocument("projects", `${slug}.md`, data, body);
  projectRecords.push({ id, title, external_url: data.external_url, migration_status: data.migration_status });
}
if (projectRecords.length !== 9) throw new Error(`Expected 9 project records, found ${projectRecords.length}`);

const aboutPage = recordByPath.get("/about");
const aboutGenerated = await readFile(path.join(GENERATED_ROOTS.pages, "about.md"), "utf8");
const aboutBody = (aboutGenerated.match(/^---\n[\s\S]*?\n---\n\n([\s\S]*)$/)?.[1]?.trim() || "Robbe Wulgaert")
  .replaceAll("../../../assets/", "../../assets/");
const authorData = {
  id: "robbe-wulgaert",
  name: "Robbe Wulgaert",
  slug: "robbe-wulgaert",
  locale: "nl-BE",
  translation_key: null,
  status: "review",
  source_url: aboutPage.url,
  source_html_sha256: aboutPage.sha256,
  migration_status: "transformed",
  created_at: null,
  updated_at: null,
  published_at: null,
  portrait: null,
  social_links: [],
  seo: { title: null, description: null, canonical_path: null, image: null, noindex: true }
};
await writeFile(path.join(CONTENT_ROOT, "authors", "robbe-wulgaert.md"), frontmatterDocument(authorData, aboutBody));

const serialisedCandidates = [...assetCandidates.values()].map((candidate) => ({
  ...candidate,
  roles: [...candidate.roles].sort(),
  used_by: [...candidate.used_by].sort(),
  alt_candidates: [...candidate.alt_candidates].sort(),
  caption_candidates: [...candidate.caption_candidates].sort()
})).sort((a, b) => a.source_url.localeCompare(b.source_url));
await writeFile(ASSET_CANDIDATES_PATH, `${JSON.stringify({
  schema_version: "1.0.0",
  generated_at: generatedAt,
  candidates: serialisedCandidates
}, null, 2)}\n`);

const inventory = {
  schema_version: "1.0.0",
  generated_at: generatedAt,
  status: "transformed_pending_owner_review",
  counts: {
    pages: pageRecords.length,
    articles: articleRecords.length,
    workshops: workshopRecords.length,
    projects: projectRecords.length,
    authors: 1,
    body_bearing_total: pageRecords.length + articleRecords.length + workshopRecords.length + projectRecords.length + 1,
    source_buttons: migratedButtonCount,
    asset_candidates: serialisedCandidates.length,
    unresolved_taxonomy_snapshots: unresolvedTaxonomy.length
  },
  pages: pageRecords,
  articles: articleRecords,
  workshops: workshopRecords,
  projects: projectRecords,
  unresolved_taxonomy: unresolvedTaxonomy,
  asset_migration: {
    candidates: serialisedCandidates.length,
    downloaded_url_records: assetLedger.filter(({ status }) => status === "downloaded").length,
    failed_url_records: assetLedger.filter(({ status }) => status === "error").length,
    unique_downloaded_binaries: new Set(assetLedger.filter(({ status }) => status === "downloaded").map(({ sha256: hash }) => hash)).size,
    alt_review_url_records: assetLedger.filter(({ status, requires_alt_review: needsReview }) => status === "downloaded" && needsReview).length,
    rights_review_url_records: assetLedger.filter(({ status, needs_rights_review: needsReview }) => status === "downloaded" && needsReview).length
  },
  route_rendering: {
    logical_html_routes: 381,
    windows_html_outputs: 364,
    case_insensitive_collision_groups: 17,
    case_sensitive_parity_review: "P7"
  },
  exclusions: manifest.pages.filter(({ disposition }) => disposition?.startsWith("excluded_")).map(({ url, disposition }) => ({ url, disposition }))
};
await writeFile(INVENTORY_PATH, `${JSON.stringify(inventory, null, 2)}\n`);

const csvCell = (value) => {
  const text = value === null || value === undefined ? "" : String(value);
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
};
const reviewRows = [["id", "kind", "record", "reason", "status"]];
for (const article of articleRecords.filter(({ needs_seo_review }) => needs_seo_review)) {
  reviewRows.push([`P5-SEO-${shortHash(article.pathname).slice(0, 8)}`, "seo", article.pathname, "Source title or description is absent or exceeds the target SEO field limit.", "pending"]);
}
for (const workshop of workshopRecords) {
  reviewRows.push([`P5-WORKSHOP-${shortHash(workshop.id).slice(0, 8)}`, "workshop", workshop.title, "Verify structured duration, price, location, travel and group-size variants against the lossless body.", "pending"]);
}
for (const asset of assetLedger.filter(({ status }) => status === "error")) {
  reviewRows.push([
    `P5-MEDIA-${shortHash(asset.source_url).slice(0, 8)}`,
    "media",
    asset.source_url,
    `The owned source media could not be downloaded after retries: ${asset.error || "unknown error"}`,
    "pending"
  ]);
}
const altReviewCount = assetLedger.filter(({ status, requires_alt_review: needsReview }) => status === "downloaded" && needsReview).length;
const rightsReviewCount = assetLedger.filter(({ status, needs_rights_review: needsReview }) => status === "downloaded" && needsReview).length;
reviewRows.push(["P5-MEDIA-ALT-001", "media_accessibility", `${altReviewCount} downloaded media URL records`, "Source alt text was blank, filename-like, or contextually inconsistent; review without guessing decorative status.", "pending"]);
reviewRows.push(["P5-MEDIA-RIGHTS-001", "media_rights", `${rightsReviewCount} downloaded media URL records`, "Local preservation is complete; confirm publication rights before approving records for release.", "pending"]);
reviewRows.push(["P5-TAXONOMY-001", "taxonomy", "two HTTP-429 tag archives", "Membership was derived by matching the preserved article text because the raw archive snapshots are unavailable.", "pending"]);
await writeFile(REVIEW_PATH, `${reviewRows.map((row) => row.map(csvCell).join(",")).join("\n")}\n`);

console.log(JSON.stringify(inventory.counts, null, 2));
