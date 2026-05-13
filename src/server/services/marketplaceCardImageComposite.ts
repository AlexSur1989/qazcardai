import sharp from "sharp";
import type { Generation } from "@/generated/prisma/client";
import type { Prisma } from "@/generated/prisma/client";
import { buildObjectAwarePayload } from "@/server/services/productCardObjectAwareLayout";
import {
  collectLayoutOverlayBoxes,
} from "@/server/services/productCardOverlayValidation";
import {
  renderMarketplaceCardOverlaySvg,
  type ProductCardOverlayInput,
} from "@/server/services/productCardOverlayRenderer";
import { resolveMarketplaceOverlayStrict, type ResolvedStrictMarketplaceOverlay } from "@/server/services/productCardOverlayStrictResolve";
import { estimateProductBoxFromRaster, inflateRasterProductBBox } from "@/server/services/productCardRasterLayout";

function asMeta(m: Prisma.JsonValue | null | undefined): Record<string, unknown> {
  if (m && typeof m === "object" && !Array.isArray(m)) {
    return m as Record<string, unknown>;
  }
  return {};
}

function overlayHasRenderableText(meta: Record<string, unknown>): boolean {
  const overlay = meta.overlay as Record<string, unknown> | undefined;
  const text = overlay?.text as Record<string, unknown> | undefined;
  const title = typeof text?.title === "string" ? text.title.trim() : "";
  const subtitle = typeof text?.subtitle === "string" ? text.subtitle.trim() : "";
  const extra = typeof text?.extraText === "string" ? text.extraText.trim() : "";
  const stats = typeof text?.statsText === "string" ? text.statsText.trim() : "";
  const size = typeof text?.sizeText === "string" ? text.sizeText.trim() : "";
  const benefits = Array.isArray(text?.benefits) ? text.benefits : [];
  const hasBenefits = benefits.some((b) => typeof b === "string" && b.trim());
  return Boolean(title || subtitle || extra || stats || size || hasBenefits);
}

export function shouldApplyProductCardMarketplaceOverlay(
  gen: Generation,
  type: "IMAGE" | "VIDEO",
  outputIndex: number,
): boolean {
  void outputIndex;
  if (type !== "IMAGE") return false;
  const m = asMeta(gen.metadata);
  if (m.flow !== "product_card") return false;
  if (m.tab === "marketplace_card") return overlayHasRenderableText(m);
  if (m.tab === "card_builder") return false;
  return false;
}

function buildOverlayInputFromMeta(meta: Record<string, unknown>): ProductCardOverlayInput | null {
  const overlay = meta.overlay as Record<string, unknown> | undefined;
  if (!overlay || (overlay.renderer !== "server_svg_overlay_v1" && overlay.renderer !== "server_svg_overlay_v2")) return null;
  const text = overlay.text as Record<string, unknown> | undefined;
  const productTitle = typeof text?.title === "string" ? text.title : "";
  const subtitle = typeof text?.subtitle === "string" ? text.subtitle : "";
  const extraText = typeof text?.extraText === "string" ? text.extraText : "";
  const statsText = typeof text?.statsText === "string" ? text.statsText : "";
  const sizeText = typeof text?.sizeText === "string" ? text.sizeText : "";
  const rawBenefits = Array.isArray(text?.benefits) ? text.benefits : [];
  const benefits = rawBenefits.filter((b): b is string => typeof b === "string");
  const template =
    typeof meta.overlayTemplate === "string" && meta.overlayTemplate.trim()
      ? meta.overlayTemplate.trim()
      : typeof overlay.template === "string"
        ? overlay.template
        : "bottom_panel";
  const cardSize = typeof meta.cardSize === "string" ? meta.cardSize : "square";
  const style = typeof meta.style === "string" ? meta.style : "";
  const templatePreset =
    typeof meta.templatePreset === "string"
      ? meta.templatePreset
      : typeof overlay.templatePreset === "string"
        ? overlay.templatePreset
        : undefined;
  const typographyPreset =
    typeof meta.typographyPreset === "string"
      ? meta.typographyPreset
      : typeof overlay.typographyPreset === "string"
        ? overlay.typographyPreset
        : undefined;
  const outputWidth =
    typeof overlay.outputWidth === "number"
      ? overlay.outputWidth
      : typeof meta.outputWidth === "number"
        ? meta.outputWidth
        : undefined;
  const outputHeight =
    typeof overlay.outputHeight === "number"
      ? overlay.outputHeight
      : typeof meta.outputHeight === "number"
        ? meta.outputHeight
        : undefined;
  const aspectRatio =
    typeof overlay.aspectRatio === "string"
      ? overlay.aspectRatio
      : typeof meta.requestedAspectRatio === "string"
        ? meta.requestedAspectRatio
        : typeof meta.aspectRatio === "string"
          ? meta.aspectRatio
          : undefined;
  const benefitIconIds = Array.isArray(meta.cardBuilderBenefitIconIds)
    ? (meta.cardBuilderBenefitIconIds as unknown[]).filter((x): x is string => typeof x === "string")
    : undefined;
  return {
    template,
    cardSize,
    outputWidth,
    outputHeight,
    aspectRatio,
    productTitle,
    subtitle,
    benefits,
    extraText,
    statsText,
    sizeText,
    style,
    templatePreset,
    typographyPreset,
    overlayVersion: overlay.renderer === "server_svg_overlay_v2" ? "v2" : "v1",
    useIcons: meta.useIcons !== false && overlay.useIcons !== false,
    useArrows: meta.useArrows !== false && overlay.useArrows !== false,
    useShadows: meta.useShadows !== false && overlay.useShadows !== false,
    preserveProductLabel: meta.preserveProductLabel === true || overlay.preserveProductLabel === true,
    benefitIconIds,
  };
}

export type MarketplaceOverlayCompositeResult = {
  buffer: Buffer;
  contentType: string;
  overlayApplied: boolean;
  /** Сериализуемые поля для Generation.metadata.overlayObjectLayout */
  objectLayoutForMetadata?: OverlayObjectLayoutMetaV1 | OverlayObjectLayoutMetaV2;
};

export type OverlayObjectLayoutMetaV1 = {
  v: 1;
  productBox: Record<string, unknown>;
  forbiddenZone: Record<string, unknown>;
  safeZones: unknown[];
  layoutDecision: Record<string, unknown>;
};

export type OverlayObjectLayoutOverlayBoxMeta = {
  key: string;
  x: number;
  y: number;
  width: number;
  height: number;
};

export type OverlayObjectLayoutMetaV2 = {
  v: 2;
  /** Пресет из формы / metadata.generation до fallback */
  userTemplatePreset?: string;
  /** Реально применённые цвета/раскладка пресета */
  finalTemplatePreset: string;
  productBox: Record<string, unknown>;
  forbiddenZone: Record<string, unknown>;
  safeZones: unknown[];
  overlayBoxes: OverlayObjectLayoutOverlayBoxMeta[];
  layoutDecision: Record<string, unknown>;
  validation: {
    ok: boolean;
    failedBoxes?: string[];
    reason?: string;
    emergencyBypass?: boolean;
  };
  fallbackAttempts: string[];
  finalLayoutKey: string;
  avoidedProductOverlap: boolean;
  overlayLayoutWarnings?: string[];
};

function buildMetaV2(sr: ResolvedStrictMarketplaceOverlay): OverlayObjectLayoutMetaV2 {
  const ro = sr.renderOverrides;
  const slots = Math.max(
    1,
    typeof ro?.maxBenefitSlots === "number"
      ? Math.min(sr.awareness.layoutDecision.benefitSlots, ro.maxBenefitSlots)
      : sr.awareness.layoutDecision.benefitSlots,
  );

  const overlayBoxes = collectLayoutOverlayBoxes(sr.awareness.adjustedLayout, {
    includeFooter: !ro?.hideFooter,
    includeBadges: !ro?.hideBadges,
    maxBenefitBoxes: slots,
  }).map((b) => ({
    key: b.key,
    x: Math.round(b.x),
    y: Math.round(b.y),
    width: Math.round(b.width),
    height: Math.round(b.height),
  }));

  const warn = [...(sr.warnings ?? []), ...(sr.overlayLayoutWarnings ?? [])];

  return {
    v: 2,
    finalTemplatePreset: sr.effectiveTemplatePreset,
    productBox: { ...sr.awareness.productBox },
    forbiddenZone: { ...sr.awareness.forbiddenZone },
    safeZones: sr.awareness.safeZones.map((z) => ({ ...z })),
    overlayBoxes,
    layoutDecision: { ...sr.awareness.layoutDecision },
    validation: {
      ok: sr.validationSummary.ok === true,
      failedBoxes:
        sr.validationSummary.ok !== true ? (sr.validationSummary.failedBoxes ?? []) : [],
      reason:
        sr.validationSummary.ok !== true ? sr.validationSummary.reason : undefined,
      emergencyBypass: sr.validationSummary.emergencyBypass ?? false,
    },
    fallbackAttempts: sr.fallbackAttempts,
    finalLayoutKey: sr.awareness.adjustedLayout.key,
    avoidedProductOverlap: sr.awareness.layoutDecision.avoidedProductOverlap === true,
    overlayLayoutWarnings: warn.length > 0 ? warn : undefined,
  };
}

/**
 * Накладывает SVG с текстом поверх первого изображения карточки маркетплейса (после Kie).
 */
export async function compositeProductCardMarketplaceOverlayOnImage(
  imageBuffer: Buffer,
  gen: Generation,
): Promise<MarketplaceOverlayCompositeResult> {
  const meta = asMeta(gen.metadata);
  const overlayInput = buildOverlayInputFromMeta(meta);
  const hasPreviewSvg = typeof meta.overlayPreviewSvg === "string" && meta.overlayPreviewSvg.trim();
  if (!overlayInput && !hasPreviewSvg) {
    return {
      buffer: imageBuffer,
      contentType: "",
      overlayApplied: false,
    };
  }

  try {
    const sharpMeta = await sharp(imageBuffer).metadata();
    const requestedW = overlayInput?.outputWidth;
    const requestedH = overlayInput?.outputHeight;
    const w =
      typeof requestedW === "number" && Number.isFinite(requestedW) && requestedW > 0
        ? Math.round(requestedW)
        : (sharpMeta.width ?? 1024);
    const h =
      typeof requestedH === "number" && Number.isFinite(requestedH) && requestedH > 0
        ? Math.round(requestedH)
        : (sharpMeta.height ?? 1024);

    const baseBuffer = await sharp(imageBuffer)
      .resize(w, h, {
        fit: "cover",
        position: "centre",
      })
      .jpeg({ quality: 94, mozjpeg: true })
      .toBuffer();

    const rasterBoxRaw = await estimateProductBoxFromRaster(baseBuffer, w, h);
    const cardSizeForLayout =
      typeof meta.cardSize === "string" ? meta.cardSize : overlayInput?.cardSize ?? "square";
    const rasterInflated =
      rasterBoxRaw != null
        ? inflateRasterProductBBox(rasterBoxRaw, cardSizeForLayout, w, h)
        : null;

    const presetUser =
      (typeof meta.templatePreset === "string"
        ? meta.templatePreset.trim()
        : typeof (meta.overlay as Record<string, unknown> | undefined)?.templatePreset === "string"
          ? String((meta.overlay as Record<string, unknown>).templatePreset).trim()
          : "") || "light_marketplace";

    if (overlayInput != null && overlayInput.overlayVersion === "v2") {
      const strictResolved = resolveMarketplaceOverlayStrict({
        userTemplatePreset: presetUser,
        cardSize: cardSizeForLayout,
        canvasW: w,
        canvasH: h,
        rasterProductBoxInflated: rasterInflated,
      });

      /** Не накладываем overlay, если даже аварийный режим не проходит валидацию. */
      if (strictResolved.validationSummary.ok !== true) {
        const metaV = buildMetaV2(strictResolved);
        metaV.userTemplatePreset = presetUser;
        metaV.validation = {
          ok: false,
          failedBoxes: strictResolved.validationSummary.failedBoxes,
          reason: strictResolved.validationSummary.reason,
          emergencyBypass: true,
        };
        metaV.overlayLayoutWarnings = [
          ...(metaV.overlayLayoutWarnings ?? []),
          "overlay_skipped_unsafe_overlap",
        ];
        return {
          buffer: baseBuffer,
          contentType: "image/jpeg",
          overlayApplied: false,
          objectLayoutForMetadata: metaV,
        };
      }

      const mergedRenderInput: ProductCardOverlayInput = {
        ...overlayInput,
        templatePreset: strictResolved.effectiveTemplatePreset,
        objectAwareLayoutPayload: strictResolved.awareness,
        marketplaceOverlayRenderOverrides: strictResolved.renderOverrides,
        subjectBoxFromImage: undefined,
        overlayRenderMode: "production",
      };

      const svg = renderMarketplaceCardOverlaySvg(mergedRenderInput);
      if (!svg?.trim()) {
        return {
          buffer: imageBuffer,
          contentType: "",
          overlayApplied: false,
        };
      }

      const overlayRaster = await sharp(Buffer.from(svg, "utf-8"), { density: 220 })
        .resize(w, h, { fit: "fill" })
        .ensureAlpha()
        .png()
        .toBuffer();

      const out = await sharp(baseBuffer)
        .composite([{ input: overlayRaster, blend: "over" }])
        .jpeg({ quality: 92, mozjpeg: true })
        .toBuffer();

      const metaVDone = buildMetaV2(strictResolved);
      metaVDone.userTemplatePreset = presetUser;

      return {
        buffer: out,
        contentType: "image/jpeg",
        overlayApplied: true,
        objectLayoutForMetadata: metaVDone,
      };
    }

    /** Legacy preview / V1 без строго пайплайна */
    const inputForRenderLegacy =
      overlayInput != null
        ? { ...overlayInput, subjectBoxFromImage: rasterBoxRaw ?? undefined }
        : null;

    const svg =
      inputForRenderLegacy != null
        ? renderMarketplaceCardOverlaySvg(inputForRenderLegacy)
        : typeof meta.overlayPreviewSvg === "string"
          ? meta.overlayPreviewSvg
          : null;

    if (!svg?.trim()) {
      return {
        buffer: imageBuffer,
        contentType: "",
        overlayApplied: false,
      };
    }

    const overlayRaster = await sharp(Buffer.from(svg, "utf-8"), { density: 220 })
      .resize(w, h, { fit: "fill" })
      .ensureAlpha()
      .png()
      .toBuffer();

    const out = await sharp(baseBuffer)
      .composite([{ input: overlayRaster, blend: "over" }])
      .jpeg({ quality: 92, mozjpeg: true })
      .toBuffer();

    const presetForLegacy =
      inputForRenderLegacy?.templatePreset ?? presetUser ?? "light_marketplace";
    const awareness = buildObjectAwarePayload(presetForLegacy, cardSizeForLayout, w, h, {
      subjectBoxOverride: rasterBoxRaw ?? undefined,
    });
    const objectLayoutForMetadata: OverlayObjectLayoutMetaV1 = {
      v: 1,
      productBox: { ...awareness.productBox },
      forbiddenZone: { ...awareness.forbiddenZone },
      safeZones: awareness.safeZones.map((z) => ({ ...z })),
      layoutDecision: { ...awareness.layoutDecision },
    };

    return {
      buffer: out,
      contentType: "image/jpeg",
      overlayApplied: true,
      objectLayoutForMetadata,
    };
  } catch (e) {
    console.error("[marketplaceCardOverlay] composite failed", e);
    return {
      buffer: imageBuffer,
      contentType: "",
      overlayApplied: false,
    };
  }
}
