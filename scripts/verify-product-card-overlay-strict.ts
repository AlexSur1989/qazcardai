/**
 * Ручная проверка strict overlay resolver + валидации на синтетических размерах.
 * Запуск: npx tsx scripts/verify-product-card-overlay-strict.ts
 */

import type { BoundingBox } from "@/server/services/productCardObjectAwareLayout";
import { validateOverlayNoOverlap } from "@/server/services/productCardOverlayValidation";
import { resolveMarketplaceOverlayStrict } from "@/server/services/productCardOverlayStrictResolve";

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(msg);
}

function synthBox(centerX: number, centerY: number, bw: number, bh: number, w: number, h: number): BoundingBox {
  const x = Math.round(centerX - bw / 2);
  const y = Math.round(centerY - bh / 2);
  return {
    x: Math.max(0, x),
    y: Math.max(0, y),
    width: Math.min(bw, w),
    height: Math.min(bh, h),
    confidence: 0.82,
    source: "raster_estimate",
  };
}

console.log("[verify-overlay-strict] validateOverlayNoOverlap canvas bounds");
assert(
  validateOverlayNoOverlap({
    canvas: { width: 400, height: 400 },
    forbiddenZone: { x: 100, y: 100, width: 200, height: 200 },
    overlayBoxes: [
      { key: "title", x: 320, y: 20, width: 60, height: 30 },
      { key: "footer", x: 10, y: 10, width: 100, height: 20 },
    ],
    safePadding: 8,
  }).ok === true,
  "safe title/footer should validate",
);

assert(
  validateOverlayNoOverlap({
    canvas: { width: 400, height: 400 },
    forbiddenZone: { x: 100, y: 100, width: 200, height: 200 },
    overlayBoxes: [{ key: "title", x: 140, y: 140, width: 120, height: 40 }],
    safePadding: 8,
  }).ok === false,
  "intersecting title should fail",
);

const cases = [
  { name: "perforator wide", cw: 1000, ch: 1000, box: synthBox(500, 520, 720, 180, 1000, 1000), preset: "dark_infographic" },
  { name: "glasses low", cw: 1000, ch: 1000, box: synthBox(500, 600, 420, 140, 1000, 1000), preset: "light_marketplace" },
  { name: "story vertical bottle", cw: 1080, ch: 1920, box: synthBox(540, 800, 360, 640, 1080, 1920), preset: "clean_catalog" },
];

for (const c of cases) {
  const r = resolveMarketplaceOverlayStrict({
    userTemplatePreset: c.preset,
    cardSize: c.cw === 1080 && c.ch === 1920 ? "story" : "square",
    canvasW: c.cw,
    canvasH: c.ch,
    rasterProductBoxInflated: c.box,
  });
  console.log(`[resolver] ${c.name}: validationOk=${r.validationSummary.ok}, preset=${r.effectiveTemplatePreset}`);
  assert(r.validationSummary.ok === true || r.validationSummary.emergencyBypass !== undefined, `${c.name}: expect ok or diagnostics`);
}

console.log("[verify-overlay-strict] done.");
