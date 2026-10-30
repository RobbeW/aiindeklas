import { createServer } from 'vite';
import { readFile, writeFile } from 'node:fs/promises';
import seo from '../src/content/seo.generated.json' with { type: 'json' };

const server = await createServer({ server: { middlewareMode: true, ws: false }, appType: 'custom' });
try {
  const { renderLandingMarkup } = await server.ssrLoadModule('/src/app/landing-render.ts');
  const template = await readFile('dist/index.html', 'utf8');
  const profiles = Object.values(seo.locales).map(data => {
    const robots = data.headHtml.match(/<meta name="robots" content="([^"]+)">/)?.[1];
    if (!robots) throw new Error('Generated landing SEO is missing an indexing profile');
    return !robots.includes('noindex');
  });
  if (new Set(profiles).size !== 1) throw new Error('Generated landing locales have inconsistent indexing profiles');
  const enabled = process.env.PUBLIC_INDEXING_ENABLED !== 'false' && profiles[0];
  for (const locale of ['nl', 'en']) {
    const data = seo.locales[locale];
    const head = data.headHtml.replace(/<meta name="robots" content="[^"]+">/, `<meta name="robots" content="${enabled ? 'index, follow, max-image-preview:large' : 'noindex, follow'}">`);
    const html = template.replace(/<html lang="[^"]*">/, `<html lang="${data.lang}">`)
      .replace('<!-- SEO_HEAD -->', head)
      .replace('<div id="app"></div>', `<div id="app">${renderLandingMarkup(locale, './')}</div>`);
    await writeFile(`dist/${locale === 'nl' ? 'index' : 'en'}.html`, html);
  }
  const urls = enabled ? Object.values(seo.locales).map(({ canonical }) => `  <url><loc>${canonical}</loc></url>`).join('\n') : '';
  await writeFile('dist/sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`);
} finally { await server.close(); }
