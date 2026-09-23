import assert from "node:assert/strict";
import test from "node:test";
import rehypeBasePath from "../../scripts/rehype-base-path.mjs";

const treeWith = (properties) => ({
  type: "root",
  children: [{ type: "element", tagName: "a", properties, children: [] }]
});

test("prefixes root-relative Markdown links for a project Pages base", () => {
  const tree = treeWith({ href: "/onderwijs", src: "/media/example.mp3" });
  rehypeBasePath({ base: "/aiindeklas/" })(tree);
  assert.deepEqual(tree.children[0].properties, {
    href: "/aiindeklas/onderwijs",
    src: "/aiindeklas/media/example.mp3"
  });
});

test("leaves absolute, protocol-relative, and already-prefixed links unchanged", () => {
  const tree = {
    type: "root",
    children: [
      treeWith({ href: "https://example.com" }).children[0],
      treeWith({ href: "//cdn.example.com/file" }).children[0],
      treeWith({ href: "/aiindeklas/contact" }).children[0]
    ]
  };
  rehypeBasePath({ base: "/aiindeklas/" })(tree);
  assert.equal(tree.children[0].properties.href, "https://example.com");
  assert.equal(tree.children[1].properties.href, "//cdn.example.com/file");
  assert.equal(tree.children[2].properties.href, "/aiindeklas/contact");
});

test("prefixes root-relative links preserved inside raw CTA HTML", () => {
  const tree = {
    type: "root",
    children: [{
      type: "raw",
      value: '<div class="content-button-row"><a class="content-button" href="/contact">Contact</a></div>'
    }]
  };
  rehypeBasePath({ base: "/aiindeklas/" })(tree);
  assert.match(tree.children[0].value, /href="\/aiindeklas\/contact"/);
});
