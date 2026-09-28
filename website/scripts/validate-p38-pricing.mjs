import { readdir, readFile } from "node:fs/promises";
import { parse } from "yaml";

const root = new URL("../src/content/workshops/generated/", import.meta.url);
const approved = "Prijs op aanvraag. Inhoud workshop / keynote kan altijd besproken worden.";
const forbidden = /(?:€|\beuro\b|\bprijs\s*per\s*km\b|\bkilomet(?:er|ers)\b|verplaatsingskosten|reiskosten|prijslijst|kostprijs)/i;
const files = (await readdir(root)).filter((name) => name.endsWith(".md"));
const failures = [];
for (const file of files) {
  const text = await readFile(new URL(file, root), "utf8");
  const match = text.match(/^---\n([\s\S]*?)\n---/);
  const data = match ? parse(match[1]) : {};
  if (data.price?.display !== approved) failures.push(`${file}: price.display mismatch`);
  if (data.travel_cost?.display !== approved) failures.push(`${file}: travel_cost.display mismatch`);
  if (data.location_notes?.includes(approved) !== true) failures.push(`${file}: location_notes missing approved sentence`);
  const practical = (data.source_details ?? []).find((detail) => /praktische|prijslijst/i.test(detail.heading));
  if (!practical?.text?.includes(approved) || !/<p>|<ul>/i.test(practical.html ?? "")) failures.push(`${file}: practical detail incomplete`);
  if (!text.includes(approved)) failures.push(`${file}: missing approved sentence`);
  if (forbidden.test(text)) failures.push(`${file}: stale public pricing wording`);
}
const experience = await readFile(new URL("../src/components/workshop/WorkshopExperience.tsx", import.meta.url), "utf8");
if ((experience.match(/contactLink\(offer, answers\)/g) ?? []).length !== 1 || !/AccordionItem value="praktische-info"[\s\S]*?AccordionContent[\s\S]*?contactLink\(offer, answers\)/.test(experience)) failures.push("WorkshopExperience: practical CTA contract failed");
if (!/url\.searchParams\.set\("offer_id", offer\.id\)[\s\S]*?url\.searchParams\.set\("offer", offer\.title\)/.test(experience)) failures.push("WorkshopExperience: offer prefill contract failed");
const css = await readFile(new URL("../src/styles/global.css", import.meta.url), "utf8");
if (!/\.ui-button\s*\{[^}]*min-height:44px/.test(css)) failures.push("shared ui-button is not 44px");
const distRoot = new URL("../dist/", import.meta.url);
const distFiles = [];
const walk = async (url) => { for (const name of await readdir(url, { withFileTypes: true })) { const safeName = encodeURIComponent(name.name); const next = new URL(`${safeName}${name.isDirectory() ? "/" : ""}`, url); if (name.isDirectory()) await walk(next); else if (name.name.endsWith(".html")) distFiles.push(next); } };
await walk(distRoot);
let builtWorkshopPages = 0;
for (const file of distFiles) { const html = await readFile(file, "utf8"); if (html.includes(approved)) { builtWorkshopPages += 1; if (forbidden.test(html)) failures.push(`${file.pathname}: stale built pricing wording`); } }
if (builtWorkshopPages === 0) failures.push("built output: no workshop page contains approved sentence");
if (files.length !== 10 || failures.length) throw new Error(failures.join("\n") || `expected 10 active workshops, found ${files.length}`);
console.log(JSON.stringify({ activeWorkshops: files.length, builtWorkshopPages, approvedSentence: approved, passed: true }));
