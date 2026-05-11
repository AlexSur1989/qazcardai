/**
 * Видимость модели в пользовательском каталоге (/dashboard/models, хабы, create/*).
 * Admin и API превью могут обходить ограничение.
 */

export const HAPPYHORSE_VIDEO_EDIT_DB_SLUG = "happyhorse-1-0-video-edit";

function metaRecord(meta: unknown): Record<string, unknown> | null {
  if (!meta || typeof meta !== "object" || Array.isArray(meta)) return null;
  return meta as Record<string, unknown>;
}

/**
 * Public gate: isActive=true + isPublic=true.
 * metadata.publicReady is kept as a seed/admin compatibility signal, but public UI
 * uses the dedicated DB column because JSON filtering is easy to get wrong.
 */
export function isAiModelVisibleInUserCatalog(row: {
  slug: string;
  isActive: boolean;
  isPublic?: boolean | null;
  metadata?: unknown | null;
}): boolean {
  if (!row.isActive) return false;
  if (typeof row.isPublic === "boolean") return row.isPublic;
  const m = metaRecord(row.metadata);
  if (typeof m?.publicReady === "boolean") {
    return m.publicReady === true;
  }
  if (row.slug === HAPPYHORSE_VIDEO_EDIT_DB_SLUG) return false;
  return true;
}
