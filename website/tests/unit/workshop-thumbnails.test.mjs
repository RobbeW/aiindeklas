import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { readdir, stat } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { parse } from "yaml";
import sharp from "sharp";
import { resolveWorkshopThumbnail } from "../../src/lib/workshop-thumbnails.mjs";

const assetDir = new URL("../../src/assets/workshop-thumbnails/", import.meta.url);
const activeBrief = parse(readFileSync(new URL("../../docs/client_onboarding_workshop_finder.yaml", import.meta.url), "utf8"));
const activeIds = Object.keys(activeBrief.bookable_offers);
const sourceDimensions = {
  ai_en_taaltechnologie: [4172, 5562], ai_en_latijn_breng_tacitus_tot_leven: [3024, 4032],
  ai_in_de_klas_van_a_tot_zwerfvuil: [2160, 1280], ai_in_de_klas_van_lesmateriaal_tot_leerlijn: [1061, 591],
  kennis_in_tijden_van_ai: [1638, 2048], latijnse_inscripties_en_ai: [7000, 4667],
  minecraft_en_klassieke_talen: [720, 405], putting_the_chat_in_chatgpt: [1125, 737],
  python_in_de_klas: [7952, 5304], schrijftaken_zonder_aiaiai: [1287, 724],
};

test("maps artwork by an existing offer identifier", () => {
  const brief = parse(readFileSync(new URL("../../docs/client_onboarding_workshop_finder.yaml", import.meta.url), "utf8"));
  const id = Object.keys(brief.bookable_offers).find((key) => key === "kennis_in_tijden_van_ai");
  assert.ok(id, "fixture must use an approved catalogue identifier");
  const asset = { default: { src: "/thumb.webp" } };
  assert.deepEqual(resolveWorkshopThumbnail({ id, slug: "kennis-in-tijden-van-ai" }, { [`${id}.webp`]: asset }), asset);
});

test("missing artwork is safe", () => {
  assert.equal(resolveWorkshopThumbnail({ id: "offer-one", slug: "offer-one" }, {}), null);
});

test("ambiguous identifier and slug artwork fails loudly", () => {
  assert.throws(() => resolveWorkshopThumbnail({ id: "offer-one", slug: "offer-one-slug" }, {
    "offer-one.webp": {}, "offer-one-slug.png": {},
  }), /Ambiguous workshop thumbnail/);
});

test("all active offers have one decodable direct WebP without upscaling", async () => {
  assert.equal(activeIds.length, 10);
  const names = (await readdir(assetDir)).filter((name) => name.endsWith(".webp"));
  assert.deepEqual(names.sort(), activeIds.map((id) => `${id}.webp`).sort());
  assert.equal((await readdir(assetDir)).filter((name) => /\.(jpe?g|png)$/i.test(name)).length, 0);
  for (const id of activeIds) {
    const file = `${id}.webp`;
    const metadata = await sharp(fileURLToPath(new URL(file, assetDir))).metadata();
    assert.ok(metadata.width && metadata.height, `${file} must decode dimensions`);
    const [sourceWidth, sourceHeight] = sourceDimensions[id];
    assert.ok(metadata.width <= sourceWidth && metadata.height <= sourceHeight, `${file} was upscaled`);
    assert.ok(resolveWorkshopThumbnail({ id }, { [file]: { default: metadata } }), `${id} must resolve`);
  }
  assert.equal((await stat(new URL("../../dist/", import.meta.url))).isDirectory(), true);
  const distNames = (await readdir(new URL("../../dist/", import.meta.url), { recursive: true })).join("\n");
  assert.doesNotMatch(distNames, /chatgpt_een_\(vergiftigd\)|chatgpt-vergiftigd|vergiftigd/i);
});
