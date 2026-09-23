import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { parse } from "yaml";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");

test("global shell settings preserve the accepted routes and source facts", async () => {
  const [navigationSource, footerSource, socialSource] = await Promise.all([
    read("../../src/content/settings/navigation.yaml"),
    read("../../src/content/settings/footer.yaml"),
    read("../../src/content/settings/social.yaml")
  ]);
  const navigation = parse(navigationSource);
  const footer = parse(footerSource);
  const social = parse(socialSource);

  assert.deepEqual(navigation.locales["nl-BE"].items.map(({ label, path }) => [label, path]), [
    ["Over", "/"], ["Boek", "/boek"], ["Onderwijs", "/onderwijs"],
    ["Nascholingen", "/onderwijs/workshops-en-nascholingen"], ["Contact", "/contact"]
  ]);
  assert.deepEqual(navigation.locales.en.items.map(({ label, path }) => [label, path]), [
    ["About", "/about"], ["Contact Info", "/contactinfo"], ["Education", "/education"], ["Projects", "/projects"]
  ]);
  assert.equal(footer.business_registration, "Ondernemingsnummer ‘AI in de Klas’: BE0802831980");
  assert.equal(footer.copyright_name, "Robbe Wulgaert");
  assert.deepEqual(social.links.map(({ url }) => url), [
    "https://www.instagram.com/robbe.wulgaert/",
    "https://www.youtube.com/channel/UCKXDqLROkP8Z2fIFf91Td1w",
    "https://twitter.com/RWulgaert",
    "https://www.linkedin.com/in/robbewulgaert/",
    "https://discord.gg/U77FKEQfC6",
    "https://buymeacoffee.com/aiindeklas"
  ]);
});

test("mobile shell supports progressive enhancement and keyboard dismissal", async () => {
  const header = await read("../../src/components/SiteHeader.astro");
  const css = await read("../../src/styles/global.css");
  const componentStyles = header.match(/<style>([\s\S]*?)<\/style>/)?.[1] ?? "";
  assert.match(header, /aria-controls="primary-navigation"/);
  assert.match(header, /aria-expanded="false"/);
  assert.match(header, /hasDirectTranslation && alternatePath \? alternatePath : localeHome\(otherLocale\)/);
  assert.match(header, /event\.key === "Escape"/);
  assert.match(header, /desktopMenu\.addEventListener\("change"/);
  assert.match(header, /if \(!header\.contains\(event\.target as Node\)\)/);
  assert.match(componentStyles, /:global\(\.site-js\) \.primary-navigation\s*\{\s*position:\s*absolute;[\s\S]*?display:\s*none;/);
  assert.match(componentStyles, /\.header-inner\s*\{[^}]*flex-wrap:\s*wrap/);
  assert.match(componentStyles, /\.primary-navigation\s*\{[^}]*flex:\s*0 0 100%/);
  assert.match(componentStyles, /@media \(min-width: 52rem\)\s*\{\s*\.header-inner\s*\{\s*flex-wrap:\s*nowrap/);
  assert.equal(componentStyles.replaceAll(":global(.site-js)", "").includes(".site-js"), false);
  assert.match(css, /html\s*\{\s*min-width:\s*320px/);
  assert.match(css, /\.shell\s*\{\s*width:\s*min\(calc\(100% - \(2 \* var\(--page-gutter\)\)\), var\(--content-max\)\)/);
});
