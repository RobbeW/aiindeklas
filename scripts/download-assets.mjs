import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { copyFile, mkdir, readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import sharp from "sharp";
import { stringify as stringifyYaml } from "yaml";

const ROOT = process.cwd();
const CANDIDATES_PATH = path.join(ROOT, "migration", "asset-candidates.json");
const LEDGER_PATH = path.join(ROOT, "migration", "asset-ledger.json");
const LEDGER_CSV_PATH = path.join(ROOT, "migration", "asset-ledger.csv");
const ORIGINAL_ROOT = path.join(ROOT, "migration", "raw-assets", "original");
const OUTPUT_ROOT = path.join(ROOT, "src", "assets", "migrated");
const PUBLIC_MEDIA_ROOT = path.join(ROOT, "public", "media");
const MEDIA_PATH = path.join(ROOT, "src", "content", "media", "media.yaml");
const CONCURRENCY = Math.max(1, Math.min(8, Number.parseInt(process.env.ASSET_CONCURRENCY ?? "4", 10) || 4));

const candidates = JSON.parse(await readFile(CANDIDATES_PATH, "utf8")).candidates;
const candidateUrls = new Set(candidates.map(({ source_url: sourceUrl }) => sourceUrl));
let previous = [];
try { previous = JSON.parse(await readFile(LEDGER_PATH, "utf8")); } catch (error) {
  if (error?.code !== "ENOENT") throw error;
}
const ledger = new Map(previous.filter((record) => candidateUrls.has(record.source_url)).map((record) => [record.source_url, record]));

const repoPath = (value) => path.relative(ROOT, value).replaceAll("\\", "/");
const shaText = (value) => createHash("sha256").update(value).digest("hex");
const exists = async (value) => { try { await stat(value); return true; } catch { return false; } };
const fileSha = async (filename) => {
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(filename)) hash.update(chunk);
  return hash.digest("hex");
};
const mimeExtension = (mime, fallbackUrl) => {
  const table = new Map([
    ["image/avif", ".avif"], ["image/gif", ".gif"], ["image/jpeg", ".jpg"],
    ["image/png", ".png"], ["image/svg+xml", ".svg"], ["image/webp", ".webp"],
    ["audio/mpeg", ".mp3"], ["audio/mp4", ".m4a"], ["audio/wav", ".wav"],
    ["video/mp4", ".mp4"], ["video/quicktime", ".mov"], ["video/webm", ".webm"]
  ]);
  const fromMime = table.get(mime);
  if (fromMime) return fromMime;
  const fromUrl = path.extname(new URL(fallbackUrl).pathname).toLowerCase();
  return /^\.[a-z0-9]{2,5}$/.test(fromUrl) ? fromUrl : ".bin";
};
const filenameLike = (value) => /\.(?:avif|gif|jpe?g|png|svg|webp|mp4|mov|webm)$/i.test(value) || /^dsc[_-]?\d+/i.test(value);
const cleanAlt = (candidate) => String(candidate ?? "").replace(/\s+/g, " ").trim();
const csvCell = (value) => {
  const text = value === null || value === undefined ? "" : String(value);
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
};
const writeWithRetry = async (filename, value) => {
  let lastError;
  for (let attempt = 1; attempt <= 6; attempt += 1) {
    try {
      await writeFile(filename, value);
      return;
    } catch (error) {
      lastError = error;
      if (!["EBUSY", "EPERM", "UNKNOWN"].includes(error?.code) || attempt === 6) throw error;
      await new Promise((resolve) => setTimeout(resolve, attempt * 200));
    }
  }
  throw lastError;
};

const persist = async () => {
  const records = [...ledger.values()].sort((a, b) => a.source_url.localeCompare(b.source_url));
  await writeWithRetry(LEDGER_PATH, `${JSON.stringify(records, null, 2)}\n`);
  const rows = [["id", "source_url", "status", "sha256", "mime_type", "byte_size", "output_path", "error"]];
  for (const record of records) rows.push([
    record.id, record.source_url, record.status, record.sha256, record.mime_type,
    record.byte_size, record.output_path, record.error
  ]);
  await writeWithRetry(LEDGER_CSV_PATH, `${rows.map((row) => row.map(csvCell).join(",")).join("\n")}\n`);
};

const fetchToFile = async (url, temporary) => {
  let lastError;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const response = await fetch(url, {
        redirect: "follow",
        headers: { "user-agent": "RobbeWulgaert-local-migration/1.0" },
        signal: AbortSignal.timeout(120_000)
      });
      if (!response.ok || !response.body) throw new Error(`HTTP ${response.status}`);
      const mime = (response.headers.get("content-type") ?? "application/octet-stream").split(";")[0].toLowerCase();
      if (mime === "text/html" || mime === "text/plain") throw new Error(`Unexpected content type ${mime}`);
      await pipeline(Readable.fromWeb(response.body), await import("node:fs").then(({ createWriteStream }) => createWriteStream(temporary)));
      return mime;
    } catch (error) {
      lastError = error;
      await rm(temporary, { force: true });
      if (attempt < 3) await new Promise((resolve) => setTimeout(resolve, 500 * attempt));
    }
  }
  throw lastError;
};

const migrateCandidate = async (candidate) => {
  const cached = ledger.get(candidate.source_url);
  if (cached?.status === "error" && process.env.ASSET_RETRY_ERRORS !== "1") return cached;
  if (cached?.status === "downloaded" && await exists(path.join(ROOT, cached.output_path))) {
    if (!cached.mime_type.startsWith("image/") && !cached.output_path.startsWith("public/media/")) {
      await mkdir(PUBLIC_MEDIA_ROOT, { recursive: true });
      const extension = path.extname(cached.output_path) || mimeExtension(cached.mime_type, cached.source_url);
      const publicOutput = path.join(PUBLIC_MEDIA_ROOT, `${cached.sha256}${extension}`);
      if (!await exists(publicOutput)) await copyFile(path.join(ROOT, cached.original_path), publicOutput);
      const publicStats = await stat(publicOutput);
      cached.output_path = repoPath(publicOutput);
      cached.derivatives = [{
        path: cached.output_path,
        format: extension.slice(1),
        width: null,
        height: null,
        byte_size: publicStats.size
      }];
      ledger.set(candidate.source_url, cached);
    }
    return cached;
  }

  const temporary = path.join(ORIGINAL_ROOT, `${shaText(candidate.source_url).slice(0, 24)}.part`);
  try {
    const mime = await fetchToFile(candidate.source_url, temporary);
    const sha256 = await fileSha(temporary);
    const extension = mimeExtension(mime, candidate.source_url);
    const original = path.join(ORIGINAL_ROOT, `${sha256}${extension}`);
    if (await exists(original)) await rm(temporary, { force: true });
    else await rename(temporary, original);
    const originalStats = await stat(original);
    const directory = path.join(OUTPUT_ROOT, sha256.slice(0, 2));
    await mkdir(directory, { recursive: true });

    let width = null;
    let height = null;
    let animated = false;
    let output;
    let derivativeFormat = extension.slice(1) || "bin";
    if (mime.startsWith("image/")) {
      const metadata = await sharp(original, { animated: true }).metadata();
      width = metadata.width ?? null;
      height = metadata.pageHeight ?? metadata.height ?? null;
      animated = (metadata.pages ?? 1) > 1;
      if (!animated && mime !== "image/svg+xml") {
        output = path.join(directory, `${sha256}-w${Math.min(width ?? 1600, 1600)}.webp`);
        if (!await exists(output)) {
          await sharp(original).rotate().resize({ width: 1600, withoutEnlargement: true }).webp({ quality: 84 }).toFile(output);
        }
        derivativeFormat = "webp";
      } else {
        output = path.join(directory, `${sha256}${extension}`);
        if (!await exists(output)) await copyFile(original, output);
      }
    } else {
      await mkdir(PUBLIC_MEDIA_ROOT, { recursive: true });
      output = path.join(PUBLIC_MEDIA_ROOT, `${sha256}${extension}`);
      if (!await exists(output)) await copyFile(original, output);
    }
    const outputStats = await stat(output);
    const plausibleAlts = candidate.alt_candidates.map(cleanAlt).filter((value) => value && !filenameLike(value));
    const plausibleCaptions = candidate.caption_candidates.map(cleanAlt).filter(Boolean);
    const requiresAltReview = mime.startsWith("image/") && plausibleAlts.length !== 1;
    const record = {
      ...candidate,
      status: "downloaded",
      original_path: repoPath(original),
      output_path: repoPath(output),
      sha256,
      mime_type: mime,
      byte_size: originalStats.size,
      width,
      height,
      animated,
      derivatives: [{
        path: repoPath(output),
        format: derivativeFormat,
        width,
        height,
        byte_size: outputStats.size
      }],
      alt: plausibleAlts.length === 1 ? plausibleAlts[0] : null,
      caption: plausibleCaptions.length === 1 ? plausibleCaptions[0] : null,
      decorative: false,
      requires_alt_review: requiresAltReview,
      rights: null,
      needs_rights_review: true,
      error: null
    };
    ledger.set(candidate.source_url, record);
    return record;
  } catch (error) {
    await rm(temporary, { force: true });
    const record = { ...candidate, status: "error", error: error?.message ?? String(error) };
    ledger.set(candidate.source_url, record);
    return record;
  }
};

await mkdir(ORIGINAL_ROOT, { recursive: true });
await mkdir(OUTPUT_ROOT, { recursive: true });
let processed = 0;
for (let offset = 0; offset < candidates.length; offset += CONCURRENCY) {
  const batch = candidates.slice(offset, offset + CONCURRENCY);
  await Promise.all(batch.map(migrateCandidate));
  processed += batch.length;
  if (processed % 40 < CONCURRENCY || processed === candidates.length) {
    await persist();
    console.log(`assets ${processed}/${candidates.length}`);
  }
}

const downloaded = [...ledger.values()].filter(({ status }) => status === "downloaded")
  .sort((a, b) => a.id.localeCompare(b.id));
const expectedOutputs = new Set(downloaded.map(({ output_path: outputPath }) => path.resolve(ROOT, outputPath).toLowerCase()));
const pruneGeneratedOutputs = async (directory) => {
  let entries = [];
  try { entries = await import("node:fs/promises").then(({ readdir }) => readdir(directory, { withFileTypes: true })); } catch (error) {
    if (error?.code === "ENOENT") return;
    throw error;
  }
  for (const entry of entries) {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) await pruneGeneratedOutputs(target);
    else if (entry.isFile() && !expectedOutputs.has(path.resolve(target).toLowerCase())) await rm(target, { force: true });
  }
};
await pruneGeneratedOutputs(OUTPUT_ROOT);
const mediaRecords = downloaded.map((record) => ({
  id: record.id,
  source_url: record.source_url,
  source_filename: record.source_filename,
  original_path: record.original_path,
  output_path: record.output_path,
  sha256: record.sha256,
  mime_type: record.mime_type,
  byte_size: record.byte_size,
  width: record.width,
  height: record.height,
  animated: record.animated,
  derivatives: record.derivatives,
  alt: record.alt,
  alt_candidates: record.alt_candidates,
  caption: record.caption,
  caption_candidates: record.caption_candidates,
  decorative: record.decorative,
  requires_alt_review: record.requires_alt_review,
  rights: record.rights,
  needs_rights_review: record.needs_rights_review,
  used_by: record.used_by
}));
await writeWithRetry(MEDIA_PATH, stringifyYaml(mediaRecords, { lineWidth: 0 }));

const errors = [...ledger.values()].filter(({ status }) => status === "error");
console.log(JSON.stringify({ candidates: candidates.length, downloaded: downloaded.length, errors: errors.length }, null, 2));
if (errors.length && process.env.ASSET_STRICT === "1") process.exitCode = 2;
