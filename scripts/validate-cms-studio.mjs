import { readFile } from "node:fs/promises";
import { load } from "cheerio";

const dist = new URL("../dist/", import.meta.url);
const readDist = (path) => readFile(new URL(path, dist), "utf8");

const adminHtml = await readDist("admin.html");
const admin = load(adminHtml);
const content = JSON.parse(await readDist("admin/content.json"));
const onderwijs = load(await readDist("onderwijs.html"));

const errors = [];
if (admin("[data-cms-studio]").length !== 1) errors.push("CMS Studio root is missing");
const endpoint = admin("[data-cms-studio]").attr("data-content-endpoint");
const basePrefix = endpoint === "/admin/content.json" ? "" : endpoint === "/aiindeklas/admin/content.json" ? "/aiindeklas" : null;
if (basePrefix === null) errors.push("CMS Studio content endpoint is not base aware");
if (admin("meta[name='robots']").attr("content") !== "noindex, nofollow") errors.push("CMS Studio must remain noindex");
if (!admin("[data-action='new-article']").length) errors.push("New article action is missing");
if (!admin("[data-action='export']").length) errors.push("Patch export action is missing");
if (content.schema !== "robbew-cms-content/v1") errors.push("CMS content endpoint schema is invalid");
if (content.records.filter((record) => record.collection === "articles").length !== 124) errors.push("CMS article inventory is incomplete");
if (content.records.filter((record) => record.collection === "workshops").length !== 12) errors.push("CMS workshop inventory is incomplete");
if (content.media.length !== 829) errors.push("CMS media selector inventory is incomplete");
if (content.records.some((record) => !/^src\/content\/(articles|workshops)\//.test(record.file))) errors.push("CMS contains an unsafe target path");

const cards = onderwijs("article.listing-card").length;
const thumbnails = onderwijs("article.listing-card img").length;
if (onderwijs("h1").first().text().trim() !== "Onderwijs") errors.push("Onderwijs listing title is incorrect");
if (cards !== 78) errors.push(`Expected 78 Dutch onderwijs cards, found ${cards}`);
if (thumbnails === 0) errors.push("Onderwijs cards still have no thumbnails");
if (onderwijs("article.listing-card img:not([loading='lazy'])").length) errors.push("A thumbnail is missing lazy loading");
if (basePrefix !== null && onderwijs("article.listing-card img").toArray().some((image) => !onderwijs(image).attr("src")?.startsWith(`${basePrefix}/_astro/`))) {
  errors.push("A thumbnail is not base aware");
}

if (errors.length) throw new Error(errors.join("\n"));
console.log(JSON.stringify({
  status: "pass",
  cms_records: content.records.length,
  articles: 124,
  workshops: 12,
  media_options: content.media.length,
  onderwijs_cards: cards,
  onderwijs_thumbnails: thumbnails
}, null, 2));
