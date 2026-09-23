const normaliseBase = (value = "/") => {
  const trimmed = value.trim().replace(/^\/+|\/+$/g, "");
  return trimmed ? `/${trimmed}/` : "/";
};

export default function rehypeBasePath({ base = "/" } = {}) {
  const normalisedBase = normaliseBase(base);
  const prefix = normalisedBase === "/" ? "" : normalisedBase.slice(0, -1);
  const visit = (node) => {
    if (node?.type === "element" && node.properties) {
      for (const property of ["href", "src", "poster"]) {
        const value = node.properties[property];
        if (typeof value !== "string" || !value.startsWith("/") || value.startsWith("//")) continue;
        if (normalisedBase !== "/" && value !== prefix && !value.startsWith(normalisedBase)) {
          node.properties[property] = `${prefix}${value}`;
        }
      }
    }
    if (node?.type === "raw" && typeof node.value === "string" && normalisedBase !== "/") {
      node.value = node.value.replace(
        /\b(href|src|poster)=(['"])(\/(?!\/)[^'"]*)\2/gi,
        (match, property, quote, value) => value === prefix || value.startsWith(normalisedBase)
          ? match
          : `${property}=${quote}${prefix}${value}${quote}`
      );
    }
    if (Array.isArray(node?.children)) node.children.forEach(visit);
  };
  return (tree) => visit(tree);
}
