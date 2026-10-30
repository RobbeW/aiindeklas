import { readFile, stat, writeFile } from 'node:fs/promises';
import { join, resolve, sep } from 'node:path';

export const gameUrls = ['https://robbew.github.io/aiindeklas/zelflerende-games/', 'https://robbew.github.io/aiindeklas/zelflerende-games/en.html'];
export const isAssembledGameUrl = (url, kind) => kind === 'anchor' && gameUrls.includes(url.href);

export async function integrateGameSitemap(websiteDir, gameDir) {
  const main = await readFile(join(websiteDir, 'index.html'), 'utf8');
  const noindex = (html) => {
    const tag = html.match(/<meta\b(?=[^>]*\bname=["']robots["'])[^>]*>/i)?.[0];
    const content = tag?.match(/\bcontent=["']([^"']+)["']/i)?.[1];
    if (!content || !/\b(?:noindex|index)\b/i.test(content)) throw new Error('Missing explicit robots indexing profile');
    return /\bnoindex\b/i.test(content);
  };
  const mainPreview = noindex(main);
  for (const [i, file] of ['index.html', 'en.html'].entries()) {
    let html;
    try { html = await readFile(join(gameDir, file), 'utf8'); } catch (e) { if (e.code === 'ENOENT') throw new Error(`Missing assembled game document: ${file}`); throw e; }
    if (noindex(html) !== mainPreview) throw new Error(`Indexing profile mismatch: main is ${mainPreview ? 'preview' : 'public'}, game ${file} is ${noindex(html) ? 'preview' : 'public'}`);
    const canonical = html.match(/<link\b(?=[^>]*\brel=["']canonical["'])(?=[^>]*\bhref=["']([^"']+)["'])[^>]*>/i)?.[1];
    if (canonical !== gameUrls[i]) throw new Error(`Invalid game canonical in ${file}`);
    for (const match of html.matchAll(/<(?:script|link|img|source|a)\b[^>]*\b(?:src|href)=["']([^"']+)["'][^>]*>/gi)) {
      const u = new URL(match[1], gameUrls[i]);
      if (!u.href.startsWith(gameUrls[0])) continue;
      const relative = decodeURIComponent(u.pathname.slice(new URL(gameUrls[0]).pathname.length));
      const path = resolve(gameDir, relative.endsWith('/') || !relative ? relative + 'index.html' : relative);
      if (!path.startsWith(resolve(gameDir) + sep)) throw new Error(`Invalid game asset path: ${match[1]}`);
      try { if (!(await stat(path)).isFile()) throw new Error(); } catch { throw new Error(`Missing game asset or linked document: ${match[1]} in ${file}`); }
    }
  }
  const path = join(websiteDir, 'sitemap.xml');
  let xml = await readFile(path, 'utf8');
  if (!/<\/urlset\s*>/i.test(xml)) throw new Error('Invalid main sitemap: missing urlset');
  const locations = [...xml.matchAll(/<loc>\s*([^<]+)\s*<\/loc>/g)].map(m => m[1].trim());
  if (new Set(locations).size !== locations.length) throw new Error('Main sitemap has duplicate locations');
  if (mainPreview && gameUrls.some(url => locations.includes(url))) throw new Error('Preview sitemap contains game URLs');
  if (!mainPreview) {
    const extra = gameUrls.filter(url => !locations.includes(url)).map(url => `<url><loc>${url}</loc></url>`).join('');
    xml = xml.replace(/<\/urlset\s*>/i, `${extra}</urlset>`);
    await writeFile(path, xml);
  }
  return { indexing: !mainPreview, sitemap_game_urls: mainPreview ? [] : gameUrls };
}
