import { defineConfig } from "astro/config";
import { unified } from "@astrojs/markdown-remark";
import rehypeBasePath from "./scripts/rehype-base-path.mjs";
import rehypeWorkshopHeadingIds from "./scripts/rehype-workshop-heading-ids.mjs";

const normaliseBase = (value = "/") => {
  const trimmed = value.trim().replace(/^\/+|\/+$/g, "");
  return trimmed ? `/${trimmed}/` : "/";
};

const base = normaliseBase(process.env.PUBLIC_BASE_PATH);
const site = process.env.SITE_URL ?? "http://localhost:4321";

export default defineConfig({
  site,
  base,
  output: "static",
  trailingSlash: "never",
  markdown: {
    processor: unified({ rehypePlugins: [[rehypeBasePath, { base }], rehypeWorkshopHeadingIds] })
  },
  build: {
    format: "file"
  }
});
