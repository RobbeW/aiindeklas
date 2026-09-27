import {
  buildPatchBundle,
  createArticleDraft,
  duplicateArticle,
  getPath,
  setPath,
  splitList,
  validateCmsRecord
} from "../lib/cms-studio-core.mjs";

type CmsCollection = "articles" | "workshops";

interface CmsRecord {
  collection: CmsCollection;
  file: string;
  original_sha256: string | null;
  data: Record<string, any>;
  body: string;
}

interface MediaOption {
  id: string;
  label: string;
  requires_alt_review: boolean;
  needs_rights_review: boolean;
}

interface CmsPayload {
  schema: string;
  records: CmsRecord[];
  media: MediaOption[];
}

const root = document.querySelector<HTMLElement>("[data-cms-studio]");
if (!root) throw new Error("CMS Studio root is missing");

const query = <T extends Element>(selector: string) => {
  const element = root.querySelector<T>(selector);
  if (!element) throw new Error(`CMS Studio control is missing: ${selector}`);
  return element;
};

const ui = {
  list: query<HTMLUListElement>("[data-record-list]"),
  loading: query<HTMLElement>("[data-loading]"),
  count: query<HTMLElement>("[data-result-count]"),
  heading: query<HTMLElement>("[data-editor-heading]"),
  recordStatus: query<HTMLElement>("[data-record-status]"),
  empty: query<HTMLElement>("[data-editor-empty]"),
  form: query<HTMLFormElement>("[data-editor-form]"),
  preview: query<HTMLElement>("[data-preview]"),
  validation: query<HTMLElement>("[data-validation]"),
  dirty: query<HTMLElement>("[data-dirty]"),
  duplicate: query<HTMLButtonElement>("[data-action='duplicate']"),
  validate: query<HTMLButtonElement>("[data-action='validate']"),
  export: query<HTMLButtonElement>("[data-action='export']"),
  year: query<HTMLSelectElement>("[data-filter='year']")
};

let allRecords: CmsRecord[] = [];
let mediaOptions: MediaOption[] = [];
let selected: CmsRecord | null = null;
let activeCollection: CmsCollection = "articles";
let isDirty = false;

const clone = <T>(value: T): T => structuredClone(value);
const valueFor = (value: unknown) => value === null || value === undefined ? "" : String(value);
const escapeHtml = (value: unknown) => String(value ?? "")
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;");

const field = (
  label: string,
  path: string,
  options: { type?: string; kind?: string; wide?: boolean; help?: string; rows?: number; choices?: Array<[string, string]> } = {}
) => {
  if (!selected) return "";
  const { type = "text", kind = "string", wide = false, help = "", rows = 0, choices = [] } = options;
  const raw = getPath(selected.data, path);
  const value = kind === "list" ? (Array.isArray(raw) ? raw.join("\n") : "") : valueFor(raw);
  const classes = wide ? "studio-field--wide" : "";
  const helpText = help ? `<span class="studio-help">${escapeHtml(help)}</span>` : "";

  if (type === "checkbox") {
    return `<label class="studio-checkbox ${classes}"><input type="checkbox" data-field="${path}" data-kind="boolean" ${raw ? "checked" : ""} /><span>${escapeHtml(label)}</span></label>`;
  }
  if (type === "select") {
    const optionMarkup = choices.map(([optionValue, optionLabel]) =>
      `<option value="${escapeHtml(optionValue)}" ${optionValue === value ? "selected" : ""}>${escapeHtml(optionLabel)}</option>`
    ).join("");
    return `<label class="${classes}"><span>${escapeHtml(label)}</span><select data-field="${path}" data-kind="${kind}">${optionMarkup}</select>${helpText}</label>`;
  }
  if (type === "textarea" || rows > 0) {
    return `<label class="${classes}"><span>${escapeHtml(label)}</span><textarea rows="${rows || 5}" data-field="${path}" data-kind="${kind}">${escapeHtml(value)}</textarea>${helpText}</label>`;
  }
  const list = path === "seo.image" ? " list=\"cms-media-options\"" : "";
  return `<label class="${classes}"><span>${escapeHtml(label)}</span><input type="${type}" value="${escapeHtml(value)}" data-field="${path}" data-kind="${kind}"${list} />${helpText}</label>`;
};

const commonForm = () => `
  <fieldset class="studio-form-section">
    <legend>Basis</legend>
    ${field("Titel", "title", { wide: true })}
    ${field("Slug", "slug", { help: "Kleine letters, cijfers en koppeltekens." })}
    ${field("Taal", "locale", { type: "select", choices: [["nl-BE", "Nederlands"], ["en", "English"]] })}
    ${field("Status", "status", { type: "select", choices: [["draft", "Concept"], ["review", "Te beoordelen"], ["published", "Gepubliceerd"], ["archived", "Gearchiveerd"]] })}
    ${field("Publicatiedatum (ISO)", "published_at", { kind: "nullable-string" })}
    ${field("Samenvatting", "excerpt", { type: "textarea", kind: "nullable-string", wide: true, rows: 4 })}
  </fieldset>
  <fieldset class="studio-form-section">
    <legend>Zoeken en delen</legend>
    ${field("SEO-titel", "seo.title", { kind: "nullable-string" })}
    ${field("Canoniek pad", "seo.canonical_path")}
    ${field("SEO-beschrijving", "seo.description", { type: "textarea", kind: "nullable-string", wide: true, rows: 4 })}
    ${field("Thumbnail / media-ID", "seo.image", { kind: "nullable-string", wide: true, help: "Kies een bestaand media-ID. Rechten en alttekst blijven onderdeel van de P7-review." })}
    ${field("Niet laten indexeren", "seo.noindex", { type: "checkbox" })}
  </fieldset>`;

const articleForm = () => `
  ${commonForm()}
  <fieldset class="studio-form-section">
    <legend>Artikel</legend>
    ${field("Tags", "tags", { type: "textarea", kind: "list", rows: 4, help: "Eén tag per regel of gescheiden door komma's." })}
    ${field("Categorieën", "categories", { type: "textarea", kind: "list", rows: 4, help: "Eén categorie per regel of gescheiden door komma's." })}
    ${field("Uitgelicht", "featured", { type: "checkbox" })}
  </fieldset>
  <fieldset class="studio-form-section">
    <legend>Inhoud</legend>
    <label class="studio-field--wide"><span>Markdown</span><textarea rows="24" data-body>${escapeHtml(selected?.body)}</textarea><span class="studio-help">Gebruik Markdown voor koppen, lijsten, links en afbeeldingen.</span></label>
  </fieldset>`;

const workshopForm = () => `
  ${commonForm()}
  <fieldset class="studio-form-section">
    <legend>Workshop</legend>
    ${field("Type", "workshop_type", { type: "select", choices: [["keynote", "Keynote"], ["workshop", "Workshop"], ["training", "Training"], ["webinar", "Webinar"], ["trajectory", "Traject"], ["other", "Andere"]] })}
    ${field("Duur in minuten", "duration_minutes", { type: "number", kind: "nullable-integer" })}
    ${field("Duur zoals getoond", "duration_display", { wide: true })}
    ${field("Korte omschrijving", "summary", { type: "textarea", wide: true, rows: 5 })}
    ${field("Programma", "programme", { type: "textarea", wide: true, rows: 7 })}
    ${field("Doelgroep", "target_audience", { type: "textarea", wide: true, rows: 3 })}
    ${field("Locatie", "location_notes", { type: "textarea", wide: true, rows: 3 })}
    ${field("Werkvormen", "delivery_modes", { type: "textarea", kind: "list", wide: true, rows: 3, help: "Toegestaan: on_site, online, hybrid, cno, other." })}
  </fieldset>
  <fieldset class="studio-form-section">
    <legend>Leerdoelen</legend>
    ${field("Kennis", "goals.knowledge", { type: "textarea", kind: "list", rows: 5 })}
    ${field("Vaardigheden", "goals.skills", { type: "textarea", kind: "list", rows: 5 })}
    ${field("Attitudes", "goals.attitudes", { type: "textarea", kind: "list", rows: 5 })}
    ${field("Voorkennis", "prerequisites", { type: "textarea", kind: "list", rows: 5 })}
  </fieldset>
  <fieldset class="studio-form-section">
    <legend>Praktisch</legend>
    ${field("Prijs", "price.amount_eur", { type: "number", kind: "nullable-number" })}
    ${field("Prijsweergave", "price.display")}
    ${field("Btw inbegrepen", "price.includes_vat", { type: "select", kind: "nullable-boolean", choices: [["", "Onbekend"], ["true", "Ja"], ["false", "Nee"]] })}
    ${field("Reiskost per km", "travel_cost.amount_per_km_eur", { type: "number", kind: "nullable-number" })}
    ${field("Reiskostenweergave", "travel_cost.display")}
    ${field("Openbaarvervoerbeleid", "travel_cost.public_transport_policy", { kind: "nullable-string", wide: true })}
    ${field("Minimumgroep", "group_size.minimum", { type: "number", kind: "nullable-integer" })}
    ${field("Maximumgroep", "group_size.maximum", { type: "number", kind: "nullable-integer" })}
    ${field("Groepsgrootte zoals getoond", "group_size.display", { wide: true })}
    ${field("Knoptekst", "booking_cta.label")}
    ${field("Knoplink", "booking_cta.href")}
    ${field("Knopstijl", "booking_cta.style", { type: "select", choices: [["primary", "Primair"], ["secondary", "Secundair"], ["text", "Tekstlink"]] })}
  </fieldset>
  <fieldset class="studio-form-section">
    <legend>Inhoud</legend>
    <label class="studio-field--wide"><span>Markdown</span><textarea rows="24" data-body>${escapeHtml(selected?.body)}</textarea></label>
  </fieldset>`;

const renderForm = () => {
  if (!selected) return;
  ui.empty.hidden = true;
  ui.form.hidden = false;
  ui.heading.textContent = selected.data.title;
  ui.recordStatus.textContent = selected.data.status;
  ui.duplicate.disabled = selected.collection !== "articles";
  ui.validate.disabled = false;
  ui.export.disabled = false;
  ui.form.innerHTML = `${selected.collection === "articles" ? articleForm() : workshopForm()}
    <datalist id="cms-media-options">${mediaOptions.map((item) => `<option value="${escapeHtml(item.id)}">${escapeHtml(item.label)}</option>`).join("")}</datalist>`;
  renderPreview();
  showValidation(false);
};

const plainMarkdownFragment = (source: string) => {
  const fragment = document.createDocumentFragment();
  let list: HTMLUListElement | null = null;
  for (const rawLine of source.split(/\r?\n/).slice(0, 120)) {
    const line = rawLine.trim();
    if (!line) {
      list = null;
      continue;
    }
    const heading = line.match(/^(#{2,4})\s+(.+)$/);
    if (heading) {
      const element = document.createElement(heading[1].length === 2 ? "h2" : "h3");
      element.textContent = heading[2].replace(/[*_`]/g, "");
      fragment.append(element);
      list = null;
      continue;
    }
    const item = line.match(/^[-*]\s+(.+)$/);
    if (item) {
      if (!list) {
        list = document.createElement("ul");
        fragment.append(list);
      }
      const element = document.createElement("li");
      element.textContent = item[1].replace(/!\[([^\]]*)\]\([^)]*\)|\[([^\]]+)\]\([^)]*\)|[*_`]/g, "$1$2");
      list.append(element);
      continue;
    }
    const paragraph = document.createElement("p");
    paragraph.textContent = line.replace(/!\[([^\]]*)\]\([^)]*\)|\[([^\]]+)\]\([^)]*\)|[*_`]/g, "$1$2");
    fragment.append(paragraph);
    list = null;
  }
  return fragment;
};

const renderPreview = () => {
  if (!selected) return;
  ui.preview.replaceChildren();
  const meta = document.createElement("p");
  meta.className = "studio-preview-meta";
  meta.textContent = `${selected.collection === "articles" ? "Artikel" : "Workshop"} · ${selected.data.locale} · ${selected.data.status}`;
  const title = document.createElement("h1");
  title.textContent = selected.data.title || "Naamloos concept";
  const lead = document.createElement("p");
  lead.className = "studio-preview-lead";
  lead.textContent = selected.collection === "workshops"
    ? selected.data.summary || "Nog geen samenvatting."
    : selected.data.excerpt || selected.data.seo?.description || "Nog geen samenvatting.";
  ui.preview.append(meta, title, lead, plainMarkdownFragment(selected.body));
};

const showValidation = (announce = true) => {
  if (!selected) return false;
  const result = validateCmsRecord(selected);
  ui.validation.className = `studio-validation ${result.valid ? "studio-validation--ok" : "studio-validation--error"}`;
  ui.validation.replaceChildren();
  const heading = document.createElement("strong");
  heading.textContent = result.valid ? "Klaar voor patch-export." : `${result.errors.length} aandachtspunt${result.errors.length === 1 ? "" : "en"}`;
  ui.validation.append(heading);
  if (!result.valid) {
    const list = document.createElement("ul");
    for (const message of result.errors) {
      const item = document.createElement("li");
      item.textContent = message;
      list.append(item);
    }
    ui.validation.append(list);
  } else if (announce) {
    const note = document.createElement("p");
    note.textContent = "De Studio valideert de vorm; de lokale patch-opdracht controleert daarna ook het bronbestand en de repository.";
    ui.validation.append(note);
  }
  return result.valid;
};

const markDirty = () => {
  isDirty = true;
  ui.dirty.hidden = false;
};

const selectRecord = (record: CmsRecord) => {
  selected = clone(record);
  isDirty = false;
  ui.dirty.hidden = true;
  renderForm();
  renderRecordList();
};

const filterValue = (name: string) => query<HTMLInputElement | HTMLSelectElement>(`[data-filter='${name}']`).value;

const filteredRecords = () => {
  const search = filterValue("query").trim().toLocaleLowerCase("nl-BE");
  const locale = filterValue("locale");
  const status = filterValue("status");
  const year = filterValue("year");
  const sort = filterValue("sort");
  const records = allRecords.filter((record) => {
    if (record.collection !== activeCollection) return false;
    if (locale && record.data.locale !== locale) return false;
    if (status && record.data.status !== status) return false;
    if (year && !String(record.data.published_at ?? "").startsWith(year)) return false;
    if (search) {
      const haystack = [record.data.title, record.data.excerpt, record.data.summary, ...(record.data.tags ?? [])].join(" ").toLocaleLowerCase("nl-BE");
      if (!haystack.includes(search)) return false;
    }
    return true;
  });
  return records.sort((a, b) => {
    if (sort === "title") return a.data.title.localeCompare(b.data.title, a.data.locale);
    const left = String(a.data.published_at ?? "");
    const right = String(b.data.published_at ?? "");
    return sort === "oldest" ? left.localeCompare(right) : right.localeCompare(left);
  });
};

const renderRecordList = () => {
  const records = filteredRecords();
  ui.count.textContent = String(records.length);
  ui.list.replaceChildren();
  for (const record of records) {
    const item = document.createElement("li");
    const button = document.createElement("button");
    button.type = "button";
    button.ariaCurrent = selected?.data.id === record.data.id ? "true" : "false";
    const title = document.createElement("span");
    title.className = "studio-record-title";
    title.textContent = record.data.title;
    const meta = document.createElement("span");
    meta.className = "studio-record-meta";
    meta.textContent = `${record.data.locale} · ${record.data.status} · ${record.data.published_at?.slice(0, 10) ?? "zonder datum"}`;
    button.append(title, meta);
    button.addEventListener("click", () => selectRecord(record));
    item.append(button);
    ui.list.append(item);
  }
  if (records.length === 0) {
    const item = document.createElement("li");
    item.className = "studio-empty";
    item.textContent = "Geen items voor deze filters.";
    ui.list.append(item);
  }
};

const syncNewArticleIdentity = () => {
  if (!selected || selected.collection !== "articles" || selected.original_sha256) return;
  const slug = selected.data.slug;
  selected.file = `src/content/articles/drafts/${slug}.md`;
  selected.data.id = `draft-article-${slug}`;
  selected.data.seo.canonical_path = selected.data.locale === "en" ? `/education/${slug}` : `/onderwijs/${slug}`;
};

ui.form.addEventListener("input", (event) => {
  if (!selected || !(event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement || event.target instanceof HTMLSelectElement)) return;
  const target = event.target;
  if (target.matches("[data-body]")) {
    selected.body = target.value;
  } else {
    const path = target.dataset.field;
    if (!path) return;
    const kind = target.dataset.kind ?? "string";
    let value: unknown = target.value;
    if (kind === "boolean" && target instanceof HTMLInputElement) value = target.checked;
    if (kind === "list") value = splitList(target.value);
    if (kind === "nullable-string") value = target.value.trim() ? target.value : null;
    if (kind === "nullable-integer") value = target.value === "" ? null : Number.parseInt(target.value, 10);
    if (kind === "nullable-number") value = target.value === "" ? null : Number.parseFloat(target.value);
    if (kind === "nullable-boolean") value = target.value === "" ? null : target.value === "true";
    setPath(selected.data, path, value);
    if (["slug", "locale"].includes(path)) syncNewArticleIdentity();
  }
  selected.data.updated_at = new Date().toISOString();
  ui.heading.textContent = selected.data.title || "Naamloos concept";
  ui.recordStatus.textContent = selected.data.status;
  markDirty();
  renderPreview();
  showValidation(false);
});

for (const tab of root.querySelectorAll<HTMLButtonElement>("[data-collection]")) {
  tab.addEventListener("click", () => {
    activeCollection = tab.dataset.collection as CmsCollection;
    for (const candidate of root.querySelectorAll<HTMLButtonElement>("[data-collection]")) {
      candidate.ariaSelected = String(candidate === tab);
    }
    renderRecordList();
  });
}

for (const filter of root.querySelectorAll<HTMLInputElement | HTMLSelectElement>("[data-filter]")) {
  filter.addEventListener("input", renderRecordList);
}

query<HTMLButtonElement>("[data-action='new-article']").addEventListener("click", () => {
  activeCollection = "articles";
  for (const tab of root.querySelectorAll<HTMLButtonElement>("[data-collection]")) {
    tab.ariaSelected = String(tab.dataset.collection === "articles");
  }
  selectRecord(createArticleDraft() as CmsRecord);
  markDirty();
});

ui.duplicate.addEventListener("click", () => {
  if (!selected || selected.collection !== "articles") return;
  selectRecord(duplicateArticle(selected));
  markDirty();
});

ui.validate.addEventListener("click", () => showValidation(true));

ui.export.addEventListener("click", () => {
  if (!selected || !showValidation(true)) return;
  const bundle = buildPatchBundle(selected);
  const blob = new Blob([`${JSON.stringify(bundle, null, 2)}\n`], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `cms-${selected.collection.slice(0, -1)}-${selected.data.slug}.patch.json`;
  anchor.click();
  URL.revokeObjectURL(url);
  isDirty = false;
  ui.dirty.hidden = true;
});

window.addEventListener("beforeunload", (event) => {
  if (!isDirty) return;
  event.preventDefault();
});

const initialise = async () => {
  try {
    const response = await fetch(root.dataset.contentEndpoint ?? "");
    if (!response.ok) throw new Error(`Contentindex gaf HTTP ${response.status}`);
    const payload = await response.json() as CmsPayload;
    if (payload.schema !== "robbew-cms-content/v1") throw new Error("Onbekend contentindex-formaat");
    allRecords = payload.records;
    mediaOptions = payload.media;
    const years = [...new Set(allRecords.map((record) => String(record.data.published_at ?? "").slice(0, 4)).filter(Boolean))].sort().reverse();
    for (const year of years) ui.year.add(new Option(year, year));
    ui.loading.remove();
    renderRecordList();
  } catch (error) {
    ui.loading.className = "studio-message studio-message--error";
    ui.loading.textContent = `De contentindex kon niet worden geladen: ${error instanceof Error ? error.message : String(error)}`;
  }
};

void initialise();
