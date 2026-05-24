/**
 * Референс стиля для мастера «Создать карточку» (product card / card_builder).
 * Хранится в metadata.cardBuilder.settings.styleReference (file ids пользователя).
 */
export type CardBuilderStyleReferenceStrength = "low" | "medium" | "high";

export type CardBuilderStyleReferencePlan = {
  enabled: boolean;
  referenceAssetIds: string[];
  strength: CardBuilderStyleReferenceStrength;
  useComposition: boolean;
  useBackground: boolean;
  useColors: boolean;
  useTypography: boolean;
  useBadges: boolean;
  useIcons: boolean;
  useMood: boolean;
  /** «Общая подача» карточки (отдельно от mood атмосферы). */
  useOverallPresentation: boolean;
};

const MAX_REFERENCE_ASSETS = 3;

export const DEFAULT_CARD_BUILDER_STYLE_REFERENCE: CardBuilderStyleReferencePlan = {
  enabled: false,
  referenceAssetIds: [],
  strength: "medium",
  useComposition: true,
  useBackground: true,
  useColors: true,
  useTypography: true,
  useBadges: true,
  useIcons: true,
  useMood: true,
  useOverallPresentation: true,
};

/** Все булевые «что брать» выключены. */
export const OFF_CARD_BUILDER_STYLE_REFERENCE_FLAGS: Omit<
  CardBuilderStyleReferencePlan,
  "enabled" | "referenceAssetIds" | "strength"
> = {
  useComposition: false,
  useBackground: false,
  useColors: false,
  useTypography: false,
  useBadges: false,
  useIcons: false,
  useMood: false,
  useOverallPresentation: false,
};

function uniqPreserveOrder(ids: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of ids) {
    const id = raw.trim().slice(0, 96);
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
    if (out.length >= MAX_REFERENCE_ASSETS) break;
  }
  return out;
}

export function normalizeStyleReferencePlan(
  raw: unknown,
): CardBuilderStyleReferencePlan | undefined {
  if (raw === null || raw === undefined) return undefined;
  if (typeof raw !== "object" || Array.isArray(raw)) return undefined;
  const r = raw as Record<string, unknown>;

  const enabled = r.enabled === true;
  const strengthRaw = typeof r.strength === "string" ? r.strength.trim().toLowerCase() : "";
  const strength: CardBuilderStyleReferenceStrength =
    strengthRaw === "low" || strengthRaw === "high" || strengthRaw === "medium"
      ? strengthRaw
      : "medium";

  const idsRaw = r.referenceAssetIds;
  const referenceAssetIds = Array.isArray(idsRaw)
    ? uniqPreserveOrder(
        idsRaw.filter((x): x is string => typeof x === "string"),
      )
    : [];

  const flag = (key: keyof Omit<CardBuilderStyleReferencePlan, "enabled" | "referenceAssetIds" | "strength">) => {
    if (r[key] === false) return false;
    if (r[key] === true) return true;
    return DEFAULT_CARD_BUILDER_STYLE_REFERENCE[key];
  };

  return {
    enabled,
    referenceAssetIds,
    strength,
    useComposition: flag("useComposition"),
    useBackground: flag("useBackground"),
    useColors: flag("useColors"),
    useTypography: flag("useTypography"),
    useBadges: flag("useBadges"),
    useIcons: flag("useIcons"),
    useMood: flag("useMood"),
    useOverallPresentation: flag("useOverallPresentation"),
  };
}

export function sanitizeStyleReferenceOnStoredPlan<T extends { styleReference?: unknown }>(
  plan: T,
): T {
  const n = normalizeStyleReferencePlan(plan.styleReference);
  if (!n || !n.enabled || n.referenceAssetIds.length === 0) {
    const { styleReference: _s, ...rest } = plan as T & { styleReference?: unknown };
    void _s;
    return { ...rest } as T;
  }
  return { ...plan, styleReference: n };
}

export function styleReferenceIsActiveForGeneration(
  plan: CardBuilderStyleReferencePlan | undefined,
  resolvedUrlCount: number,
): boolean {
  return Boolean(plan?.enabled && resolvedUrlCount > 0);
}

export function styleReferenceFingerprintPayload(
  plan: CardBuilderStyleReferencePlan | undefined,
): Record<string, unknown> | undefined {
  if (!plan) return undefined;
  const ids = [...plan.referenceAssetIds].filter(Boolean).sort();
  const body: Record<string, unknown> = {
    enabled: plan.enabled,
    strength: plan.strength,
    referenceAssetIds: ids,
    useComposition: plan.useComposition,
    useBackground: plan.useBackground,
    useColors: plan.useColors,
    useTypography: plan.useTypography,
    useBadges: plan.useBadges,
    useIcons: plan.useIcons,
    useMood: plan.useMood,
    useOverallPresentation: plan.useOverallPresentation,
  };
  if (!plan.enabled && ids.length === 0) return undefined;
  return body;
}
