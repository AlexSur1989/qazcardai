
export type ProductCardOverlayInput = {
  template: string;
  cardSize: string;
  outputWidth?: number;
  outputHeight?: number;
  aspectRatio?: string;
  productTitle: string;
  benefits: string[];
  extraText: string;
  style: string;
};

type OverlayTemplate = "bottom_panel" | "left_panel" | "badges_callouts";

type TextRole = "title" | "body" | "extra";

type TypographyProfile = {
  id: string;
  titleFont: string;
  bodyFont: string;
  extraFont: string;
  titleWeight: number;
  bodyWeight: number;
  extraWeight: number;
  titleColor: string;
  bodyColor: string;
  extraColor: string;
  panelFill: string;
  panelStroke: string;
  accentFill: string;
  accentColor: string;
  chipFill: string;
  chipStroke: string;
  markerFill: string;
  titleTracking: string;
  bodyTracking: string;
  titleShadow: string;
};

type TextBlock = {
  x: number;
  y: number;
  width: number;
  fontSize: number;
  lineHeight: number;
  maxLines: number;
  anchor?: "start" | "middle";
  role: TextRole;
  letterSpacing?: string;
  shadow?: boolean;
};

const DEFAULT_OUTPUT_WIDTH = 1000;
const DEFAULT_OUTPUT_HEIGHT = 1000;

/** Docker installs Noto + DejaVu; Noto gives better Cyrillic display styles for SVG overlays. */
const BASE_SANS = "Noto Sans, DejaVu Sans, Liberation Sans, Arial, sans-serif";
const DISPLAY_SANS = "Noto Sans Display, Noto Sans, DejaVu Sans, Arial, sans-serif";
const BASE_SERIF = "Noto Serif Display, Noto Serif, DejaVu Serif, Georgia, serif";
const BASE_CONDENSED = "Noto Sans Condensed, Noto Sans, DejaVu Sans Condensed, Arial, sans-serif";

const TYPOGRAPHY: Record<string, TypographyProfile> = {
  clean_marketplace: {
    id: "clean_marketplace",
    titleFont: DISPLAY_SANS,
    bodyFont: BASE_SANS,
    extraFont: BASE_SANS,
    titleWeight: 800,
    bodyWeight: 650,
    extraWeight: 700,
    titleColor: "#0b2530",
    bodyColor: "#12323a",
    extraColor: "#007c93",
    panelFill: "rgba(255,255,255,0.9)",
    panelStroke: "rgba(0,175,202,0.42)",
    accentFill: "#e8f8fb",
    accentColor: "#008ca6",
    chipFill: "rgba(255,255,255,0.82)",
    chipStroke: "rgba(0,175,202,0.24)",
    markerFill: "#00afca",
    titleTracking: "-1.2px",
    bodyTracking: "-0.15px",
    titleShadow: "rgba(255,255,255,0.72)",
  },
  premium: {
    id: "premium",
    titleFont: BASE_SERIF,
    bodyFont: BASE_SANS,
    extraFont: BASE_SANS,
    titleWeight: 800,
    bodyWeight: 550,
    extraWeight: 700,
    titleColor: "#1f1a12",
    bodyColor: "#3a2f1e",
    extraColor: "#8a641b",
    panelFill: "rgba(255,250,240,0.9)",
    panelStroke: "rgba(190,142,46,0.44)",
    accentFill: "#fff0c2",
    accentColor: "#9a6a09",
    chipFill: "rgba(255,255,255,0.76)",
    chipStroke: "rgba(190,142,46,0.24)",
    markerFill: "#c9952f",
    titleTracking: "-0.8px",
    bodyTracking: "0px",
    titleShadow: "rgba(255,255,255,0.66)",
  },
  bright_advertising: {
    id: "bright_advertising",
    titleFont: BASE_CONDENSED,
    bodyFont: BASE_SANS,
    extraFont: BASE_CONDENSED,
    titleWeight: 900,
    bodyWeight: 800,
    extraWeight: 900,
    titleColor: "#072a36",
    bodyColor: "#083947",
    extraColor: "#062632",
    panelFill: "rgba(255,255,255,0.92)",
    panelStroke: "rgba(255,196,0,0.68)",
    accentFill: "#ffe04b",
    accentColor: "#072a36",
    chipFill: "rgba(255,255,255,0.86)",
    chipStroke: "rgba(255,196,0,0.46)",
    markerFill: "#ffcc00",
    titleTracking: "-1px",
    bodyTracking: "-0.2px",
    titleShadow: "rgba(255,231,73,0.82)",
  },
  minimalist: {
    id: "minimalist",
    titleFont: BASE_SANS,
    bodyFont: BASE_SANS,
    extraFont: BASE_SANS,
    titleWeight: 600,
    bodyWeight: 400,
    extraWeight: 600,
    titleColor: "#111827",
    bodyColor: "#374151",
    extraColor: "#6b7280",
    panelFill: "rgba(255,255,255,0.86)",
    panelStroke: "rgba(17,24,39,0.14)",
    accentFill: "#f3f4f6",
    accentColor: "#111827",
    chipFill: "rgba(255,255,255,0.72)",
    chipStroke: "rgba(17,24,39,0.11)",
    markerFill: "#111827",
    titleTracking: "-0.9px",
    bodyTracking: "0px",
    titleShadow: "rgba(255,255,255,0.64)",
  },
  infographic: {
    id: "infographic",
    titleFont: BASE_CONDENSED,
    bodyFont: BASE_SANS,
    extraFont: BASE_SANS,
    titleWeight: 900,
    bodyWeight: 700,
    extraWeight: 800,
    titleColor: "#082f49",
    bodyColor: "#0c4a6e",
    extraColor: "#0369a1",
    panelFill: "rgba(240,249,255,0.92)",
    panelStroke: "rgba(3,105,161,0.34)",
    accentFill: "#e0f2fe",
    accentColor: "#075985",
    chipFill: "rgba(255,255,255,0.82)",
    chipStroke: "rgba(3,105,161,0.24)",
    markerFill: "#0284c7",
    titleTracking: "-1.1px",
    bodyTracking: "-0.1px",
    titleShadow: "rgba(224,242,254,0.82)",
  },
};

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function normalizedTemplate(template: string): OverlayTemplate {
  if (template === "left_panel" || template === "badges_callouts") return template;
  return "bottom_panel";
}

function outputSize(input: ProductCardOverlayInput): { width: number; height: number } {
  const width = Math.round(Number(input.outputWidth));
  const height = Math.round(Number(input.outputHeight));
  return {
    width: Number.isFinite(width) && width > 0 ? width : DEFAULT_OUTPUT_WIDTH,
    height: Number.isFinite(height) && height > 0 ? height : DEFAULT_OUTPUT_HEIGHT,
  };
}

function typographyFor(style: string): TypographyProfile {
  return TYPOGRAPHY[style] ?? TYPOGRAPHY.clean_marketplace;
}

export function buildMarketplaceCardOverlaySpec(input: ProductCardOverlayInput) {
  const benefits = input.benefits.map((item) => item.trim()).filter(Boolean).slice(0, 6);
  const size = outputSize(input);
  const typography = typographyFor(input.style);
  return {
    renderer: "server_svg_overlay_v1",
    template: normalizedTemplate(input.template || "bottom_panel"),
    cardSize: input.cardSize || "square",
    outputWidth: size.width,
    outputHeight: size.height,
    aspectRatio: input.aspectRatio?.trim() || `${size.width}:${size.height}`,
    style: input.style,
    typographyProfileId: typography.id,
    text: {
      title: input.productTitle.trim(),
      benefits,
      extraText: input.extraText.trim(),
    },
  };
}

function svgWrap(width: number, height: number, inner: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <defs>
    <filter id="panelShadow" x="-12%" y="-12%" width="124%" height="134%">
      <feDropShadow dx="0" dy="${Math.max(8, Math.round(height * 0.012))}" stdDeviation="${Math.max(8, Math.round(Math.min(width, height) * 0.014))}" flood-color="#022631" flood-opacity="0.16"/>
    </filter>
    <filter id="softTextShadow" x="-8%" y="-8%" width="116%" height="124%">
      <feDropShadow dx="0" dy="2" stdDeviation="2" flood-color="#ffffff" flood-opacity="0.75"/>
    </filter>
  </defs>
  <rect x="0" y="0" width="${width}" height="${height}" fill="none"/>
${inner}
</svg>`;
}

function fontFamily(profile: TypographyProfile, role: TextRole): string {
  if (role === "title") return profile.titleFont;
  if (role === "extra") return profile.extraFont;
  return profile.bodyFont;
}

function fontWeight(profile: TypographyProfile, role: TextRole): number {
  if (role === "title") return profile.titleWeight;
  if (role === "extra") return profile.extraWeight;
  return profile.bodyWeight;
}

function colorFor(profile: TypographyProfile, role: TextRole): string {
  if (role === "title") return profile.titleColor;
  if (role === "extra") return profile.extraColor;
  return profile.bodyColor;
}

function estimateTextWidth(text: string, fontSize: number): number {
  return [...text].reduce((sum, ch) => {
    if (/\s/.test(ch)) return sum + fontSize * 0.32;
    if (/[A-ZА-ЯЁ0-9]/.test(ch)) return sum + fontSize * 0.62;
    return sum + fontSize * 0.54;
  }, 0);
}

function wrapText(text: string, fontSize: number, maxWidth: number, maxLines: number): string[] {
  const words = text.trim().split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (estimateTextWidth(candidate, fontSize) <= maxWidth || !current) {
      current = candidate;
      continue;
    }
    lines.push(current);
    current = word;
    if (lines.length >= maxLines) break;
  }
  if (current && lines.length < maxLines) lines.push(current);

  if (lines.length === maxLines && words.join(" ") !== lines.join(" ")) {
    const last = lines[lines.length - 1] ?? "";
    lines[lines.length - 1] = `${last.replace(/[.,;:!?-]+$/, "")}...`;
  }
  return lines;
}

function textEl(value: string, block: TextBlock, profile: TypographyProfile): string {
  if (!value.trim()) return "";
  const lines = wrapText(value, block.fontSize, block.width, block.maxLines);
  if (lines.length === 0) return "";
  const anchor = block.anchor ?? "start";
  const textX = anchor === "middle" ? block.x + block.width / 2 : block.x;
  const makeTspans = (dyOffset = 0) => lines
    .map(
      (line, idx) =>
        `<tspan x="${textX}" dy="${idx === 0 ? dyOffset : block.lineHeight}">${escapeXml(line)}</tspan>`,
    )
    .join("");
  const tracking =
    block.letterSpacing ?? (block.role === "title" ? profile.titleTracking : profile.bodyTracking);
  const attrs = `x="${textX}" y="${block.y}" text-anchor="${anchor}" font-size="${block.fontSize}" font-weight="${fontWeight(profile, block.role)}" font-family="${fontFamily(profile, block.role)}" letter-spacing="${tracking}"`;
  const shadow =
    block.shadow || block.role === "title"
      ? `<text ${attrs} fill="${profile.titleShadow}" filter="url(#softTextShadow)">${makeTspans()}</text>`
      : "";
  return `${shadow}<text ${attrs} fill="${colorFor(profile, block.role)}">${makeTspans()}</text>`;
}

function roundRect(
  x: number,
  y: number,
  width: number,
  height: number,
  rx: number,
  fill: string,
  stroke: string,
  attrs = "",
): string {
  return `<rect x="${x}" y="${y}" width="${width}" height="${height}" rx="${rx}" fill="${fill}" stroke="${stroke}" stroke-width="${Math.max(1, Math.round(Math.min(width, height) * 0.006))}" ${attrs}/>`;
}

function pct(value: number, total: number): number {
  return Math.round(value * total);
}

function line(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  stroke: string,
  width: number,
): string {
  return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${stroke}" stroke-width="${width}" stroke-linecap="round"/>`;
}

function circle(cx: number, cy: number, r: number, fill: string, stroke = "none"): string {
  return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${fill}" stroke="${stroke}"/>`;
}

function accentPill(
  text: string,
  x: number,
  y: number,
  width: number,
  height: number,
  profile: TypographyProfile,
  fontSize: number,
  anchor: "start" | "middle" = "middle",
): string {
  if (!text.trim()) return "";
  return [
    roundRect(x, y, width, height, Math.round(height / 2), profile.accentFill, profile.panelStroke),
    textEl(text.trim().toUpperCase(), {
      x: x + width * 0.12,
      y: y + height * 0.62,
      width: width * 0.76,
      fontSize,
      lineHeight: fontSize,
      maxLines: 1,
      anchor,
      role: "extra",
      letterSpacing: "1.2px",
    }, profile),
  ].join("\n  ");
}

function chip(
  label: string,
  x: number,
  y: number,
  width: number,
  height: number,
  profile: TypographyProfile,
  fontSize: number,
  marker: "dot" | "number",
  index: number,
): string {
  const markerSize = Math.round(height * 0.34);
  const markerX = x + Math.round(height * 0.44);
  const markerY = y + Math.round(height * 0.5);
  const markerEl =
    marker === "number"
      ? [
          circle(markerX, markerY, markerSize / 2, profile.accentFill, profile.panelStroke),
          textEl(String(index + 1), {
            x: markerX - markerSize * 0.24,
            y: markerY + markerSize * 0.22,
            width: markerSize * 0.5,
            fontSize: Math.round(markerSize * 0.62),
            lineHeight: markerSize,
            maxLines: 1,
            role: "extra",
            anchor: "middle",
          }, profile),
        ].join("\n  ")
      : circle(markerX, markerY, markerSize / 2, profile.markerFill);
  return [
    roundRect(x, y, width, height, Math.round(height * 0.38), profile.chipFill, profile.chipStroke),
    markerEl,
    textEl(label, {
      x: x + Math.round(height * 0.82),
      y: y + Math.round(height * 0.58),
      width: width - Math.round(height * 1.08),
      fontSize,
      lineHeight: Math.round(fontSize * 1.12),
      maxLines: 1,
      role: "body",
    }, profile),
  ].join("\n  ");
}

function renderBottomPanel(
  width: number,
  height: number,
  title: string,
  benefits: string[],
  extra: string,
  profile: TypographyProfile,
): string {
  const pad = pct(0.055, width);
  const panelX = pct(0.055, width);
  const panelY = pct(height > width ? 0.61 : 0.59, height);
  const panelW = pct(0.89, width);
  const panelH = Math.min(pct(0.34, height), height - panelY - pct(0.045, height));
  const titleSize = Math.round(Math.min(width, height) * (height > width ? 0.044 : 0.052));
  const bodySize = Math.round(Math.min(width, height) * (height > width ? 0.023 : 0.029));
  const extraSize = Math.round(Math.min(width, height) * 0.0185);
  const contentX = panelX + pad * 0.55;
  const contentW = panelW - pad * 1.1;
  const chipGap = Math.round(Math.min(width, height) * 0.014);
  const chipTop = panelY + Math.round(panelH * 0.47);
  const useTwoCols = width >= 900;
  const chipW = useTwoCols ? Math.round((contentW - chipGap) / 2) : contentW;
  const chipH = Math.round(Math.min(width, height) * (height > width ? 0.054 : 0.062));

  const benefitEls = benefits.slice(0, 4).map((benefit, idx) => {
    const col = useTwoCols ? idx % 2 : 0;
    const row = useTwoCols ? Math.floor(idx / 2) : idx;
    return chip(
      benefit,
      contentX + col * (chipW + chipGap),
      chipTop + row * (chipH + chipGap),
      chipW,
      chipH,
      profile,
      bodySize,
      "dot",
      idx,
    );
  });
  const pillW = Math.min(contentW * 0.54, Math.max(contentW * 0.34, estimateTextWidth(extra, extraSize) + pad));
  const pillH = Math.round(extraSize * 2.3);

  return [
    roundRect(panelX, panelY, panelW, panelH, Math.round(Math.min(width, height) * 0.038), profile.panelFill, profile.panelStroke, 'filter="url(#panelShadow)"'),
    line(contentX, panelY + Math.round(panelH * 0.11), contentX + Math.round(contentW * 0.18), panelY + Math.round(panelH * 0.11), profile.markerFill, Math.max(3, Math.round(Math.min(width, height) * 0.006))),
    textEl(title, {
      x: contentX,
      y: panelY + Math.round(panelH * 0.22),
      width: contentW,
      fontSize: titleSize,
      lineHeight: Math.round(titleSize * 1.18),
      maxLines: 2,
      role: "title",
      shadow: true,
    }, profile),
    ...benefitEls,
    accentPill(extra, contentX, panelY + panelH - pillH - Math.round(panelH * 0.07), pillW, pillH, profile, extraSize),
  ].filter(Boolean).join("\n  ");
}

function renderLeftPanel(
  width: number,
  height: number,
  title: string,
  benefits: string[],
  extra: string,
  profile: TypographyProfile,
): string {
  const panelX = pct(0.055, width);
  const panelY = pct(0.07, height);
  const panelW = pct(width > height ? 0.36 : 0.43, width);
  const panelH = pct(0.86, height);
  const pad = pct(0.035, width);
  const titleSize = Math.round(Math.min(width, height) * 0.04);
  const bodySize = Math.round(Math.min(width, height) * 0.0225);
  const extraSize = Math.round(Math.min(width, height) * 0.02);
  const contentX = panelX + pad;
  const contentW = panelW - pad * 2;
  const chipH = Math.round(Math.min(width, height) * 0.064);
  const chipGap = Math.round(Math.min(width, height) * 0.016);
  const chipTop = panelY + Math.round(panelH * 0.31);

  const benefitEls = benefits.slice(0, 5).map((benefit, idx) =>
    chip(
      benefit,
      contentX,
      chipTop + idx * (chipH + chipGap),
      contentW,
      chipH,
      profile,
      bodySize,
      "number",
      idx,
    ),
  );
  const pillH = Math.round(extraSize * 2.4);

  return [
    roundRect(panelX, panelY, panelW, panelH, Math.round(Math.min(width, height) * 0.032), profile.panelFill, profile.panelStroke, 'filter="url(#panelShadow)"'),
    line(contentX, panelY + Math.round(panelH * 0.055), contentX + Math.round(contentW * 0.24), panelY + Math.round(panelH * 0.055), profile.markerFill, Math.max(3, Math.round(Math.min(width, height) * 0.006))),
    textEl(title, {
      x: contentX,
      y: panelY + pct(0.12, panelH),
      width: contentW,
      fontSize: titleSize,
      lineHeight: Math.round(titleSize * 1.18),
      maxLines: 3,
      role: "title",
      shadow: true,
    }, profile),
    ...benefitEls,
    accentPill(extra, contentX, panelY + panelH - pillH - Math.round(panelH * 0.045), contentW, pillH, profile, extraSize),
  ].filter(Boolean).join("\n  ");
}

function renderBadges(
  width: number,
  height: number,
  title: string,
  benefits: string[],
  extra: string,
  profile: TypographyProfile,
): string {
  const titleW = pct(width > height ? 0.56 : 0.78, width);
  const titleX = (width - titleW) / 2;
  const titleY = pct(0.05, height);
  const titleH = pct(0.15, height);
  const titleSize = Math.round(Math.min(width, height) * 0.037);
  const bodySize = Math.round(Math.min(width, height) * 0.0225);
  const extraSize = Math.round(Math.min(width, height) * 0.02);

  const badgeW = pct(width > height ? 0.28 : 0.37, width);
  const badgeH = Math.max(pct(0.078, height), bodySize * 2.45);
  const positions = [
    { x: pct(0.06, width), y: pct(0.28, height) },
    { x: width - pct(0.06, width) - badgeW, y: pct(0.34, height) },
    { x: pct(0.06, width), y: pct(0.52, height) },
    { x: width - pct(0.06, width) - badgeW, y: pct(0.6, height) },
    { x: pct(0.11, width), y: pct(0.75, height) },
    { x: width - pct(0.11, width) - badgeW, y: pct(0.78, height) },
  ];

  const badges = benefits.slice(0, 6).flatMap((benefit, idx) => {
    const p = positions[idx] ?? positions[0];
    const x = p.x;
    const y = p.y;
    return [
      chip(benefit, x, y, badgeW, badgeH, profile, bodySize, "dot", idx),
    ];
  });

  const extraW = pct(0.72, width);
  const extraH = Math.round(extraSize * 2.35);
  return [
    roundRect(titleX, titleY, titleW, titleH, Math.round(Math.min(width, height) * 0.032), profile.panelFill, profile.panelStroke, 'filter="url(#panelShadow)"'),
    line(titleX + titleW * 0.32, titleY + titleH * 0.22, titleX + titleW * 0.68, titleY + titleH * 0.22, profile.markerFill, Math.max(3, Math.round(Math.min(width, height) * 0.005))),
    textEl(title, {
      x: titleX + pct(0.035, width),
      y: titleY + Math.round(titleH * 0.57),
      width: titleW - pct(0.05, width),
      fontSize: titleSize,
      lineHeight: Math.round(titleSize * 1.15),
      maxLines: 2,
      anchor: "middle",
      role: "title",
      shadow: true,
    }, profile),
    ...badges,
    accentPill(extra, (width - extraW) / 2, pct(0.925, height), extraW, extraH, profile, extraSize),
  ].filter(Boolean).join("\n  ");
}

export function renderMarketplaceCardOverlaySvg(input: ProductCardOverlayInput): string {
  const spec = buildMarketplaceCardOverlaySpec(input);
  const title = spec.text.title.trim();
  const extraText = spec.text.extraText.trim();
  const benefits = spec.text.benefits;
  const tpl = spec.template;
  const width = spec.outputWidth;
  const height = spec.outputHeight;
  const profile = typographyFor(spec.style);
  const inner =
    tpl === "left_panel"
      ? renderLeftPanel(width, height, title, benefits, extraText, profile)
      : tpl === "badges_callouts"
        ? renderBadges(width, height, title, benefits, extraText, profile)
        : renderBottomPanel(width, height, title, benefits, extraText, profile);

  return svgWrap(width, height, inner);
}
