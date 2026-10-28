import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { load } from 'cheerio';

const root = process.cwd();
const source = fs.readFileSync(path.join(root, 'src/content/participant-pages/geschenk.md'), 'utf8');
const fail = (message) => { throw new Error(`P43: ${message}`); };
const must = (condition, message) => { if (!condition) fail(message); };
must(/route_path: \/geschenk\b/.test(source), 'route missing');
must(/locale: nl-BE/.test(source), 'locale mismatch');
must((source.match(/- title: (Zero shot|One shot|Few shot|Voorbeeldprompt|Leestekst)/g) ?? []).length === 5, 'accordion count/order mismatch');
for (const file of ['bakkerbot-screenshot.webp','prompting-splash-screen.webp','iteratief-chatten.webp','handvat-bij-opdrachten.webp','ai-in-de-klas-boekcover.webp']) {
  const bytes = fs.readFileSync(path.join(root, 'src/assets/participant-pages/geschenk', file));
  must(bytes.subarray(0, 4).toString() === 'RIFF' && bytes.subarray(8, 12).toString() === 'WEBP', `${file} is not WebP`);
}
for (const href of ['sintlievenscollege-my.sharepoint.com/:b:/g/personal/robbe_wulgaert_sintlievenscollege_be/', 'landbot.online/v3/H-2785090-YZ453WUNYGN8B4GD', '/onderwijs/voorspel-het-verleden-aeneas', '/boek', 'notebooklm.google.com', 'beta.didactlabs.com/join/xky-_WqtQw8', '/onderwijs/handvat-voor-lesmateriaal', '/contact']) must(source.includes(href), `critical URL missing: ${href}`);
for (const phrase of ['Waarom is er niet één universele computerprogrammeertaal?', 'Alan Turing', 'compilers en interpreters']) must(source.includes(phrase), `transcript sentinel missing: ${phrase}`);
must(!source.includes('placeholder') && !source.includes('volledige leestekst hoort'), 'placeholder remains');
const digest = source.match(/courtesy_code_digest: ([a-f0-9]{64})/)?.[1];
const salt = source.match(/courtesy_code_salt: (.+)/)?.[1]?.trim();
const code = process.env.P43_COURTESY_CODE;
must(digest && salt && code, 'digest verification requires P43_COURTESY_CODE');
must(crypto.createHash('sha256').update(`${salt}:${code}`).digest('hex') === digest, 'courtesy digest mismatch');
const builtCandidates = [path.join(root, 'dist/geschenk.html'), path.join(root, 'dist/geschenk/index.html')];
const built = builtCandidates.find((candidate) => fs.existsSync(candidate));
must(built, 'built /geschenk output is required');
const html = fs.readFileSync(built, 'utf8');
const $ = load(html);
const base = (process.env.P43_BASE ?? '/').replace(/^\/?|\/?$/g, '/').replaceAll('//', '/');
must($('h1').length === 1, 'built route must have one h1');
must($('meta[name="robots"]').attr('content') === 'noindex, nofollow', 'built route missing noindex/nofollow');
must($('[data-participant-content] img').length === 5, 'built route must contain five participant images');
must($('.participant-accordion button').length === 5, 'built route must contain five accordion triggers');
must($(`a[href="${base}contact"]`).length >= 1, 'internal contact link is not base-safe');
must($('[data-participant-content] img').toArray().every((element) => ($(element).attr('src') ?? '').startsWith(`${base}_astro/`)), 'participant image is not base-safe');
must(!html.includes(code) && !html.includes('squarespace-cdn.com'), 'built route leaks code or CDN URL');

for (const relative of ['sitemap.xml', 'onderwijs/rss.xml', 'education/rss.xml', 'admin/content.json', 'index.html']) {
  const discovery = fs.readFileSync(path.join(root, 'dist', relative), 'utf8');
  must(!discovery.includes('/geschenk') && !discovery.includes('participant-geschenk'), `${relative} exposes /geschenk`);
}
const workshopDirectory = path.join(root, 'src/content/workshops/generated');
const workshopText = fs.readdirSync(workshopDirectory).filter((file) => file.endsWith('.md')).map((file) => fs.readFileSync(path.join(workshopDirectory, file), 'utf8')).join('\n');
must(!/ChatGPT: Een \(Vergiftigd\) Geschenk voor Leraar en Leerling\?/i.test(workshopText), 'retired workshop remains in active catalogue');

console.log('P43 validation passed: source, built route, five WebP assets, five accordions, critical URLs, transcript sentinels, discovery exclusion and courtesy digest verified.');
