import type { ProductCardLayoutPreset, RectZone } from "@/config/product-card-overlay-presets";
import { intersects } from "@/server/services/productCardObjectAwareLayout";

export type LayoutOverlayRect = { key: string } & RectZone;

export type ValidateOverlayNoOverlapInput = {
  canvas: { width: number; height: number };
  forbiddenZone: RectZone;
  overlayBoxes: LayoutOverlayRect[];
  safePadding: number;
};

export type OverlayValidationResult =
  | {
      ok: true;
      reason?: undefined;
      failedBoxes?: undefined;
    }
  | {
      ok: false;
      reason: "overlay_intersects_product" | "overlay_outside_canvas";
      failedBoxes: string[];
    };

const AREA_EPS = 1.05;

/** Площадь пересечения прямоугольников (для порога «нет залезания» на товар). */
function intersectionAreaPixels(a: RectZone, b: RectZone): number {
  const x0 = Math.max(a.x, b.x);
  const y0 = Math.max(a.y, b.y);
  const x1 = Math.min(a.x + a.width, b.x + b.width);
  const y1 = Math.min(a.y + a.height, b.y + b.height);
  const w = Math.max(0, x1 - x0);
  const h = Math.max(0, y1 - y0);
  return w * h;
}

function intersectsForbidden(box: RectZone, forbidden: RectZone): boolean {
  return intersectionAreaPixels(box, forbidden) >= AREA_EPS;
}

function fitsCanvas(
  box: RectZone,
  canvasW: number,
  canvasH: number,
  safePadding: number,
): boolean {
  const pad = Math.max(0, safePadding);
  if (box.x < pad - 1e-6) return false;
  if (box.y < pad - 1e-6) return false;
  if (box.x + box.width > canvasW - pad + 1e-6) return false;
  if (box.y + box.height > canvasH - pad + 1e-6) return false;
  return box.width >= 1 && box.height >= 1;
}

/**
 * Коробки текстовых/плашечных элементов после раскладки (без arrows).
 */
export function collectLayoutOverlayBoxes(
  layout: ProductCardLayoutPreset,
  opts?: {
    maxBenefitBoxes?: number;
    includeBadges?: boolean;
    includeFooter?: boolean;
  },
): LayoutOverlayRect[] {
  const maxB = opts?.maxBenefitBoxes ?? layout.benefits.length;
  const benefitLimit = Math.max(0, Math.min(layout.benefits.length, Math.floor(maxB)));
  const boxes: LayoutOverlayRect[] = [
    { key: "title", ...layout.title },
    { key: "subtitle", ...layout.subtitle },
  ];
  for (let i = 0; i < benefitLimit; i++) {
    const b = layout.benefits[i];
    if (b) boxes.push({ key: `benefit_${i}`, ...b });
  }
  if (opts?.includeBadges !== false) {
    for (let i = 0; i < layout.badges.length; i++) {
      boxes.push({ key: `badge_${i}`, ...layout.badges[i]! });
    }
  }
  if (opts?.includeFooter !== false && layout.footer.width > 2 && layout.footer.height > 2) {
    boxes.push({ key: "footer", ...layout.footer });
  }
  return boxes;
}

export function validateOverlayNoOverlap(input: ValidateOverlayNoOverlapInput): OverlayValidationResult {
  const canvasW = input.canvas.width;
  const canvasH = input.canvas.height;
  const forbidden = input.forbiddenZone;
  const pad = input.safePadding;

  if (!Number.isFinite(canvasW) || !Number.isFinite(canvasH) || canvasW <= 0 || canvasH <= 0) {
    return { ok: false, reason: "overlay_outside_canvas", failedBoxes: ["__canvas"] };
  }

  /** Различаем источники: forbidden vs canvas bounds. */
  const canvasFailures: string[] = [];
  const forbiddenFailures: string[] = [];
  for (const box of input.overlayBoxes) {
    const r: RectZone = { x: box.x, y: box.y, width: box.width, height: box.height };
    if (!fitsCanvas(r, canvasW, canvasH, pad)) {
      canvasFailures.push(box.key);
    } else if (intersectsForbidden(r, forbidden)) {
      forbiddenFailures.push(box.key);
    }
  }
  if (forbiddenFailures.length > 0) {
    return { ok: false, reason: "overlay_intersects_product", failedBoxes: forbiddenFailures };
  }
  if (canvasFailures.length > 0) {
    return { ok: false, reason: "overlay_outside_canvas", failedBoxes: canvasFailures };
  }
  return { ok: true };
}

export function forbiddenAnyArrowTipInside(
  forbidden: RectZone,
  arrows: ProductCardLayoutPreset["arrows"],
): boolean {
  for (const a of arrows ?? []) {
    const pt = { x: a.to.x, y: a.to.y, width: 1, height: 1 };
    if (intersects(pt, forbidden)) return true;
  }
  return false;
}
