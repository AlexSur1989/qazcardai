import { resolveProductCardCanvas } from "@/config/product-card-overlay-presets";
import type { BoundingBox } from "@/server/services/productCardObjectAwareLayout";
import {
  buildObjectAwarePayload,
  compactLayoutForTightSafeZones,
  detectProductBox,
  pickSubjectProductBox,
  resolveOverlayAgainstForbidden,
  type ObjectAwareLayoutPayload,
} from "@/server/services/productCardObjectAwareLayout";
import type { LayoutOverlayRect } from "@/server/services/productCardOverlayValidation";
import {
  collectLayoutOverlayBoxes,
  forbiddenAnyArrowTipInside,
  validateOverlayNoOverlap,
} from "@/server/services/productCardOverlayValidation";
import type { MarketplaceOverlayRenderOverrides } from "@/server/services/productCardOverlayRenderer";

export type ResolvedStrictMarketplaceOverlay = {
  awareness: ObjectAwareLayoutPayload;
  effectiveTemplatePreset: string;
  renderOverrides: MarketplaceOverlayRenderOverrides;
  warnings: string[];
  fallbackAttempts: string[];
  overlayLayoutWarnings?: string[];
  validationSummary: {
    ok: boolean;
    reason?: string;
    failedBoxes?: string[];
    safePaddingUsed: number;
    emergencyBypass?: boolean;
  };
};

const FALLBACK_CHAINS: Record<string, readonly string[]> = {
  dark_infographic: ["dark_infographic", "feature_grid_compact", "clean_catalog_compact", "minimal_top_bottom"],
  light_marketplace: ["light_marketplace", "clean_catalog", "minimal_top_bottom"],
  promo_poster: ["promo_poster", "minimal_promo", "minimal_top_bottom"],
  feature_grid: ["feature_grid", "bottom_chips", "minimal_top_bottom"],
  lifestyle_model: ["lifestyle_model", "clean_catalog_compact", "minimal_top_bottom"],
  clean_catalog: ["clean_catalog", "clean_catalog_compact", "minimal_top_bottom"],
};

const SAFE_PAD_OVERLAY_VALIDATE = 14;

function uniq(chain: string[]): string[] {
  const out: string[] = [];
  const s = new Set<string>();
  for (const x of chain) {
    if (s.has(x)) continue;
    s.add(x);
    out.push(x);
  }
  return out;
}

function fallbackChain(userPreset: string): string[] {
  const fb = FALLBACK_CHAINS[userPreset];
  const base =
    fb && fb.length > 0
      ? fb[0] === userPreset
        ? [...fb]
        : [userPreset, ...fb]
      : [userPreset, "clean_catalog_compact", "minimal_top_bottom"];
  return uniq(base.concat("minimal_top_bottom"));
}

/** Доп. раздувание subject при нехватке места после всех раскладок. */
function inflateSubjectBox(box: BoundingBox, extraPx: number, canvasW: number, canvasH: number): BoundingBox {
  const e = Math.max(0, Math.round(extraPx));
  let x = Math.round(box.x - e);
  let y = Math.round(box.y - e);
  let w = Math.round(box.width + e * 2);
  let h = Math.round(box.height + e * 2);
  x = Math.max(0, x);
  y = Math.max(0, y);
  w = Math.min(canvasW - x, Math.max(8, w));
  h = Math.min(canvasH - y, Math.max(8, h));
  return { ...box, x, y, width: w, height: h };
}

function enrichForOccupancy(
  chain: string[],
  canvasId: string,
  occupiedRatio: number,
): string[] {
  if (canvasId === "square" && occupiedRatio > 0.65) return uniq(["minimal_top_bottom", ...chain]);
  if (canvasId === "square" && occupiedRatio > 0.5) {
    return uniq([...chain, "feature_grid_compact", "clean_catalog_compact"]);
  }
  return chain;
}

function synthesize(
  preset: string,
  cardSize: string,
  canvasW: number,
  canvasH: number,
  subjectBoxOverride: BoundingBox | null | undefined,
  useCompactHelpers: boolean,
): ObjectAwareLayoutPayload {
  const base = buildObjectAwarePayload(preset, cardSize, canvasW, canvasH, {
    subjectBoxOverride: subjectBoxOverride ?? null,
    strictMarketplace: true,
  });
  if (!useCompactHelpers) return base;
  let layer = compactLayoutForTightSafeZones(base.adjustedLayout);
  layer = resolveOverlayAgainstForbidden(layer, base.forbiddenZone, canvasW, canvasH);
  return {
    ...base,
    adjustedLayout: layer,
    layoutDecision: {
      ...base.layoutDecision,
      compact: true,
      benefitSlots: layer.benefits.length,
      reason: `${base.layoutDecision.reason}; compact pass`,
      avoidedProductOverlap: base.layoutDecision.avoidedProductOverlap,
    },
  };
}

function validateAwareness(
  awareness: ObjectAwareLayoutPayload,
  canvasW: number,
  canvasH: number,
  ro: MarketplaceOverlayRenderOverrides,
): ReturnType<typeof validateOverlayNoOverlap> {
  const benefitSlotsRaw = Math.min(
    awareness.adjustedLayout.benefits.length,
    Math.max(
      1,
      ro.maxBenefitSlots ?? awareness.layoutDecision.benefitSlots ?? awareness.adjustedLayout.benefits.length,
    ),
  );
  const boxes = collectLayoutOverlayBoxes(awareness.adjustedLayout, {
    includeFooter: !ro.hideFooter,
    includeBadges: !ro.hideBadges,
    maxBenefitBoxes: benefitSlotsRaw,
  }) as LayoutOverlayRect[];

  const v = validateOverlayNoOverlap({
    canvas: { width: canvasW, height: canvasH },
    forbiddenZone: awareness.forbiddenZone,
    overlayBoxes: boxes,
    safePadding: SAFE_PAD_OVERLAY_VALIDATE,
  });
  if (!v.ok) return v;

  if (!ro.hideArrows && forbiddenAnyArrowTipInside(awareness.forbiddenZone, awareness.adjustedLayout.arrows)) {
    return { ok: false, reason: "overlay_intersects_product", failedBoxes: ["arrow_tip"] };
  }
  return v;
}


/**
 * После Kie: конфигурируем overlay без пересечений текста и стрелок с запретной зоной товара.
 */
export function resolveMarketplaceOverlayStrict(opts: {
  userTemplatePreset: string;
  cardSize: string | undefined;
  canvasW: number;
  canvasH: number;
  rasterProductBoxInflated: BoundingBox | null;
}): ResolvedStrictMarketplaceOverlay {
  const canvasRow = resolveProductCardCanvas(opts.cardSize);
  const cardSizeResolved = opts.cardSize?.trim() || canvasRow.id;

  const heuristic = detectProductBox(opts.userTemplatePreset, cardSizeResolved, opts.canvasW, opts.canvasH);
  const mergedBase = pickSubjectProductBox(
    heuristic,
    opts.rasterProductBoxInflated ?? null,
    opts.canvasW,
    opts.canvasH,
  ) as BoundingBox;

  const canvasA = opts.canvasW * opts.canvasH;
  const occupied = canvasA > 1 ? (mergedBase.width * mergedBase.height) / canvasA : 0;

  const warnings: string[] = [];
  if (canvasRow.id === "square" && occupied > 0.5) warnings.push("tight_canvas_product_occupied");
  if (canvasRow.id === "square" && occupied > 0.65) warnings.push("very_tight_canvas_forcing_minimal");

  const chain = enrichForOccupancy(fallbackChain(opts.userTemplatePreset), canvasRow.id, occupied);

  const attempts: string[] = [];

  /** Порядок: полный пайплайн → те же preset с компакт-хелпером → отключить arrows/footer/benefit trim */
  type Ro = MarketplaceOverlayRenderOverrides;
  const escalation: Array<{ tag: string; compact: boolean; ro: Ro }> = [
    { tag: "full", compact: false, ro: {} },
    { tag: "compact_helpers", compact: true, ro: {} },
    { tag: "strip_decor", compact: true, ro: { hideFooter: true, hideBadges: true, hideArrows: true, maxBenefitSlots: 3 } },
    { tag: "minimal_two", compact: true, ro: { hideFooter: true, hideBadges: true, hideArrows: true, maxBenefitSlots: 2 } },
  ];

  const inflateSteps = occupied > 0.65 ? [0, 56, 112, 168] : [0, 44, 88, 132];

  for (const inflateExtra of inflateSteps) {
    const subject =
      inflateExtra <= 0 ? mergedBase : inflateSubjectBox(mergedBase, inflateExtra, opts.canvasW, opts.canvasH);

    for (const preset of chain) {
      for (const step of escalation) {
        /** Для финальной эскалации предпочтительно использовать minimal preset (насыщено чипами). */
        let effectivePreset = preset;
        if (step.tag === "minimal_two") {
          effectivePreset = "minimal_top_bottom";
        }

        const awareness = synthesize(
          effectivePreset,
          cardSizeResolved,
          opts.canvasW,
          opts.canvasH,
          subject,
          step.compact,
        );

        const label = `px${inflateExtra}|${effectivePreset}|${step.tag}`;
        const vCheck = validateAwareness(awareness, opts.canvasW, opts.canvasH, step.ro);
        attempts.push(`${vCheck.ok ? "ok" : "fail"}:${label}`);

        if (vCheck.ok) {
          const overlayLayoutWarnings: string[] = [];
          if (inflateExtra > 0) overlayLayoutWarnings.push(`extra_subject_margin_px:${inflateExtra}`);
          if (effectivePreset !== opts.userTemplatePreset)
            overlayLayoutWarnings.push(`used_fallback_preset:${effectivePreset}`);
          if (step.compact) overlayLayoutWarnings.push("used_compact_pass");
          if (step.ro.hideFooter || step.ro.hideBadges || step.ro.hideArrows)
            overlayLayoutWarnings.push("stripped_decorative_overlay_elements");

          return {
            awareness,
            effectiveTemplatePreset: effectivePreset,
            renderOverrides: step.ro,
            warnings,
            fallbackAttempts: attempts.map((a) => a.slice(0, 220)),
            overlayLayoutWarnings: overlayLayoutWarnings.length ? overlayLayoutWarnings : undefined,
            validationSummary: {
              ok: true,
              safePaddingUsed: SAFE_PAD_OVERLAY_VALIDATE,
              failedBoxes: [],
            },
          };
        }
      }
    }
  }

  /** Аварийный режим: жёстко обрезаем layout и отключаем декор (не должен срабатывать при нормальной геометрии). */
  const emergency = synthesize(
    "minimal_top_bottom",
    cardSizeResolved,
    opts.canvasW,
    opts.canvasH,
    inflateSubjectBox(mergedBase, 220, opts.canvasW, opts.canvasH),
    true,
  );
  emergency.adjustedLayout.arrows = [];
  emergency.adjustedLayout.badges = [];
  emergency.adjustedLayout.footer = {
    ...emergency.adjustedLayout.footer,
    height: Math.max(0, Math.min(emergency.adjustedLayout.footer.height, 2)),
  };
  const ro: Ro = { hideFooter: true, hideBadges: true, hideArrows: true, maxBenefitSlots: 2 };
  attempts.push("emergency:minimal_top_bottom+inflate220+strip");

  emergency.layoutDecision = {
    ...emergency.layoutDecision,
    avoidedProductOverlap: true,
    reason: `${emergency.layoutDecision.reason}; emergency strict strip`,
  };

  const vEm = validateAwareness(emergency, opts.canvasW, opts.canvasH, ro);
  const emergencyBypass = vEm.ok !== true;

  return {
    awareness: emergency,
    effectiveTemplatePreset: "minimal_top_bottom",
    renderOverrides: ro,
    warnings: [...warnings, "emergency_strict_overlay_fallback"],
    fallbackAttempts: attempts.map((a) => a.slice(0, 220)),
    overlayLayoutWarnings: [
      "forced_emergency_strict_after_all_attempts_failed",
      "minimal_top_bottom_hard_strip",
    ],
    validationSummary: {
      ok: vEm.ok === true,
      reason: vEm.ok === true ? undefined : (vEm as { reason: string }).reason,
      failedBoxes: vEm.ok === true ? [] : (vEm as { failedBoxes: string[] }).failedBoxes,
      safePaddingUsed: SAFE_PAD_OVERLAY_VALIDATE,
      emergencyBypass,
    },
  };
}
