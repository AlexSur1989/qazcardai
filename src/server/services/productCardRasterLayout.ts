/**
 * Эвристика «где товар» по яркости относительно краёв изображения.
 * Финальный текст всё так же только через SVG/Sharp — здесь только геометрия bbox.
 */

import sharp from "sharp";

import type { BoundingBox } from "@/server/services/productCardObjectAwareLayout";

const MAX_ANALYSIS_SIDE = 420;
const EDGE_STEP = 3;

export async function estimateProductBoxFromRaster(
  imageBuffer: Buffer,
  canvasW: number,
  canvasH: number,
): Promise<BoundingBox | null> {
  try {
    const { data, info } = await sharp(imageBuffer)
      .resize({
        width: MAX_ANALYSIS_SIDE,
        height: MAX_ANALYSIS_SIDE,
        fit: "inside",
        withoutEnlargement: true,
      })
      .removeAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });

    const w = info.width;
    const h = info.height;
    const channels = Math.max(3, info.channels);
    const row = (y: number, x: number) => (y * w + x) * channels;

    const lumAt = (i: number): number =>
      0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];

    const edgeLums: number[] = [];
    for (let y = 0; y < h; y += EDGE_STEP) {
      for (let x = 0; x < w; x += EDGE_STEP) {
        if (x <= w * 0.07 || x >= w * 0.93 || y <= h * 0.07 || y >= h * 0.93) {
          const i = row(y, x);
          edgeLums.push(lumAt(i));
        }
      }
    }
    edgeLums.sort((a, b) => a - b);
    const bg =
      edgeLums.length > 0
        ? edgeLums[Math.min(edgeLums.length - 1, Math.floor(edgeLums.length * 0.5))]
        : 238;
    const delta = bg > 200 ? 26 : bg < 62 ? 30 : 20;

    let minX = w;
    let minY = h;
    let maxX = 0;
    let maxY = 0;
    let count = 0;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = row(y, x);
        if (Math.abs(lumAt(i) - bg) > delta) {
          count++;
          if (x < minX) minX = x;
          if (y < minY) minY = y;
          if (x > maxX) maxX = x;
          if (y > maxY) maxY = y;
        }
      }
    }

    const total = w * h;
    const frac = count / total;
    if (frac < 0.02 || frac > 0.9) return null;

    const padPx = Math.max(4, Math.round(Math.min(w, h) * 0.015));
    const sx = canvasW / w;
    const sy = canvasH / h;

    let bx = (minX - padPx) * sx;
    let by = (minY - padPx) * sy;
    let bw = (maxX - minX + 1 + padPx * 2) * sx;
    let bh = (maxY - minY + 1 + padPx * 2) * sy;

    bx = Math.max(0, Math.round(bx));
    by = Math.max(0, Math.round(by));
    bw = Math.min(canvasW - bx, Math.round(bw));
    bh = Math.min(canvasH - by, Math.round(bh));

    return {
      x: bx,
      y: by,
      width: Math.max(8, bw),
      height: Math.max(8, bh),
      confidence: Math.min(0.9, 0.38 + frac * 0.48),
      source: "raster_estimate",
    };
  } catch {
    return null;
  }
}

/** Консервативное расширение bbox товара (strict marketplace overlay — больше buffer вокруг товара). */
export function inflateRasterProductBBox(
  box: BoundingBox,
  cardSizeId: string | undefined,
  canvasW: number,
  canvasH: number,
): BoundingBox {
  const inflate =
    cardSizeId === "story"
      ? 96
      : cardSizeId === "banner"
        ? 64
        : cardSizeId === "vertical"
          ? 72
          : cardSizeId === "square"
            ? 80
            : 80;
  let x = Math.round(box.x - inflate);
  let y = Math.round(box.y - inflate);
  let w = Math.round(box.width + inflate * 2);
  let h = Math.round(box.height + inflate * 2);

  x = Math.max(0, x);
  y = Math.max(0, y);
  w = Math.min(canvasW - x, w);
  h = Math.min(canvasH - y, h);

  const out = {
    x,
    y,
    width: Math.max(12, w),
    height: Math.max(12, h),
    confidence: box.confidence,
    source: box.source ?? "raster_estimate",
  } as BoundingBox;
  return out;
}
