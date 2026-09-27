import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { resolve } from "node:path";
import { parse } from "yaml";
import { buildWorkshopCatalogue, rankWorkshopOffers } from "../src/lib/workshop-finder.mjs";

const root = resolve(import.meta.dirname, "..");
const readYaml = async (path) => parse(await readFile(resolve(root, path), "utf8"));
const readRecords = async (path) => Promise.all((await readdir(resolve(root, path)))
  .filter((file) => file.endsWith(".md") || file.endsWith(".mdx"))
  .map(async (file) => {
    const source = await readFile(resolve(root, path, file), "utf8");
    const frontmatter = source.match(/^---\r?\n([\s\S]*?)\r?\n---/);
    assert.ok(frontmatter, `${file} must contain YAML frontmatter`);
    return { data: parse(frontmatter[1]) };
  }));

const brief = await readYaml("docs/client_onboarding_workshop_finder.yaml");
const design = await readYaml("../../docs/workshop_onboarding_shadcn_prompt.yaml");
const [workshops, projects, articles] = await Promise.all([
  readRecords("src/content/workshops/generated"),
  readRecords("src/content/projects/generated"),
  readRecords("src/content/articles/generated"),
]);
const verifiedRoutes = [...new Set([...workshops, ...projects, ...articles]
  .map(({ data }) => data.seo?.canonical_path)
  .filter(Boolean))];
const catalogue = buildWorkshopCatalogue({
  catalogueBrief: brief,
  designBrief: design,
  workshops,
  projects,
  articles,
  verifiedRoutes,
});
const choice = { persona: "schoolleider_beleid", need: "breed_kader", duration: "ongeveer_90_min", groupSize: "tot_15" };
assert.equal(catalogue.offers.length, 12, "published catalogue integrity");
assert.ok(catalogue.offers.every((offer) => offer.source.title === offer.title), "every offer must resolve to an existing workshop record");
assert.ok(catalogue.offers.every((offer) => offer.route === "/onderwijs/workshops-en-nascholingen"), "offer routes must use verified canonical paths");
assert.ok(catalogue.offers.every((offer) => Object.hasOwn(brief.bookable_offers, offer.id)), "only declared bookable-offer records may become offers");
assert.equal(rankWorkshopOffers(catalogue, choice, brief)[0].id, "kennis_in_tijden_van_ai", "flagship ordering");
assert.equal(rankWorkshopOffers(catalogue, { ...choice, need: "vakspecifiek" }, brief).length, 0, "conditional subject required");
assert.equal(rankWorkshopOffers(catalogue, { ...choice, need: "vakspecifiek", subject: "geschiedenis" }, brief).length, 0, "no-match subject");
assert.equal(rankWorkshopOffers(catalogue, { ...choice, groupSize: "meer_dan_100" }, brief).length, 0, "unknown capacity group remains contact path");
const conflict = catalogue.offers.find((o) => o.id === "ai_en_taaltechnologie");
assert.equal(conflict.durationConflict, true, "duration conflict preserved");
assert.ok(conflict.durationEvidence?.routing_choice, "duration conflict evidence preserved");
const unknownCapacity = catalogue.offers.find((o) => o.id === "chatgpt_vergiftigd_geschenk");
assert.equal(unknownCapacity.formats[0].unknownCapacity, true, "unknown capacity remains explicit");
assert.ok(rankWorkshopOffers(catalogue, { ...choice, need: "praktisch_ai", duration: "flexibel" }, brief).length <= 3, "maximum three");
const related = catalogue.relatedFor(catalogue.offers.find((offer) => offer.id === "putting_the_chat_in_chatgpt"));
assert.equal(related.length, 2, "verified related content is capped at two");
assert.ok(related.every((item) => verifiedRoutes.includes(item.route)), "related routes must be verified canonical paths");
assert.deepEqual(catalogue.relatedFor(catalogue.offers.find((offer) => offer.id === "python_in_de_klas")), [], "offers without candidates return an empty list");
const projectOnly = buildWorkshopCatalogue({ catalogueBrief: brief, designBrief: design, workshops, projects, articles: [], verifiedRoutes });
assert.equal(projectOnly.relatedFor(catalogue.offers.find((offer) => offer.id === "ai_in_de_klas_van_a_tot_zwerfvuil"))[0]?.kind, "project", "declared non-bookable projects may be related links");
const unverified = buildWorkshopCatalogue({ catalogueBrief: brief, designBrief: design, workshops, projects, articles, verifiedRoutes: [] });
assert.equal(unverified.relatedFor(catalogue.offers[0]).length, 0, "unverified related routes omitted");
assert.ok(catalogue.offers.every((offer) => offer.image == null), "missing images remain empty instead of being invented");
console.log(JSON.stringify({ status: "passed", publishedOffers: catalogue.offers.length, verifiedRelated: related.length, maxResults: 3 }));
