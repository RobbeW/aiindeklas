import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { test } from "node:test";

const root = resolve(import.meta.dirname, "../..");
const source = (path) => readFile(resolve(root, path), "utf8");

test("P22 consumes the P21 catalogue instead of rebuilding it", async () => {
  const finder = await source("src/components/WorkshopFinder.astro");
  const experience = await source("src/components/workshop/WorkshopExperience.tsx");
  assert.match(finder, /buildWorkshopCatalogue/);
  assert.match(finder, /catalogueBrief[\s\S]*designBrief[\s\S]*verifiedRoutes/);
  assert.doesNotMatch(finder, /Object\.entries\(.*bookable_offers/);
  assert.match(experience, /rankWorkshopOffers/);
  assert.doesNotMatch(experience, /recommendWorkshops/);
});

test("P22 uses the approved component and responsive detail architecture", async () => {
  const experience = await source("src/components/workshop/WorkshopExperience.tsx");
  for (const component of ["QuestionnaireChoice", "QuestionnaireProgress", "AspectRatio", "Card", "Badge", "Accordion", "Dialog", "Drawer"])
    assert.match(experience, new RegExp(`\\b${component}\\b`), `missing ${component}`);
  assert.match(experience, /function WorkshopDetailContent/);
  assert.match(experience, /data-workshop-dialog/);
  assert.match(experience, /data-workshop-drawer/);
  assert.match(experience, /onCloseAutoFocus/);
  assert.match(experience, /\.slice\(0, 2\)/);
});

test("P22 keeps catalogue and contact handoff bounded", async () => {
  const experience = await source("src/components/workshop/WorkshopExperience.tsx");
  const collection = await source("src/components/WorkshopCollectionPage.astro");
  assert.match(experience, /data-catalogue-mode/);
  assert.match(experience, /Terug naar mijn aanbevelingen/);
  assert.match(experience, /offer_id/);
  assert.match(experience, /subject_area/);
  assert.match(experience, /workshop_request/);
  assert.doesNotMatch(experience, /type=["'](?:email|text)["']/);
  assert.doesNotMatch(collection, /workshops\.map/);
  assert.doesNotMatch(collection, /set:html/);
});
