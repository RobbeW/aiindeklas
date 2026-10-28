import { shouldIndexPath } from "./route-policy";

type PublishableContent = {
  status: string;
  migration_status: string;
  seo: { noindex: boolean; canonical_path: string | null };
};

export const isAdvertisableContent = (data: PublishableContent, indexingEnabled: boolean) =>
  shouldIndexRoute(data, indexingEnabled);

/** Production uses the accepted route contract, not legacy migration-state leakage. */
export const shouldIndexRoute = (data: PublishableContent, indexingEnabled: boolean) =>
  Boolean(data.seo.canonical_path) && shouldIndexPath(data.seo.canonical_path!, indexingEnabled);
