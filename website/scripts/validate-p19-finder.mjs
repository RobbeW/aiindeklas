import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { load } from "cheerio";
import { rankWorkshopOffers } from "../src/lib/workshop-finder.mjs";

const html = readFileSync(resolve(import.meta.dirname, "../dist/onderwijs/workshops-en-nascholingen.html"), "utf8");
const $ = load(html);
const deserializeObject = (value) => typeof value !== "object" || value === null
  ? value
  : Object.fromEntries(Object.entries(value).map(([key, item]) => [key, deserializeTuple(item)]));
const deserializeArray = (value) => value.map(deserializeTuple);
const deserializeTuple = ([type, value]) => {
  if (type === 0) return deserializeObject(value);
  if (type === 1) return deserializeArray(value);
  throw new Error(`Unsupported Astro island value type ${type} in P19 finder data`);
};
const island = $("astro-island[component-url*='WorkshopExperience']");
assert.equal(island.length, 1, "the workshop experience must render as one Astro island");
assert.equal(island.attr("client"), "load", "the workshop experience must hydrate on load");
const serializedProps = island.attr("props");
assert.ok(serializedProps, "the workshop experience island must contain serialized props");
const props = deserializeObject(JSON.parse(serializedProps));
const data = props.data;
const rank = (choice) => rankWorkshopOffers({ offers: data.offers, relatedFor: (offer) => offer.related }, choice, data.ranking);
assert.equal(Object.keys(data.categoryLabels).length, 3, "all three offer categories must remain available");
assert.equal(data.offers.length, 12, "all twelve published sessions must be mapped");
assert.ok(data.offers.every((offer) => offer.published && !Object.hasOwn(offer, "price")));
assert.ok(data.offers.every((offer) => offer.source?.sourceDetails?.length > 0), "each recommendation must retain source details for its dialog or drawer");
assert.ok(!data.offers.some((offer) => offer.title === "Interview met de Geschiedenis"), "supporting projects cannot be bookable");
const choice = { persona: "schoolleider_beleid", need: "breed_kader", subject: "", duration: "ongeveer_90_min", groupSize: "31_100" };
const keynote = rank(choice);
assert.equal(keynote.length, 2);
assert.ok(keynote.every((result) => result.category === "keynote_inspiratie" && result.selectedFormat?.type === "keynote"));
assert.deepEqual(rank({ ...choice, groupSize: "meer_dan_100" }), []);
assert.ok(!rank({ ...choice, need: "praktisch_ai", groupSize: "31_100" })
  .some((result) => result.id === "putting_the_chat_in_chatgpt"), "published 30-person limit must filter the offer");
const history = { ...choice, need: "vakspecifiek", subject: "geschiedenis", groupSize: "tot_15" };
assert.deepEqual(rank(history), []);
assert.ok(data.offers.every((offer) => offer.related.length <= 2), "verified related content must remain capped at two items");
const writing = rank({ ...choice, need: "vakspecifiek", subject: "talen", duration: "ongeveer_2_uur", groupSize: "16_30" });
assert.ok(writing.some((result) => result.id === "schrijftaken_zonder_aiaiai" && result.durationConflict));
assert.ok(writing.length <= 3);
assert.equal($("[data-workshop-experience]").length, 1, "the server-rendered workshop experience must be present");
assert.equal($("[data-questionnaire-step='1']").length, 1, "the progressive questionnaire must start at step one");
assert.equal($("[data-questionnaire-step='1'] input[type='radio']").length, data.questions[0].options.length, "the first large-choice question must render all choices");
assert.equal($("[data-questionnaire-step='1'] progress").length, 1, "the questionnaire must render progress");
assert.equal(data.questions.filter((question) => question.conditionalNeed === "vakspecifiek").length, 1, "the subject question must remain conditional");
assert.match(props.contactHref, /\/contact$/, "the finder must retain its contact handoff");
assert.ok($("[data-contact-email-form]", readFileSync(resolve(import.meta.dirname, "../dist/contact.html"), "utf8")).length === 1);
console.log(JSON.stringify({ categories: 3, publishedOffers: data.offers.length, cases: 6, status: "passed" }, null, 2));
