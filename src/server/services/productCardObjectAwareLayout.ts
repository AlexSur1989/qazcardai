import type { ProductCardCanvasId, ProductCardLayoutPreset, RectZone } from "@/config/product-card-overlay-presets";
import { getProductCardLayoutPreset } from "@/config/product-card-overlay-presets";

export type BoundingBox = RectZone & {
  confidence?: number;
  source?: "cutout" | "vision" | "estimated" | "raster_estimate";
};

export type SafeZone = { key: string; x: number; y: number; width: number; height: number };

export type ProductAnchor =
  | "product_left"
  | "product_right"
  | "product_center"
  | "product_large_center";

export type LayoutDecision = {
  selectedLayoutKey: string;
  productAnchor: ProductAnchor;
  /** Сколько слотов benefit-зон в preset (после compact / anchor). */
  benefitSlots: number;
  compact: boolean;
  mirroredHorizontally: boolean;
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

export function inferProductAnchor(
  box: RectZone,
  canvasW: number,
  canvasH: number,
): ProductAnchor {
  const area = Math.max(1, box.width * box.height);
  const canvasA = Math.max(1, canvasW * canvasH);
  const areaRatio = area / canvasA;
  if (areaRatio >= 0.36) return "product_large_center";

  const cx = (box.x + box.width / 2) / canvasW;
  const cy = (box.y + box.height / 2) / canvasH;

  if (
    areaRatio <= 0.32 &&
    cx > 0.36 &&
    cx < 0.64 &&
    cy > 0.3 &&
    cy < 0.72
  ) {
    return "product_center";
  }
  if (cx < 0.42) return "product_left";
  if (cx > 0.58) return "product_right";
  return "product_center";
}

function areaRect(r: RectZone): number {
  return Math.max(0, r.width) * Math.max(0, r.height);
}

function iou(a: RectZone, b: RectZone): number {
  const inter = intersectionArea(a, b);
  const u = areaRect(a) + areaRect(b) - inter;
  return u <= 0 ? 0 : inter / u;
}

/**
 * Слияние эвристики шаблона и bbox с растра: при сомнении оставляем более консервативный (шаблон).
 */
export function pickSubjectProductBox(
  heuristic: BoundingBox,
  raster: BoundingBox | null | undefined,
  canvasW: number,
  canvasH: number,
): BoundingBox {
  const h = { ...heuristic, ...clampRectToCanvas(heuristic, canvasW, canvasH) };
  if (!raster || (raster.confidence ?? 0) < 0.39) {
    return h;
  }
  const r = { ...raster, ...clampRectToCanvas(raster, canvasW, canvasH) };
  const canvasA = Math.max(1, canvasW * canvasH);
  if (areaRect(r) / canvasA < 0.014) return h;

  const overlap = iou(r, h);
  if ((r.confidence ?? 0) >= 0.55 && overlap >= 0.05) return r;
  if ((r.confidence ?? 0) >= 0.48 && overlap >= 0.02) return r;
  if (areaRect(r) > areaRect(h) * 1.45 && (r.confidence ?? 0) >= 0.44) return r;
  return h;
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

/**
 * Расширение запретной зоны для длинных по горизонтали или вертикали товаров (strict overlay).
 */
export function expandForbiddenZoneForAspectRatio(
  forbidden: RectZone,
  subject: RectZone,
  canvasW: number,
  canvasH: number,
): RectZone {
  const sw = Math.max(subject.width, 4);
  const sh = Math.max(subject.height, 4);
  let r = clampRectToCanvas({ ...forbidden }, canvasW, canvasH);
  if (sw / sh >= 1.8) {
    const cx = r.x + r.width / 2;
    const nw = r.width * 1.1;
    const nx = Math.round(cx - nw / 2);
    r = clampRectToCanvas({ x: nx, y: r.y, width: Math.round(nw), height: r.height }, canvasW, canvasH);
  }
  if (sh / sw >= 1.8) {
    const cy = r.y + r.height / 2;
    const nh = r.height * 1.1;
    const ny = Math.round(cy - nh / 2);
    r = clampRectToCanvas({ x: r.x, y: ny, width: r.width, height: Math.round(nh) }, canvasW, canvasH);
  }
  return r;
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

export function mirrorLayoutHorizontally(
  layout: ProductCardLayoutPreset,
  canvasW: number,
): ProductCardLayoutPreset {
  const flip = (r: RectZone): RectZone => ({
    ...r,
    x: canvasW - r.x - r.width,
  });
  const flipPt = (p: import("@/config/product-card-overlay-presets").PointZone) => ({
    x: canvasW - p.x,
    y: p.y,
  });
  const out = cloneLayoutPreset(layout);
  out.title = flip(out.title);
  out.subtitle = flip(out.subtitle);
  out.productSafeArea = flip(out.productSafeArea);
  out.benefits = out.benefits.map(flip);
  out.badges = out.badges.map(flip);
  out.callouts = out.callouts.map(flip);
  out.footer = flip(out.footer);
  out.arrows = out.arrows.map((a) => ({
    from: flipPt(a.from),
    to: flipPt(a.to),
  }));
  return out;
}

function anchorNudgeTowardFreeSide(
  layout: ProductCardLayoutPreset,
  anchor: ProductAnchor,
  forbidden: RectZone,
  canvasW: number,
  canvasH: number,
): void {
  if (canvasW <= 8) return;
  const fcx = forbidden.x + forbidden.width / 2;
  const steer =
    anchor === "product_large_center"
      ? 60
      : anchor === "product_center"
        ? 42
        : 26;
  const edgeLeft = forbidden.x;
  const edgeRight = canvasW - (forbidden.x + forbidden.width);
  const preferLeft = edgeLeft >= edgeRight * 0.92;
  const preferRight = edgeRight >= edgeLeft * 0.92;
  let dx = 0;
  if (anchor === "product_right" || (fcx > canvasW * 0.52 && !preferLeft)) {
    dx = -steer;
  } else if (anchor === "product_left" || (fcx < canvasW * 0.48 && !preferRight)) {
    dx = steer;
  } else if (anchor === "product_center" || anchor === "product_large_center") {
    dx = fcx < canvasW * 0.5 ? steer * 0.35 : -steer * 0.35;
  }
  if (Math.abs(dx) < 1) return;
  const shift = (r: RectZone) => {
    r.x = Math.max(0, Math.min(canvasW - r.width, r.x + dx));
  };
  shift(layout.title);
  shift(layout.subtitle);
  for (const b of layout.benefits) shift(b);
  for (const b of layout.badges) shift(b);
  shift(layout.footer);
  const dy = anchor === "product_large_center" ? -Math.round(canvasH * 0.02) : 0;
  if (dy !== 0) {
    const vshift = (r: RectZone) => {
      r.y = Math.max(0, Math.min(canvasH - r.height, r.y + dy));
    };
    vshift(layout.title);
    vshift(layout.subtitle);
    for (const b of layout.benefits) vshift(b);
    vshift(layout.footer);
  }
}

export function chooseAdaptiveLayout(
  templatePreset: string | undefined,
  cardSize: string | undefined,
  productBox: RectZone,
  canvasW: number,
  canvasH: number,
  safeZones: SafeZone[],
  forbidden: RectZone,
): { layout: ProductCardLayoutPreset; decision: LayoutDecision } {
  const base = getProductCardLayoutPreset(templatePreset, cardSize);
  let layout = cloneLayoutPreset(base);
  const anchor = inferProductAnchor(productBox, canvasW, canvasH);
  let mirrored = false;

  if (anchor === "product_left") {
    layout = mirrorLayoutHorizontally(layout, canvasW);
    mirrored = true;
  }

  const cx = productBox.x + productBox.width / 2;
  const pxNorm = canvasW > 0 ? cx / canvasW : 0.5;
  const reasonParts: string[] = [`Anchor: ${anchor}`];
  const shiftX = pxNorm > 0.54 ? -28 : pxNorm < 0.46 ? 28 : 0;
  if (shiftX !== 0) {
    reasonParts.push(
      pxNorm > 0.54
        ? "центр товара правее — сдвиг текста влево"
        : "центр товара левее — сдвиг текста вправо",
    );
    layout.title.x += shiftX;
    layout.subtitle.x += shiftX;
    for (const b of layout.benefits) b.x += shiftX;
    for (const b of layout.badges) b.x += shiftX;
    layout.footer.x += shiftX;
  }

  anchorNudgeTowardFreeSide(layout, anchor, forbidden, canvasW, canvasH);

  if (anchor === "product_large_center") {
    while (layout.benefits.length > 3) layout.benefits.pop();
    while (layout.badges.length > 1) layout.badges.pop();
    layout.arrows = [];
    reasonParts.push("крупный центр — компактные benefits");
  } else if (anchor === "product_center") {
    while (layout.benefits.length > 4) layout.benefits.pop();
    reasonParts.push("центр — ограничение benefits");
  }

  const topZ = safeZones.find((z) => z.key === "top");
  const topArea = topZ ? topZ.width * topZ.height : 0;
  const bottomZ = safeZones.find((z) => z.key === "bottom");
  const bottomArea = bottomZ ? bottomZ.width * bottomZ.height : 0;
  if (topArea + bottomArea < canvasW * canvasH * 0.14) {
    reasonParts.push("мало вертикального safe space");
  }

  return {
    layout,
    decision: {
      selectedLayoutKey: layout.key,
      productAnchor: anchor,
      benefitSlots: layout.benefits.length,
      compact: anchor === "product_large_center",
      mirroredHorizontally: mirrored,
      reason: reasonParts.join("; "),
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

export type BuildObjectAwareOptions = {
  subjectBoxOverride?: BoundingBox | null;
  /** Расширить forbidden после построения (частный случай финального marketplace-композита). */
  strictMarketplace?: boolean;
};

export function buildObjectAwarePayload(
  templatePreset: string | undefined,
  cardSize: string | undefined,
  canvasW: number,
  canvasH: number,
  options?: BuildObjectAwareOptions,
): ObjectAwareLayoutPayload {
  const heuristic = detectProductBox(templatePreset, cardSize, canvasW, canvasH);
  const productBox = pickSubjectProductBox(
    heuristic,
    options?.subjectBoxOverride,
    canvasW,
    canvasH,
  );
  let forbiddenZone = buildForbiddenZone(productBox, cardSize, canvasW, canvasH);
  if (options?.strictMarketplace) {
    forbiddenZone = expandForbiddenZoneForAspectRatio(
      forbiddenZone,
      productBox,
      canvasW,
      canvasH,
    );
  }
  const safeZones = computeSafeZones(canvasW, canvasH, forbiddenZone);

  let { layout, decision } = chooseAdaptiveLayout(
    templatePreset,
    cardSize,
    productBox,
    canvasW,
    canvasH,
    safeZones,
    forbiddenZone,
  );
  layout = resolveOverlayAgainstForbidden(layout, forbiddenZone, canvasW, canvasH);

  let overlap = measureForbiddenOverlap(layout, forbiddenZone);
  if (overlap > 3200) {
    layout = resolveOverlayAgainstForbidden(compactLayoutForTightSafeZones(layout), forbiddenZone, canvasW, canvasH);
    overlap = measureForbiddenOverlap(layout, forbiddenZone);
    decision = {
      ...decision,
      compact: true,
      benefitSlots: layout.benefits.length,
      reason: `${decision.reason}; compact overlay (меньше плашек, без стрелок)`,
    };
  }

  if (overlap > 0) {
    decision = {
      ...decision,
      reason: `${decision.reason}; остаточное пересечение ~${Math.round(overlap)}px²`,
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
