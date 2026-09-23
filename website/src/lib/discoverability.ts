type PublishableContent = {
  status: string;
  migration_status: string;
  seo: { noindex: boolean; canonical_path: string | null };
};

// These routes render through RouteListingPage, whose robots policy is fixed to noindex.
const rendererNoindexPaths = new Set(["/onderwijs", "/education", "/projects"]);

export const isAdvertisableContent = (data: PublishableContent, indexingEnabled: boolean) =>
  indexingEnabled && data.status === "published" && data.migration_status === "approved"
  && !data.seo.noindex && Boolean(data.seo.canonical_path)
  && !rendererNoindexPaths.has(data.seo.canonical_path ?? "");
