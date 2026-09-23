import { readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { load } from "cheerio";
import { parse as parseYaml } from "yaml";
import { outputFileForLogicalPath } from "./validate-built-site.mjs";

const root = fileURLToPath(new URL("../", import.meta.url));
const repo = resolve(root, "..");
const manifest = parseYaml(await readFile(join(repo, "docs/implementation/manifests/content.yaml"), "utf8"));
const errors = [];
const pages = manifest.content_records.pages;
const workshops = manifest.content_records.workshops;
const expectedPaths = ["/", "/about", "/boek", "/contact", "/contactinfo", "/onderwijs", "/education", "/projects", "/verkoopsvoorwaarden"];
const expectedTitles = ["Kennis in tijden van AI", "Putting the chat in ChatGPT", "Schrijftaken zonder AIAIAI", "AI in de Klas - van lesmateriaal tot leerlijn", "ChatGPT: Een (Vergiftigd) Geschenk voor Leraar en Leerling?", "AI en taaltechnologie: hoe ga je er effectief mee aan de slag in je taalles?", "AI in de Klas: Van A tot Zwerfvuil", "Python in de Klas", "AI en Latijn - Breng Tacitus Tot Leven", "Latijnse Inscripties en AI - op tocht met Aeneas", "Grieks en AI - een knap duo", "Minecraft & Klassieke Talen"];
const check = (ok, message) => { if (!ok) errors.push(message); };
check(pages.length === 9, `Expected 9 static pages, got ${pages.length}`);
check(expectedPaths.every((p) => pages.some((r) => r.current_path === p)), "Static page routes do not reconcile");
check(workshops.length === 12, `Expected 12 workshop records, got ${workshops.length}`);
const all = [...pages, ...workshops];
for (const record of all) {
  const file = resolve(repo, record.source_path);
  const source = await readFile(file, "utf8");
  const match = source.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  check(Boolean(match), `${record.id}: missing frontmatter`);
  if (!match) continue;
  const data = parseYaml(match[1]);
  check(data.id === record.id, `${record.id}: source id mismatch`);
  check(data.title === record.title, `${record.id}: source title mismatch`);
  check(data.source_html_sha256 === record.source_artifacts.source_html_sha256, `${record.id}: source hash mismatch`);
  check(data.status === "review" && data.seo.noindex === true, `${record.id}: review/noindex posture changed`);
  if (record.type === "workshop") {
    const details = data.source_details ?? [];
    check(details.length >= 4 && details.every((d) => d.heading && d.html && d.text), `${record.id}: source accordion sections missing/incomplete`);
    check(details.some((d) => /praktische/i.test(d.heading) && d.volatile), `${record.id}: practical section is not marked volatile`);
    if (record.id === "source-workshop-schrijftaken-zonder-aiaiai-981050bd") {
      check(data.duration_minutes === 120 && data.duration_display === "Type: Workshop - Duurtijd: 2 uur", "Schrijftaken duration is not the user-confirmed 2 hours");
      check(data.excerpt?.includes("2 uur") && data.seo.description?.includes("2 uur") && data.summary?.includes("2 uur"), "Schrijftaken summary/SEO fields do not consistently state 2 hours");
      check(![data.excerpt, data.seo.description, data.duration_display, data.summary].some((value) => /1\.5\s*uur/i.test(value ?? "")), "Schrijftaken generated display retains the superseded 1.5-hour value");
    }
    if (details.some((d) => /feedback/i.test(d.heading))) check(details.find((d) => /feedback/i.test(d.heading)).volatile, `${record.id}: feedback claim is not marked volatile`);
  }
}
check(workshops.every((w) => w.collection_path === "/onderwijs/workshops-en-nascholingen"), "Workshop route metadata mismatch");
const pricing = manifest.key_content.pricing_blocks;
check(pricing.length === 13, `Expected 13 pricing evidence records, got ${pricing.length}`);
check(pricing.every((x) => x.volatile === true && x.verify_live_before_release === true), "Pricing evidence must all be marked volatile and pending live verification");
const business = manifest.key_content.business_volatile_blocks;
check(business.length === 4 && business.every((x) => x.verify_live_before_release === true), "Four volatile business pages must be marked for live verification");
const contact = pages.find((x) => x.current_path === "/contact");
check(contact?.key_content.forms?.some((f) => f.transformed_status === "missing" && f.follow_up.includes("P09")), "Source contact form P09 dependency missing");

const sourcePath = join(root, "migration/raw-html/onderwijs-workshops-en-nascholingen-d77751bd6cae.html");
const $ = load(await readFile(sourcePath, "utf8"));
const accordion = $(".accordion-item").toArray();
const starts = [0, 4, 8, 12, 17, 22, 27, 32, 37, 42, 46, 51];
const accordionHeadings = starts.map((start) => $(accordion[start]).find(".accordion-item__title").text().trim());
check(accordion.length === 59, `Expected 56 workshop and 3 general accordion items, got ${accordion.length}`);
check(accordionHeadings.every((heading) => heading === "Programma"), "Expected each mapped offering block to start with Programma");
const accordionGroups = starts.map((start, i) => accordion.slice(start, starts[i + 1] ?? 56).map((el) => $(el).find(".accordion-item__title").text().trim()));
check(accordionGroups.length === 12 && accordionGroups.every((g) => ["Programma", "Doelen", "Doelgroep"].every((x) => g.includes(x)) && g.some((x) => /praktische/i.test(x))), "One or more workshop source sections were omitted");
for (let i = 0; i < expectedTitles.length; i += 1) {
  const record = workshops.find((w) => w.title === expectedTitles[i]);
  if (!record) { errors.push(`Missing manifest workshop ${expectedTitles[i]}`); continue; }
  const source = resolve(repo, record.source_path);
  const sourceDoc = parseYaml((await readFile(source, "utf8")).match(/^---\r?\n([\s\S]*?)\r?\n---/)[1]);
  const persisted = sourceDoc.source_details ?? [];
  const sourceItems = accordion.slice(starts[i], starts[i + 1] ?? 56);
  const norm = (s) => String(s ?? "").replace(/\s+/g, " ").trim();
  const hrefs = (html) => load(html)("a[href]").toArray().map((a) => load(html)(a).attr("href")).sort();
  check(persisted.length === sourceItems.length, `${record.id}: source section count differs from preserved snapshot`);
  const sourceSection = (prefix) => persisted.find((detail) => detail.heading.toLocaleLowerCase("nl").startsWith(prefix.toLocaleLowerCase("nl")))?.text ?? "";
  check(sourceDoc.programme === sourceSection("Programma"), `${record.id}: programme field differs from source accordion`);
  check(sourceDoc.goals.knowledge.includes(sourceSection("Doelen")), `${record.id}: goals field does not preserve source accordion text`);
  check(sourceDoc.target_audience === sourceSection("Doelgroep"), `${record.id}: audience field differs from source accordion`);
  const practical = sourceSection("Praktische");
  check(sourceDoc.price.display === practical && sourceDoc.travel_cost.display === practical && sourceDoc.group_size.display === practical && sourceDoc.location_notes === practical, `${record.id}: practical fields differ from source wording`);
  for (let j = 0; j < Math.min(persisted.length, sourceItems.length); j += 1) {
    const raw = $(sourceItems[j]);
    const saved = persisted[j];
    check(saved.heading === norm(raw.find(".accordion-item__title").text()), `${record.id}: section ${j + 1} heading mismatch`);
    const rawText = norm(raw.find(".accordion-item__description").text());
    const expectedText = record.id === "source-workshop-schrijftaken-zonder-aiaiai-981050bd" && /^praktische/i.test(saved.heading)
      ? rawText.replace(/2\.0\s*uur/g, "2 uur")
      : rawText;
    check(norm(saved.text) === expectedText, `${record.id}: section ${j + 1} text mismatch`);
    check(JSON.stringify(hrefs(saved.html)) === JSON.stringify(hrefs(raw.find(".accordion-item__description").html() ?? "")), `${record.id}: section ${j + 1} source href mismatch`);
  }
}

const builtArg = process.argv.find((x) => x.startsWith("--built="));
let built = null;
if (builtArg) {
  const base = process.argv.find((x) => x.startsWith("--base="))?.slice(7) ?? "/";
  const dist = resolve(root, builtArg.slice(8));
  const file = outputFileForLogicalPath("/onderwijs/workshops-en-nascholingen", dist);
  try {
    const html = await readFile(file, "utf8");
    const $built = load(html);
    const sections = $built("article[data-workshop-id]");
    const builtIds = $built("[id]").toArray().map((el) => $built(el).attr("id"));
    check(new Set(builtIds).size === builtIds.length, `Built ${base} workshop route has duplicate autogenerated heading ids`);
    const links = $built('nav[aria-label="Spring naar een workshop"] a[href^="#"]');
    check(sections.length === 12, `Built ${base} output has ${sections.length} detailed workshop sections`);
    check(links.length === 12, `Built ${base} output has ${links.length} workshop index links`);
    const minecraft = $built('[data-workshop-id="source-workshop-minecraft-en-klassieke-talen-0d14e1d3"]');
    const rateText = minecraft.text();
    check(["300 euro", "450 euro", "BTW", "verplaatsingskosten", "1 à 1.5 uur", "één dagdeel, 2.5 uur à 3 uur", "te bespreken!"].every((s) => rateText.includes(s)), "Built Minecraft shared rates differ from source wording");
    check(minecraft.find('[data-verification="pending-live-verification-before-release"]').length > 0, "Built shared prices lack pending-live-verification marker");
    check($built('meta[name="robots"][content*="noindex"]').length === 1, "Built workshop route lost noindex");
    for (const link of links.toArray()) check($built(link).attr("href")?.startsWith("#"), "Workshop jump link is not local to route");
    check($built("[data-source-section='Feedback Deelnemers'][data-verification='pending-live-verification-before-release']").length > 0, "Built feedback claims lack verification markers");
    if (base !== "/") check($built('a[href="/contact"]').length === 0, "Project-base route contains unprefixed internal source link");
    built = { base, file, detailed_workshops: sections.length, index_links: links.length, pricing_source_marker: true, noindex: true };
  } catch (error) { errors.push(`Built output unavailable or unreadable for ${base}: ${error.message}`); }
}

const report = { schema: "website-migration.p07-static-business-integrity/v1", status: errors.length ? "failed" : "verified_with_live_checks_pending", static_pages: pages.length, workshop_records: workshops.length, workshop_accordion_groups: accordionGroups.length, workshop_accordion_headings: accordionHeadings, unrelated_general_accordion_excluded: accordion.length - 56, pricing_records: pricing.length, volatile_business_pages: business.map((x) => x.record_id), contact_form_source_fields: ["first name", "last name", "email", "question"], contact_form_follow_up: "P09", duration_decisions: [{ record_id: "source-workshop-schrijftaken-zonder-aiaiai-981050bd", duration_minutes: 120, confirmed_by: "user", confirmed_on: "2026-09-20", provenance: "Source heading/body stated 1.5 hours; practical accordion stated 2.0 hours. User confirmed 2 hours as authoritative; generated variants are normalized to 2 hours." }], source_discrepancies: ["P01 summarized rates but omitted workshop accordion commercial facts; reconciled in P07.", "Schrijftaken source duration variants (1.5h heading/body; 2.0h practical accordion) were resolved by user confirmation on 2026-09-20; 2 hours is authoritative.", "Participant feedback and ratings are volatile source claims and require live verification."], p01_section_detail_gap: "P01 captured high-level workshop rates but omitted per-workshop accordion service facts; P07 reconciles the 12 source blocks.", built, errors };
const reportPath = join(root, "migration/reports/P07-static-business-integrity.json");
await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report, null, 2));
if (errors.length) process.exitCode = 1;
