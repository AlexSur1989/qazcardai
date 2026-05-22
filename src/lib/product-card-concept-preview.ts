import { PRODUCT_CONCEPT_PREVIEW_PLACEHOLDER } from "@/config/product-card-categories";

/** Поддерживаемые расширения превью в `public/product-card/concepts/`. */
export const PRODUCT_CONCEPT_PREVIEW_EXTENSIONS = [
  ".webp",
  ".jpg",
  ".jpeg",
  ".png",
  ".svg",
  ".gif",
] as const;

const IMAGE_EXT_RE = /\.(jpe?g|png|webp|svg|gif)$/i;

function stripImageExtension(path: string): string {
  return path.replace(IMAGE_EXT_RE, "");
}

/** kebab-case ↔ snake_case и исходное имя. */
function basenameVariants(name: string): string[] {
  const out = new Set<string>();
  const trimmed = name.trim();
  if (!trimmed) return [];
  out.add(trimmed);
  out.add(trimmed.replace(/-/g, "_"));
  out.add(trimmed.replace(/_/g, "-"));
  return [...out];
}

/**
 * Кандидаты URL для `<img>`: конфиг может указывать любое имя/расширение,
 * на диске допустимы jpg/png/webp/svg/gif и варианты `in-use` / `in_use`.
 */
export function buildConceptPreviewCandidates(
  previewImage: string,
  conceptId?: string | null,
): string[] {
  const fallback = PRODUCT_CONCEPT_PREVIEW_PLACEHOLDER;
  const primary = previewImage.trim();
  if (!primary) return [fallback];

  const ordered: string[] = [];

  if (IMAGE_EXT_RE.test(primary)) {
    ordered.push(primary);
  }

  const withoutExt = stripImageExtension(primary);
  const slash = withoutExt.lastIndexOf("/");
  const dir = slash >= 0 ? withoutExt.slice(0, slash + 1) : "";
  const configBase = slash >= 0 ? withoutExt.slice(slash + 1) : withoutExt;

  const bases = new Set<string>();
  for (const variant of basenameVariants(configBase)) {
    bases.add(`${dir}${variant}`);
  }
  if (conceptId?.trim()) {
    for (const variant of basenameVariants(conceptId.trim())) {
      bases.add(`${dir}${variant}`);
    }
  }

  for (const base of bases) {
    for (const ext of PRODUCT_CONCEPT_PREVIEW_EXTENSIONS) {
      ordered.push(`${base}${ext}`);
    }
  }

  ordered.push(fallback);
  return [...new Set(ordered)];
}
