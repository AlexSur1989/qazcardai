/**
 * Разбор outputFiles (JSON) из Generation для превью и скачивания.
 */
export type OutputFileEntry = {
  url?: string;
  storageKey?: string | null;
  kind?: string;
  contentType?: string;
  size?: number;
  providerUrl?: string;
};

export function parseOutputFilesList(json: unknown): OutputFileEntry[] {
  if (json == null) return [];
  if (!Array.isArray(json)) return [];
  const out: OutputFileEntry[] = [];
  for (const x of json) {
    if (x && typeof x === "object" && "url" in x) {
      const o = x as Record<string, unknown>;
      out.push({
        url: typeof o.url === "string" ? o.url : undefined,
        storageKey:
          o.storageKey === null || typeof o.storageKey === "string"
            ? (o.storageKey as string | null)
            : undefined,
        kind: typeof o.kind === "string" ? o.kind : undefined,
        contentType: typeof o.contentType === "string" ? o.contentType : undefined,
        size: typeof o.size === "number" ? o.size : undefined,
        providerUrl: typeof o.providerUrl === "string" ? o.providerUrl : undefined,
      });
    }
  }
  return out;
}

export function getFirstOutputPreviewUrl(json: unknown): string | null {
  const list = parseOutputFilesList(json);
  for (const e of list) {
    if (e.url?.trim()) return e.url.trim();
  }
  return null;
}
