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
  const extra = typeof text?.extraText === "string" ? text.extraText.trim() : "";
  const benefits = Array.isArray(text?.benefits) ? text.benefits : [];
  const hasBenefits = benefits.some((b) => typeof b === "string" && b.trim());
  return Boolean(title || extra || hasBenefits);
}

export function shouldApplyProductCardMarketplaceOverlay(
  gen: Generation,
  type: "IMAGE" | "VIDEO",
  outputIndex: number,
): boolean {
  if (type !== "IMAGE" || outputIndex !== 0) return false;
  const m = asMeta(gen.metadata);
  if (m.flow !== "product_card" || m.tab !== "marketplace_card") return false;
  return overlayHasRenderableText(m);
}

function buildOverlayInputFromMeta(meta: Record<string, unknown>): ProductCardOverlayInput | null {
  const overlay = meta.overlay as Record<string, unknown> | undefined;
  if (!overlay || overlay.renderer !== "server_svg_overlay_v1") return null;
  const text = overlay.text as Record<string, unknown> | undefined;
  const productTitle = typeof text?.title === "string" ? text.title : "";
  const extraText = typeof text?.extraText === "string" ? text.extraText : "";
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
  return {
    template,
    cardSize,
    productTitle,
    benefits,
    extraText,
    style,
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
    const base = sharp(imageBuffer);
    const { width, height } = await base.metadata();
    const w = width ?? 1024;
    const h = height ?? 1024;
    const overlayRaster = await sharp(Buffer.from(svg, "utf-8"), { density: 220 })
      .resize(w, h, { fit: "fill" })
      .ensureAlpha()
      .png()
      .toBuffer();

    const out = await base
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
