export type SiteLocale = "nl-BE" | "en";

export const normaliseLogicalPath = (value = "/") => {
  const [pathWithQuery, hash = ""] = value.split("#", 2);
  const [pathnameValue, query = ""] = pathWithQuery.split("?", 2);
  const withLeadingSlash = pathnameValue.startsWith("/") ? pathnameValue : `/${pathnameValue}`;
  const pathname = withLeadingSlash === "/" ? "/" : withLeadingSlash.replace(/\/+$/, "");
  return `${pathname}${query ? `?${query}` : ""}${hash ? `#${hash}` : ""}`;
};

export const normaliseBase = (value = "/") => {
  const trimmed = value.trim().replace(/^\/+|\/+$/g, "");
  return trimmed ? `/${trimmed}/` : "/";
};

export const withBase = (value: string, base = import.meta.env.BASE_URL) => {
  if (!value.startsWith("/")) return value;
  const normalisedBase = normaliseBase(base);
  const logical = normaliseLogicalPath(value);
  if (normalisedBase === "/") return logical;
  if (logical === normalisedBase.slice(0, -1) || logical.startsWith(normalisedBase)) return logical;
  if (logical === "/") return normalisedBase;
  return `${normalisedBase.slice(0, -1)}${logical}`;
};

export const withoutBase = (value: string, base = import.meta.env.BASE_URL) => {
  const normalisedBase = normaliseBase(base);
  if (normalisedBase === "/") return normaliseLogicalPath(value);
  const baseWithoutSlash = normalisedBase.slice(0, -1);
  if (value === baseWithoutSlash || value === normalisedBase) return "/";
  if (value.startsWith(normalisedBase)) return normaliseLogicalPath(value.slice(baseWithoutSlash.length));
  return normaliseLogicalPath(value);
};

export const localeForPath = (value: string): SiteLocale => {
  const pathname = normaliseLogicalPath(value).split(/[?#]/, 1)[0];
  return pathname === "/about" ||
    pathname === "/contactinfo" ||
    pathname === "/projects" ||
    pathname === "/english" ||
    pathname === "/education" ||
    pathname.startsWith("/education/")
    ? "en"
    : "nl-BE";
};

export const localeHome = (locale: SiteLocale) => locale === "en" ? "/about" : "/";

export const isActivePath = (current: string, candidate: string) => {
  const currentPath = normaliseLogicalPath(current).split(/[?#]/, 1)[0];
  const candidatePath = normaliseLogicalPath(candidate).split(/[?#]/, 1)[0];
  if (candidatePath === "/") return currentPath === "/" || currentPath === "/over";
  return currentPath === candidatePath || currentPath.startsWith(`${candidatePath}/`);
};
