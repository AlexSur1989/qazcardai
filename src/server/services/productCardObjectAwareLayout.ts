import type { ProductCardCanvasId, ProductCardLayoutPreset, RectZone } from "@/config/product-card-overlay-presets";
import { getProductCardLayoutPreset } from "@/config/product-card-overlay-presets";

export type BoundingBox = RectZone & { confidence?: number; source?: "cutout" | "vision" | "estimated" };

export type SafeZone = { key: string; x: number; y: number; width: number; height: number };

export type LayoutDecision = {
  selectedLayoutKey: string;
  reason: string;
  avoidedProductOverlap: boolean;
};

export type ObjectAwareLayoutPayload = {
  productBox: BoundingBox;
  forbiddenZone: RectZone;
  safeZones: SafeZone[];
  layoutDecision: LayoutDecision;
  /** Overlay geometry after repell + optional compact — use for SVG rendering. */
  adjustedLayout: ProductCardLayoutPreset;
};

export function intersects(a: RectZone, b: RectZone): boolean {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}

function intersectionArea(a: RectZone, b: RectZone): number {
  const x0 = Math.max(a.x, b.x);
  const y0 = Math.max(a.y, b.y);
  const x1 = Math.min(a.x + a.width, b.x + b.width);
  const y1 = Math.min(a.y + a.height, b.y + b.height);
  const w = Math.max(0, x1 - x0);
  const h = Math.max(0, y1 - y0);
  return w * h;
}

function expandRect(r: RectZone, pad: number): RectZone {
  return {
    x: Math.max(0, r.x - pad),
    y: Math.max(0, r.y - pad),
    width: r.width + pad * 2,
    height: r.height + pad * 2,
  };
}

export function clampRectToCanvas(r: RectZone, canvasW: number, canvasH: number): RectZone {
  const x = Math.max(0, Math.min(r.x, canvasW));
  const y = Math.max(0, Math.min(r.y, canvasH));
  const width = Math.min(r.width, Math.max(0, canvasW - x));
  const height = Math.min(r.height, Math.max(0, canvasH - y));
  return { x, y, width, height };
}

/** For Level B: use template product safe area as heuristic product footprint. */
export function detectProductBox(
  templatePreset: string | undefined,
  cardSize: string | undefined,
  canvasW: number,
  canvasH: number,
): BoundingBox {
  const layout = getProductCardLayoutPreset(templatePreset, cardSize);
  const b = layout.productSafeArea;
  return {
    ...clampRectToCanvas(b, canvasW, canvasH),
    confidence: 0.55,
    source: "estimated",
  };
}

/** Padding around product for “no overlay” zone — spec ranges (mid values). */
export function buildForbiddenZone(productBox: RectZone, cardSize: string | undefined, canvasW: number, canvasH: number): RectZone {
  const id = cardSize as ProductCardCanvasId;
  const pad =
    id === "square" || id === "vertical"
      ? 55
      : id === "story"
        ? 80
        : id === "banner"
          ? 40
          : 55;
  return clampRectToCanvas(expandRect(productBox, pad), canvasW, canvasH);
}

export function computeSafeZones(canvasW: number, canvasH: number, forbidden: RectZone): SafeZone[] {
  const f = clampRectToCanvas(forbidden, canvasW, canvasH);
  const zones: SafeZone[] = [];

  const topH = Math.max(0, f.y);
  if (topH > 4) zones.push({ key: "top", x: 0, y: 0, width: canvasW, height: topH });

  const bottomY = f.y + f.height;
  const bottomH = Math.max(0, canvasH - bottomY);
  if (bottomH > 4) zones.push({ key: "bottom", x: 0, y: bottomY, width: canvasW, height: bottomH });

  const leftW = Math.max(0, f.x);
  if (leftW > 4) {
    zones.push({ key: "left", x: 0, y: f.y, width: leftW, height: f.height });
  }

  const rightX = f.x + f.width;
  const rightW = Math.max(0, canvasW - rightX);
  if (rightW > 4) {
    zones.push({ key: "right", x: rightX, y: f.y, width: rightW, height: f.height });
  }

  zones.push({
    key: "top_left",
    x: 0,
    y: 0,
    width: Math.min(leftW || canvasW * 0.4, canvasW * 0.45),
    height: Math.min(topH || canvasH * 0.28, canvasH * 0.35),
  });
  zones.push({
    key: "footer_strip",
    x: 0,
    y: Math.max(0, canvasH - Math.round(canvasH * 0.12)),
    width: canvasW,
    height: Math.round(canvasH * 0.12),
  });

  return zones.filter((z) => z.width > 8 && z.height > 8);
}

/**
 * Translate rect minimally so it sits outside forbidden; step search along axes.
 */
export function pushRectOutOfZone(rect: RectZone, forbidden: RectZone, canvasW: number, canvasH: number): RectZone {
  let r = clampRectToCanvas(rect, canvasW, canvasH);
  if (!intersects(r, forbidden)) return r;

  const step = 6;
  const maxSteps = Math.ceil(Math.max(canvasW, canvasH) / step);

  /** Try cardinal directions away from forbidden center */
  const fc = forbidden.x + forbidden.width / 2;
  const fy = forbidden.y + forbidden.height / 2;
  const rc = r.x + r.width / 2;
  const ry = r.y + r.height / 2;
  const dirX = rc >= fc ? 1 : -1;
  const dirY = ry >= fy ? 1 : -1;

  const candidates = [
    { dx: dirX * step, dy: 0 },
    { dx: 0, dy: dirY * step },
    { dx: -dirX * step, dy: 0 },
    { dx: 0, dy: -dirY * step },
    { dx: dirX * step, dy: dirY * step },
  ];

  for (let s = 0; s < maxSteps; s++) {
    let improved = false;
    for (const { dx, dy } of candidates) {
      const n = clampRectToCanvas({ ...r, x: r.x + dx, y: r.y + dy }, canvasW, canvasH);
      if (!intersects(n, forbidden)) return n;
      const a0 = intersectionArea(r, forbidden);
      const a1 = intersectionArea(n, forbidden);
      if (a1 < a0) {
        r = n;
        improved = true;
      }
    }
    if (!improved) r = clampRectToCanvas({ ...r, x: r.x + dirX * step, y: r.y + dirY * step }, canvasW, canvasH);
  }
  return r;
}

export function cloneLayoutPreset(base: ProductCardLayoutPreset): ProductCardLayoutPreset {
  return {
    ...base,
    title: { ...base.title },
    subtitle: { ...base.subtitle },
    productSafeArea: { ...base.productSafeArea },
    benefits: base.benefits.map((b) => ({ ...b })),
    badges: base.badges.map((b) => ({ ...b })),
    callouts: base.callouts.map((b) => ({ ...b })),
    arrows: base.arrows.map((a) => ({ from: { ...a.from }, to: { ...a.to } })),
    footer: { ...base.footer },
  };
}

export function chooseAdaptiveLayout(
  templatePreset: string | undefined,
  cardSize: string | undefined,
  productBox: RectZone,
  canvasW: number,
  _safeZones: SafeZone[],
): { layout: ProductCardLayoutPreset; decision: LayoutDecision } {
  void _safeZones;
  const base = getProductCardLayoutPreset(templatePreset, cardSize);
  const layout = cloneLayoutPreset(base);
  const cx = productBox.x + productBox.width / 2;
  const pxNorm = canvasW > 0 ? cx / canvasW : 0.5;

  let reason = "Template default safe-area alignment";
  const shiftX = pxNorm > 0.54 ? -28 : pxNorm < 0.46 ? 28 : 0;

  if (shiftX !== 0) {
    reason =
      pxNorm > 0.54 ? "Товар правее центра — сдвигаем текстовые блоки влево" : "Товар левее центра — сдвигаем текстовые блоки вправо";
    layout.title.x += shiftX;
    layout.subtitle.x += shiftX;
    for (const b of layout.benefits) b.x += shiftX;
    for (const b of layout.badges) b.x += shiftX;
    layout.footer.x += shiftX;
  }

  return {
    layout,
    decision: {
      selectedLayoutKey: layout.key,
      reason,
      avoidedProductOverlap: true,
    },
  };
}

export function resolveOverlayAgainstForbidden(
  layout: ProductCardLayoutPreset,
  forbidden: RectZone,
  canvasW: number,
  canvasH: number,
): ProductCardLayoutPreset {
  const out = cloneLayoutPreset(layout);
  out.title = pushRectOutOfZone(out.title, forbidden, canvasW, canvasH);
  out.subtitle = pushRectOutOfZone(out.subtitle, forbidden, canvasW, canvasH);
  out.footer = pushRectOutOfZone(out.footer, forbidden, canvasW, canvasH);
  for (let i = 0; i < out.benefits.length; i++) {
    out.benefits[i] = pushRectOutOfZone(out.benefits[i]!, forbidden, canvasW, canvasH);
  }
  for (let i = 0; i < out.badges.length; i++) {
    out.badges[i] = pushRectOutOfZone(out.badges[i]!, forbidden, canvasW, canvasH);
  }
  for (let i = 0; i < out.callouts.length; i++) {
    out.callouts[i] = pushRectOutOfZone(out.callouts[i]!, forbidden, canvasW, canvasH);
  }

  const bx = forbidden.x + forbidden.width / 2;
  const by = forbidden.y + forbidden.height / 2;
  for (const a of out.arrows) {
    const hit = intersects({ x: a.to.x - 10, y: a.to.y - 10, width: 20, height: 20 }, forbidden);
    if (!hit) continue;
    const vx = bx - a.from.x;
    const vy = by - a.from.y;
    const len = Math.hypot(vx, vy) || 1;
    const ux = vx / len;
    const uy = vy / len;
    const inset = Math.min(forbidden.width, forbidden.height) * 0.28 + 10;
    a.to.x = bx - ux * inset;
    a.to.y = by - uy * inset;
    a.to.x = Math.max(forbidden.x - 4, Math.min(forbidden.x + forbidden.width + 4, a.to.x));
    a.to.y = Math.max(forbidden.y - 4, Math.min(forbidden.y + forbidden.height + 4, a.to.y));
  }

  return out;
}

export function measureForbiddenOverlap(layout: ProductCardLayoutPreset, forbidden: RectZone): number {
  let area = 0;
  const boxes: RectZone[] = [layout.title, layout.subtitle, layout.footer, ...layout.benefits, ...layout.badges];
  for (const b of boxes) {
    area += intersectionArea(b, forbidden);
  }
  return area;
}

/** When space tight: trim benefits count, optionally drop arrows badges (caller applies). */
export function compactLayoutForTightSafeZones(layout: ProductCardLayoutPreset): ProductCardLayoutPreset {
  const out = cloneLayoutPreset(layout);
  while (out.benefits.length > 3) out.benefits.pop();
  while (out.badges.length > 1) out.badges.pop();
  out.arrows = [];
  return out;
}

export function buildObjectAwarePayload(
  templatePreset: string | undefined,
  cardSize: string | undefined,
  canvasW: number,
  canvasH: number,
): ObjectAwareLayoutPayload {
  const productBox = detectProductBox(templatePreset, cardSize, canvasW, canvasH);
  const forbiddenZone = buildForbiddenZone(productBox, cardSize, canvasW, canvasH);
  const safeZones = computeSafeZones(canvasW, canvasH, forbiddenZone);

  let { layout, decision } = chooseAdaptiveLayout(templatePreset, cardSize, productBox, canvasW, safeZones);
  layout = resolveOverlayAgainstForbidden(layout, forbiddenZone, canvasW, canvasH);

  let overlap = measureForbiddenOverlap(layout, forbiddenZone);
  if (overlap > 3200) {
    layout = resolveOverlayAgainstForbidden(compactLayoutForTightSafeZones(layout), forbiddenZone, canvasW, canvasH);
    overlap = measureForbiddenOverlap(layout, forbiddenZone);
    decision = {
      ...decision,
      reason: `${decision.reason}; compact overlay (fewer chips, no arrows)`,
    };
  }

  if (overlap > 0) {
    decision = {
      ...decision,
      reason: `${decision.reason}; residual overlap ~${Math.round(overlap)}px²`,
      avoidedProductOverlap: false,
    };
  }

  return {
    productBox,
    forbiddenZone,
    safeZones,
    layoutDecision: decision,
    adjustedLayout: layout,
  };
}
