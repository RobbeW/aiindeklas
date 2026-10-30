import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { createServer } from 'vite';
import { readFile } from 'node:fs/promises';

test('shared renderer uses URL locale and registry facts', async () => {
 const server=await createServer({server:{middlewareMode:true,ws:false},appType:'custom'});
 try {
  const {renderLandingMarkup,landingLocale}=await server.ssrLoadModule('/src/app/landing-render.ts');
  assert.equal(landingLocale('/zelflerende-games/en.html'),'en');
  assert.equal(landingLocale('/zelflerende-games/'),'nl');
  const nl=renderLandingMarkup('nl','./'), en=renderLandingMarkup('en','./');
  assert.match(nl,/Zelflerende games laat leerlingen/);
  assert.match(en,/Self-learning games lets students/i);
  assert.match(en,/Requirements/);
  assert.match(en,/<a href="en.html" data-language-choice="en" aria-current="page">/);
  assert.match(en,/Privacy and licence/);
  assert.match(nl,/src="\.\/assets\/flappy\//);
 } finally { await server.close(); }
});
test('built documents expose content, metadata and links in raw HTML', async (t) => {
 try { await readFile('dist/index.html'); } catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') { t.skip('build output not present'); return; } throw error; }
 for(const [file,lang,canonical] of [['index.html','nl-BE','zelflerende-games/'],['en.html','en','zelflerende-games/en.html']]){
  const html=await readFile(`dist/${file}`,'utf8');
  assert.ok(html.includes(`<html lang="${lang}">`));
  assert.ok(html.includes(`href="https://robbew.github.io/aiindeklas/${canonical}"`));
  assert.match(html,/<script type="application\/ld\+json">/);
  assert.match(html,/<main id="landing-main"/);
  assert.doesNotMatch(html,/id="loading-splash"|aria-busy="true"| inert/);
 }
});
