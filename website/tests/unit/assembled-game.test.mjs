import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { gameUrls, isAssembledGameUrl, integrateGameSitemap } from '../../../scripts/assembled-game.mjs';

const html = (url, preview = false) => `<link rel="canonical" href="${url}">${preview ? '<meta name="robots" content="noindex, nofollow">' : '<meta name="robots" content="index, follow">'}<script src="./assets/app.js"></script>`;
async function fixture(preview = false) {
  const root = await mkdtemp(join(tmpdir(), 'game-sitemap-')); const game = join(root, 'game');
  await mkdir(join(game, 'assets'), {recursive: true});
  await writeFile(join(root, 'index.html'), preview ? '<meta name="robots" content="noindex, nofollow">' : '<meta name="robots" content="index, follow">');
  await writeFile(join(root, 'sitemap.xml'), '<urlset><url><loc>https://example.org/</loc></url></urlset>');
  await writeFile(join(game, 'index.html'), html(gameUrls[0], preview)); await writeFile(join(game, 'en.html'), html(gameUrls[1], preview));
  await writeFile(join(game, 'assets/app.js'), 'asset'); return {root, game};
}
test('only exact game anchor URLs are deferred', () => {
  assert.equal(isAssembledGameUrl(new URL(gameUrls[0]), 'anchor'), true);
  assert.equal(isAssembledGameUrl(new URL(gameUrls[1]), 'anchor'), true);
  assert.equal(isAssembledGameUrl(new URL(gameUrls[0] + 'missing'), 'anchor'), false);
  assert.equal(isAssembledGameUrl(new URL(gameUrls[0]), 'script'), false);
});
test('public and preview sitemap integration', async () => {
  for (const preview of [false, true]) { const f = await fixture(preview); try {
    await integrateGameSitemap(f.root, f.game); await integrateGameSitemap(f.root, f.game);
    const xml = await readFile(join(f.root, 'sitemap.xml'), 'utf8');
    assert.match(xml, /https:\/\/example.org\//);
    for (const u of gameUrls) assert.equal(xml.split(`<loc>${u}</loc>`).length - 1, preview ? 0 : 1);
  } finally { await rm(f.root, {recursive: true, force: true}); } }
});
test('reject mismatched profiles and missing documents or assets', async () => {
  const f = await fixture(); try {
    await writeFile(join(f.game, 'en.html'), html(gameUrls[1], true));
    await assert.rejects(integrateGameSitemap(f.root, f.game), /profile mismatch/);
    await rm(join(f.game, 'en.html')); await assert.rejects(integrateGameSitemap(f.root, f.game), /Missing assembled game document/);
    await writeFile(join(f.game, 'en.html'), html(gameUrls[1])); await rm(join(f.game, 'assets/app.js'));
    await assert.rejects(integrateGameSitemap(f.root, f.game), /Missing game asset/);
  } finally { await rm(f.root, {recursive: true, force: true}); }
});
test('linked licence, credits and lesson documents must exist', async () => {
  for (const file of ['LICENSE.md', 'credits.json', 'licenses/flappy-source-MIT.txt', 'leskaarten.html']) {
    const f = await fixture();
    try {
      await writeFile(join(f.game, 'index.html'), html(gameUrls[0]) + `<a href="./${file}">Read</a>`);
      await assert.rejects(integrateGameSitemap(f.root, f.game), /linked document/);
      await mkdir(join(f.game, file, '..'), { recursive: true });
      await writeFile(join(f.game, file), 'Document');
      await integrateGameSitemap(f.root, f.game);
    } finally { await rm(f.root, { recursive: true, force: true }); }
  }
});
