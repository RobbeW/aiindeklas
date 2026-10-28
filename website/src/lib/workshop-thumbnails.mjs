const EXTENSIONS = /\.(avif|jpe?g|png|webp)$/i;

const basename = (path) => String(path).split(/[\\/]/).pop()?.replace(EXTENSIONS, "") ?? "";

/**
 * Resolve user artwork without making filenames part of the catalogue.
 * `assets` is the eager import.meta.glob result keyed by source path.
 */
export const resolveWorkshopThumbnail = (offer, assets = {}) => {
  const keys = [offer?.id, offer?.slug].filter(Boolean).map(String);
  const matches = Object.entries(assets).filter(([path]) => keys.includes(basename(path)));
  if (matches.length > 1) {
    throw new Error(`Ambiguous workshop thumbnail for ${offer?.id ?? offer?.slug}: ${matches.map(([path]) => path).join(", ")}`);
  }
  return matches[0]?.[1] ?? null;
};

export const workshopThumbnailBasename = basename;
