import assert from "node:assert/strict";
import test from "node:test";
import path from "node:path";
import rehypeWorkshopHeadingIds from "../../scripts/rehype-workshop-heading-ids.mjs";

test("workshop heading ids are namespaced by stable generated filename", () => {
  const tree = { type: "root", children: [
    { type: "element", tagName: "h3", properties: { id: "type-workshop" }, children: [{ type: "text", value: "Type: Workshop" }] },
    { type: "element", tagName: "a", properties: { href: "#type-workshop" }, children: [{ type: "text", value: "jump" }] }
  ] };
  const file = { history: [path.join(process.cwd(), "src/content/workshops/generated/one.md")] };
  rehypeWorkshopHeadingIds()(tree, file);
  assert.equal(tree.children[0].properties.id, "one-type-workshop");
  assert.equal(tree.children[1].properties.href, "#one-type-workshop");
});

test("non-workshop Markdown is untouched", () => {
  const tree = { type: "root", children: [{ type: "element", tagName: "h3", properties: { id: "type-workshop" }, children: [] }] };
  rehypeWorkshopHeadingIds()(tree, { history: [path.join(process.cwd(), "src/content/articles/generated/post.md")] });
  assert.equal(tree.children[0].properties.id, "type-workshop");
});

test("workshop frontmatter is the scoped fallback when the processor omits a path", () => {
  const tree = { type: "root", children: [{ type: "element", tagName: "h2", properties: { id: "title" }, children: [{ type: "text", value: "Title" }] }] };
  rehypeWorkshopHeadingIds()(tree, { data: { astro: { frontmatter: { id: "source-workshop-x", slug: "stable-workshop-slug" } } } });
  assert.equal(tree.children[0].properties.id, "stable-workshop-slug-title");
});
