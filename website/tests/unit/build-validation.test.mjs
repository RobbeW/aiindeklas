import assert from "node:assert/strict";
import test from "node:test";
import {
  logicalPathFromDeployed,
  normaliseBasePath,
  outputFileForLogicalPath,
  urlsFromHtml
} from "../../scripts/validate-built-site.mjs";

test("base paths are normalised deterministically", () => {
  assert.equal(normaliseBasePath("aiindeklas"), "/aiindeklas/");
  assert.equal(normaliseBasePath("/"), "/");
});

test("project paths map back to logical content paths", () => {
  assert.equal(logicalPathFromDeployed("/aiindeklas/", "/aiindeklas/"), "/");
  assert.equal(logicalPathFromDeployed("/aiindeklas/about", "/aiindeklas/"), "/about");
  assert.equal(logicalPathFromDeployed("/about", "/aiindeklas/"), null);
});

test("logical routes resolve to file-format outputs", () => {
  assert.match(outputFileForLogicalPath("/", "dist"), /dist[\\/]index\.html$/);
  assert.match(outputFileForLogicalPath("/education/example", "dist"), /education[\\/]example\.html$/);
  assert.match(outputFileForLogicalPath("/sitemap.xml", "dist"), /sitemap\.xml$/);
});

test("built HTML URL inventory includes routes, assets, srcset, metadata and redirects", () => {
  const urls = urlsFromHtml(`
    <a href="/aiindeklas/about">About</a>
    <link rel="stylesheet" href="/aiindeklas/_astro/site.css">
    <img src="/aiindeklas/image.webp" srcset="/aiindeklas/image.webp 1x, /aiindeklas/image@2x.webp 2x">
    <meta property="og:image" content="/aiindeklas/social.png">
    <meta http-equiv="refresh" content="0;url=/aiindeklas/target">
    <style>.hero { background-image: url('/aiindeklas/background.webp'); }</style>
  `);
  assert.deepEqual(
    new Set(urls.map(({ kind }) => kind)),
    new Set(["anchor", "link", "image", "srcset", "social-image", "refresh", "inline-style"])
  );
  assert.equal(urls.some(({ url }) => url === "/aiindeklas/image@2x.webp"), true);
});
