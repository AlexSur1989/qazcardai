import { getAppSetting } from "@/server/services/appSettings";

export type ProductCardScenarioUiKey = "conceptPhoto" | "marketplaceCard" | "cardBuilder" | "productVideo";

export type ProductCardScenarioToggle = {
  enabled: boolean;
  label: string;
};

const DEFAULT_SCENARIOS: Record<ProductCardScenarioUiKey, ProductCardScenarioToggle> = {
  conceptPhoto: { enabled: true, label: "Фото с концепциями" },
  marketplaceCard: { enabled: true, label: "Карточка товара" },
  cardBuilder: { enabled: true, label: "Создать карточку" },
  productVideo: { enabled: true, label: "Видео" },
};

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function readToggle(raw: unknown, fallback: ProductCardScenarioToggle): ProductCardScenarioToggle {
  if (!isRecord(raw)) return fallback;
  const enabled = typeof raw.enabled === "boolean" ? raw.enabled : fallback.enabled;
  const label = typeof raw.label === "string" && raw.label.trim() ? raw.label.trim() : fallback.label;
  return { enabled, label };
}

/** JSON из AppSetting `PRODUCT_CARD_SCENARIOS` */
export async function getProductCardScenarios(): Promise<
  Record<ProductCardScenarioUiKey, ProductCardScenarioToggle>
> {
  const row = await getAppSetting("PRODUCT_CARD_SCENARIOS");
  const base = { ...DEFAULT_SCENARIOS };
  if (!isRecord(row)) return base;
  (Object.keys(base) as ProductCardScenarioUiKey[]).forEach((k) => {
    base[k] = readToggle(row[k], base[k]!);
  });
  return base;
}

export function isCardBuilderScenarioEnabled(
  scenarios: Record<ProductCardScenarioUiKey, ProductCardScenarioToggle>,
): boolean {
  return scenarios.cardBuilder.enabled === true;
}
