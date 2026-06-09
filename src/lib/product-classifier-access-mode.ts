export const PRODUCT_CLASSIFIER_ACCESS_MODES = [
  "disabled",
  "admin_only",
  "beta_users",
  "all_users",
] as const;

export type ProductClassifierAccessMode = (typeof PRODUCT_CLASSIFIER_ACCESS_MODES)[number];

export function parseProductClassifierAccessMode(
  raw: unknown,
): ProductClassifierAccessMode {
  if (typeof raw !== "string") return "disabled";
  const v = raw.trim().toLowerCase();
  if ((PRODUCT_CLASSIFIER_ACCESS_MODES as readonly string[]).includes(v)) {
    return v as ProductClassifierAccessMode;
  }
  return "disabled";
}

export function isProductClassifierAccessMode(value: string): value is ProductClassifierAccessMode {
  return (PRODUCT_CLASSIFIER_ACCESS_MODES as readonly string[]).includes(value);
}
