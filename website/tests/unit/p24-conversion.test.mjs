import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "../..");
const read = (file) => readFile(resolve(root, file), "utf8");

test("P24 homepage has one clear conversion hierarchy and no linked imagery", async () => {
  const [home, component] = await Promise.all([
    read("src/content/pages/generated/home.md"),
    read("src/components/HomePage.astro")
  ]);
  assert.equal((home.match(/class="content-button /g) ?? []).length, 3);
  assert.equal((home.match(/class="content-button content-button--primary content-button--medium/g) ?? []).length, 3);
  assert.equal((home.match(/home-action--/g) ?? []).length, 3);
  assert.match(home, /Aanbod nascholingen/);
  assert.match(home, /Onderwijs en lesmateriaal/);
  assert.match(home, /Boek: AI in de klas/);
  assert.equal((home.match(/href="\/boek"/g) ?? []).length, 1);
  assert.doesNotMatch(home, /href="\/contact"/);
  assert.doesNotMatch(home, /\[!\[/);
  assert.match(home, /Het Digitale Dilemma bij VRT MAX/);
  assert.match(component, /home-block--book img/);
  assert.doesNotMatch(component, /@media \(max-width: 55\.999rem\)[\s\S]*order:/);
});

test("P24 contact is task-first and retains the workshop handoff without redundant email", async () => {
  const [contact, form] = await Promise.all([
    read("src/content/pages/generated/contact.md"),
    read("src/components/ContactEmailForm.astro")
  ]);
  assert.match(form, /Heb je een vraag over een nascholing, lesmateriaal of een project\?/);
  assert.match(form, /contact-email-form__note/);
  assert.doesNotMatch(form, /name="email"|values\.get\("email"\)|E-mail: \$\{email\}/);
  for (const key of ["offer_id", "offer", "persona", "need", "subject_area", "duration", "group_size"]) assert.match(form, new RegExp(`\\["${key}"`));
  assert.match(form, /data-workshop-context/);
  assert.doesNotMatch(contact, /Heb je een vraag over|mailprogramma/);
  assert.equal((contact.match(/class="button button--primary"/g) ?? []).length, 2);
  assert.doesNotMatch(contact, /content-button--secondary|content-button--primary/);
  assert.match(contact, /discord\.gg\/U77FKEQfC6/);
  assert.match(contact, /buymeacoffee\.com\/aiindeklas/);
});

test("P24 book and shared content buttons preserve facts with distinct variants", async () => {
  const [book, css] = await Promise.all([
    read("src/content/pages/generated/boek.md"),
    read("src/styles/global.css")
  ]);
  assert.match(book, /excerpt: "Ik bied/);
  assert.match(book, /AI-competenties/);
  assert.doesNotMatch(book, /AI-comptenties|\u00a0/);
  assert.match(book, /bied ik in _AI in de klas_/);
  assert.equal((book.match(/content-button--primary/g) ?? []).length, 1);
  assert.equal((book.match(/content-button--secondary/g) ?? []).length, 1);
  assert.match(css, /\.content-button\s*\{[\s\S]*min-height:\s*44px[\s\S]*border-radius:\s*var\(--radius-brand\)/);
  assert.match(css, /\.content-button--primary\s*\{[^}]*background:\s*var\(--color-brand\)/);
  assert.match(css, /\.content-button--secondary\s*\{[^}]*border-color:\s*var\(--color-line\)/);
  assert.match(css, /\.content-button--text\s*\{[^}]*text-decoration:\s*underline/);
});
