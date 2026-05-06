import sharp from "sharp";
import type { Generation } from "@/generated/prisma/client";
import type { Prisma } from "@/generated/prisma/client";
import {
  renderMarketplaceCardOverlaySvg,
  type ProductCardOverlayInput,
} from "@/server/services/productCardOverlayRenderer";

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
  if (m.flow !== "product_card" || m.tab !== "marketplace_card") return false;
  return overlayHasRenderableText(m);
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
  };
}

export type MarketplaceOverlayCompositeResult = {
  buffer: Buffer;
  contentType: string;
  overlayApplied: boolean;
};

/**
 * Накладывает SVG с текстом поверх первого изображения карточки маркетплейса (после Kie).
 */
export async function compositeProductCardMarketplaceOverlayOnImage(
  imageBuffer: Buffer,
  gen: Generation,
): Promise<MarketplaceOverlayCompositeResult> {
  const meta = asMeta(gen.metadata);
  const input = buildOverlayInputFromMeta(meta);
  const svg =
    input != null
      ? renderMarketplaceCardOverlaySvg(input)
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

  try {
    const source = sharp(imageBuffer);
    const meta = await source.metadata();
    const requestedW = input?.outputWidth;
    const requestedH = input?.outputHeight;
    const w =
      typeof requestedW === "number" && Number.isFinite(requestedW) && requestedW > 0
        ? Math.round(requestedW)
        : (meta.width ?? 1024);
    const h =
      typeof requestedH === "number" && Number.isFinite(requestedH) && requestedH > 0
        ? Math.round(requestedH)
        : (meta.height ?? 1024);
    const baseBuffer = await source
      .resize(w, h, {
        fit: "cover",
        position: "centre",
      })
      .jpeg({ quality: 94, mozjpeg: true })
      .toBuffer();
    const overlayRaster = await sharp(Buffer.from(svg, "utf-8"), { density: 220 })
      .resize(w, h, { fit: "fill" })
      .ensureAlpha()
      .png()
      .toBuffer();

    const out = await sharp(baseBuffer)
      .composite([{ input: overlayRaster, blend: "over" }])
      .jpeg({ quality: 92, mozjpeg: true })
      .toBuffer();

    return {
      buffer: out,
      contentType: "image/jpeg",
      overlayApplied: true,
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
