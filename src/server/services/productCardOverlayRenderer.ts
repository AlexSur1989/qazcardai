import {
  getProductCardTemplatePreset,
  getProductCardTypographyPreset,
  getProductCardLayoutKey,
  resolveProductCardCanvas,
} from "@/config/product-card-overlay-presets";
import type { ProductCardTemplatePresetId, ProductCardTypographyPresetId } from "@/config/product-card-overlay-presets";
import { estimateTextWidth, fitTextToBox } from "@/lib/fit-text-to-box";
import { buildObjectAwarePayload, type ObjectAwareLayoutPayload } from "@/server/services/productCardObjectAwareLayout";

export type ProductCardOverlayInput = {
  template: string;
  cardSize: string;
  outputWidth?: number;
  outputHeight?: number;
  aspectRatio?: string;
  productTitle: string;
  subtitle?: string;
  benefits: string[];
  extraText: string;
  statsText?: string;
  sizeText?: string;
  style: string;
  templatePreset?: ProductCardTemplatePresetId | string;
  typographyPreset?: ProductCardTypographyPresetId | string;
  overlayVersion?: "v1" | "v2";
  useIcons?: boolean;
  useArrows?: boolean;
  useShadows?: boolean;
  preserveProductLabel?: boolean;
  /** preview = схема зон; production = только итоговый оверлей */
  overlayRenderMode?: "production" | "preview";
  /** Только для админов: запретная зона и safe zones */
  layoutDebug?: boolean;
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
  /** Ограничить общую высоту блока (плашка / подзаголовок). */
  maxBoxHeight?: number;
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

function layoutAnalysisForMetadata(
  templatePresetId: string,
  cardSizeId: string,
  width: number,
  height: number,
): Pick<ObjectAwareLayoutPayload, "productBox" | "forbiddenZone" | "safeZones" | "layoutDecision"> {
  const p = buildObjectAwarePayload(templatePresetId, cardSizeId, width, height);
  return {
    productBox: p.productBox,
    forbiddenZone: p.forbiddenZone,
    safeZones: p.safeZones,
    layoutDecision: p.layoutDecision,
  };
}

export function buildMarketplaceCardOverlaySpec(input: ProductCardOverlayInput) {
  const benefits = input.benefits.map((item) => item.trim()).filter(Boolean).slice(0, 6);
  const size = outputSize(input);
  const useV2 = input.overlayVersion === "v2" || Boolean(input.templatePreset);
  if (useV2) {
    const canvas = resolveProductCardCanvas(input.cardSize || "square");
    const width = input.outputWidth ?? canvas.width;
    const height = input.outputHeight ?? canvas.height;
    const templatePreset = getProductCardTemplatePreset(input.templatePreset);
    const typography = getProductCardTypographyPreset(input.typographyPreset);
    return {
      renderer: "server_svg_overlay_v2",
      overlayVersion: "v2",
      template: normalizedTemplate(input.template || "bottom_panel"),
      templatePreset: templatePreset.id,
      templateLayoutKey: getProductCardLayoutKey(templatePreset.id, canvas.id),
      cardSize: canvas.id,
      outputWidth: width,
      outputHeight: height,
      aspectRatio: input.aspectRatio?.trim() || canvas.aspectRatio,
      style: input.style,
      typographyPreset: typography.id,
      typographyProfileId: typography.id,
      theme: templatePreset.theme,
      useIcons: input.useIcons !== false,
      useArrows: input.useArrows !== false,
      useShadows: input.useShadows !== false,
      preserveProductLabel: input.preserveProductLabel === true,
      layoutAnalysis: layoutAnalysisForMetadata(templatePreset.id, canvas.id, width, height),
      text: {
        title: input.productTitle.trim(),
        subtitle: input.subtitle?.trim() ?? "",
        benefits,
        extraText: input.extraText.trim(),
        statsText: input.statsText?.trim() ?? "",
        sizeText: input.sizeText?.trim() ?? "",
      },
    };
  }
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

function textEl(value: string, block: TextBlock, profile: TypographyProfile): string {
  if (!value.trim()) return "";
  const lineHeightFactor = block.fontSize > 0 ? block.lineHeight / block.fontSize : 1.12;
  const approxHeight = block.maxBoxHeight ?? block.lineHeight * block.maxLines * 1.08;
  const fit = fitTextToBox(value, { width: block.width, height: approxHeight }, {
    maxWidth: block.width,
    maxLines: block.maxLines,
    maxFontSize: block.fontSize,
    minFontSize: Math.max(8, Math.round(block.fontSize * 0.38)),
    lineHeightFactor,
  });
  const lines = fit.lines;
  if (lines.length === 0) return "";
  const fontSize = fit.fontSize;
  const lineHeight = fit.lineHeight;
  const anchor = block.anchor ?? "start";
  const textX = anchor === "middle" ? block.x + block.width / 2 : block.x;
  const makeTspans = (dyOffset = 0) => lines
    .map(
      (line, idx) =>
        `<tspan x="${textX}" dy="${idx === 0 ? dyOffset : lineHeight}">${escapeXml(line)}</tspan>`,
    )
    .join("");
  const tracking =
    block.letterSpacing ?? (block.role === "title" ? profile.titleTracking : profile.bodyTracking);
  const attrs = `x="${textX}" y="${block.y}" text-anchor="${anchor}" font-size="${fontSize}" font-weight="${fontWeight(profile, block.role)}" font-family="${fontFamily(profile, block.role)}" letter-spacing="${tracking}"`;
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
      maxBoxHeight: Math.round(height * 0.78),
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
      maxLines: 2,
      maxBoxHeight: Math.round(height * 0.62),
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


function v2TypographyProfile(input: ProductCardOverlayInput): TypographyProfile {
  const template = getProductCardTemplatePreset(input.templatePreset);
  const typography = getProductCardTypographyPreset(input.typographyPreset);
  return {
    id: typography.id,
    titleFont: typography.titleFont,
    bodyFont: typography.bodyFont,
    extraFont: typography.bodyFont,
    titleWeight: typography.titleWeight,
    bodyWeight: typography.bodyWeight,
    extraWeight: Math.max(500, typography.bodyWeight),
    titleColor: template.textColor,
    bodyColor: template.textColor,
    extraColor: template.mutedTextColor,
    panelFill: template.panelFill,
    panelStroke: template.panelStroke,
    accentFill: template.accentColor,
    accentColor: template.accentColor,
    chipFill: template.panelFill,
    chipStroke: template.panelStroke,
    markerFill: template.accentColor,
    titleTracking: "-0.8px",
    bodyTracking: "0px",
    titleShadow: template.theme === "dark" ? "rgba(0,0,0,0.45)" : "rgba(255,255,255,0.75)",
  };
}

function iconIdForBenefit(value: string): string {
  const s = value.toLowerCase();
  if (/зим|холод|қар|суық|тепл|warm/.test(s)) return "snowflake";
  if (/солн|күн|uv|spf/.test(s)) return "sun";
  if (/вода|ылғал|капл|moist|hydr/.test(s)) return "droplet";
  if (/защит|қорға|safe|shield/.test(s)) return "shield";
  if (/эко|натур|leaf|табиғи/.test(s)) return "leaf";
  if (/белок|protein|протеин/.test(s)) return "protein";
  if (/вес|weight|жеңіл|легк/.test(s)) return "weight";
  if (/размер|size|өлшем/.test(s)) return "size";
  if (/ткан|fabric|материал/.test(s)) return "fabric";
  if (/кожа|skin|тері/.test(s)) return "skin";
  if (/глаз|көз|очки|eye/.test(s)) return "eye";
  if (/энерг|қуат|power/.test(s)) return "lightning";
  if (/преми|сапа|quality|premium/.test(s)) return "star";
  return "check";
}

function iconPath(id: string): string {
  const paths: Record<string, string> = {
    check: '<path d="M7 13l3 3 7-8"/>',
    star: '<path d="M12 4l2.1 4.3 4.8.7-3.5 3.4.8 4.8-4.2-2.2-4.2 2.2.8-4.8L5.1 9l4.8-.7L12 4z"/>',
    shield: '<path d="M12 4l6 2.6v4.6c0 3.8-2.4 7.1-6 8.5-3.6-1.4-6-4.7-6-8.5V6.6L12 4z"/>',
    leaf: '<path d="M6 18c7 0 11-5 12-12-7 0-12 4-12 10v2z"/><path d="M6 18c3-4 6-7 10-9"/>',
    droplet: '<path d="M12 4s5 6 5 9.5a5 5 0 0 1-10 0C7 10 12 4 12 4z"/>',
    snowflake: '<path d="M12 4v16M5 8l14 8M19 8L5 16"/>',
    sun: '<circle cx="12" cy="12" r="3.5"/><path d="M12 3v2.5M12 18.5V21M3 12h2.5M18.5 12H21M5.6 5.6l1.8 1.8M16.6 16.6l1.8 1.8M18.4 5.6l-1.8 1.8M7.4 16.6l-1.8 1.8"/>',
    protein: '<path d="M7 6h10l2 4-7 9-7-9 2-4z"/><path d="M8 10h8"/>',
    weight: '<path d="M7 10h10l1.5 9h-13L7 10z"/><path d="M9 10a3 3 0 0 1 6 0"/>',
    size: '<path d="M5 8V5h3M19 8V5h-3M5 16v3h3M19 16v3h-3M8 5l8 14"/>',
    fabric: '<path d="M5 7c4-2 10-2 14 0v10c-4-2-10-2-14 0V7z"/><path d="M9 6v12M15 6v12"/>',
    skin: '<path d="M7.5 17c0-3.5 2-6 4.5-6s4.5 2.5 4.5 6"/><circle cx="12" cy="7" r="3"/>',
    eye: '<path d="M3 12s3.5-5 9-5 9 5 9 5-3.5 5-9 5-9-5-9-5z"/><circle cx="12" cy="12" r="2.5"/>',
    lightning: '<path d="M13 3L5 14h6l-1 7 8-11h-6l1-7z"/>',
  };
  return paths[id] ?? paths.check!;
}

function iconCircle(
  icon: string,
  cx: number,
  cy: number,
  r: number,
  profile: TypographyProfile,
  invert = false,
): string {
  const fill = invert ? profile.markerFill : profile.accentFill;
  const stroke = invert ? "#ffffff" : profile.markerFill;
  return `<g>
    <circle cx="${cx}" cy="${cy}" r="${r}" fill="${fill}" opacity="0.94"/>
    <g transform="translate(${cx - r * 0.58} ${cy - r * 0.58}) scale(${(r * 1.16) / 24})" fill="none" stroke="${stroke}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${iconPath(icon)}</g>
  </g>`;
}

function panelAttrs(useShadows: boolean): string {
  return useShadows ? 'filter="url(#panelShadow)"' : "";
}

function renderV2BenefitCard(
  label: string,
  zone: { x: number; y: number; width: number; height: number },
  profile: TypographyProfile,
  fontSize: number,
  index: number,
  useIcons: boolean,
  useShadows: boolean,
  templateId: string,
): string {
  // Увеличиваем скругление и размер иконки для большей схожести с референсом
  const r = Math.max(24, Math.round(Math.min(zone.width, zone.height) * 0.28));
  const iconR = Math.max(20, Math.round(zone.height * 0.28));
  
  const isCleanTpl = templateId === "light_marketplace" || templateId === "dark_infographic";
  const iconX = isCleanTpl ? zone.x + Math.round(zone.height * 0.25) : zone.x + Math.round(zone.height * 0.45);
  const iconY = zone.y + Math.round(zone.height / 2);
  const textX = useIcons ? iconX + iconR + Math.round(zone.height * 0.25) : zone.x + Math.round(zone.width * 0.08);
  const textW = zone.x + zone.width - textX - Math.round(zone.width * 0.06);
  
  // Увеличиваем размер шрифта для плашек преимуществ
  const adjustedFontSize = Math.round(fontSize * 1.15);

  const bg = isCleanTpl ? "" : roundRect(zone.x, zone.y, zone.width, zone.height, r, profile.chipFill, profile.chipStroke, panelAttrs(useShadows));

  return [
    bg,
    useIcons ? iconCircle(iconIdForBenefit(label), iconX, iconY, iconR, profile) : circle(iconX, iconY, Math.max(5, iconR * 0.25), profile.markerFill),
    textEl(label, {
      x: textX,
      y: zone.y + Math.round(zone.height * 0.55),
      width: textW,
      fontSize: adjustedFontSize,
      lineHeight: Math.round(adjustedFontSize * 1.18),
      maxLines: 2,
      maxBoxHeight: Math.round(zone.height * 0.62),
      role: "body",
      shadow: isCleanTpl, // добавляем тень тексту, если нет плашки
    }, profile),
  ].filter(Boolean).join("\n  ");
}

function arrowPath(from: { x: number; y: number }, to: { x: number; y: number }, color: string): string {
  const midX = Math.round((from.x + to.x) / 2);
  const d = `M ${from.x} ${from.y} C ${midX} ${from.y}, ${midX} ${to.y}, ${to.x} ${to.y}`;
  return `<path d="${d}" fill="none" stroke="${color}" stroke-width="3" stroke-linecap="round" opacity="0.68"/><circle cx="${to.x}" cy="${to.y}" r="5" fill="${color}" opacity="0.78"/>`;
}

type ProductCardLayoutRect = import("@/config/product-card-overlay-presets").RectZone;

function dashedZoneRect(
  z: ProductCardLayoutRect,
  stroke: string,
  opacity: number,
  dash = "9 11",
): string {
  return `<rect x="${z.x}" y="${z.y}" width="${z.width}" height="${z.height}" rx="${Math.round(Math.min(z.width, z.height) * 0.04)}" fill="none" stroke="${stroke}" stroke-dasharray="${dash}" stroke-width="2" opacity="${opacity}"/>`;
}

function overlaySchematicLayer(
  layout: import("@/config/product-card-overlay-presets").ProductCardLayoutPreset,
  awareness: ObjectAwareLayoutPayload,
  profile: TypographyProfile,
  renderMode: "production" | "preview" | undefined,
  layoutDebug: boolean | undefined,
  minSide: number,
): string {
  if (renderMode !== "preview" && !layoutDebug) return "";
  const layers: string[] = [];
  const muted = profile.bodyColor;
  if (renderMode === "preview") {
    layers.push(dashedZoneRect(awareness.productBox, profile.markerFill, 0.42));
    layers.push(dashedZoneRect(layout.title, muted, 0.32));
    layers.push(dashedZoneRect(layout.subtitle, muted, 0.28));
    for (const b of layout.benefits) {
      layers.push(dashedZoneRect(b, profile.accentColor, 0.26));
    }
    for (const b of layout.badges) {
      layers.push(dashedZoneRect(b, profile.accentColor, 0.24, "6 8"));
    }
    layers.push(dashedZoneRect(layout.footer, muted, 0.22, "4 7"));
    const tag = Math.max(12, Math.round(minSide * 0.018));
    layers.push(
      `<text x="${awareness.productBox.x + 8}" y="${awareness.productBox.y + tag + 4}" font-size="${tag}" fill="${muted}" opacity="0.5" font-family="${profile.bodyFont}">Товар</text>`,
    );
    layers.push(
      `<text x="${layout.title.x + 8}" y="${layout.title.y + tag + 4}" font-size="${tag}" fill="${muted}" opacity="0.5" font-family="${profile.bodyFont}">Заголовок</text>`,
    );
    layers.push(
      `<text x="${layout.subtitle.x + 8}" y="${layout.subtitle.y + tag + 3}" font-size="${Math.max(11, tag - 2)}" fill="${muted}" opacity="0.45" font-family="${profile.bodyFont}">Подзаголовок</text>`,
    );
  }
  if (layoutDebug) {
    const f = awareness.forbiddenZone;
    layers.push(
      `<rect x="${f.x}" y="${f.y}" width="${f.width}" height="${f.height}" fill="rgba(239,68,68,0.12)" stroke="rgba(220,38,38,0.55)" stroke-width="2" stroke-dasharray="4 6" opacity="0.95"/>`,
    );
    for (const s of awareness.safeZones) {
      layers.push(
        `<rect x="${s.x}" y="${s.y}" width="${s.width}" height="${s.height}" fill="rgba(16,185,129,0.06)" stroke="rgba(5,150,105,0.45)" stroke-width="1.5" stroke-dasharray="6 8" opacity="0.9"/>`,
      );
    }
  }
  return layers.join("\n  ");
}

function renderMarketplaceCardOverlaySvgV2(input: ProductCardOverlayInput): string {
  const spec = buildMarketplaceCardOverlaySpec({ ...input, overlayVersion: "v2" });
  const templatePreset = getProductCardTemplatePreset(String(spec.templatePreset));
  const profile = v2TypographyProfile(input);
  const width = Number(spec.outputWidth) || resolveProductCardCanvas(String(spec.cardSize)).width;
  const height = Number(spec.outputHeight) || resolveProductCardCanvas(String(spec.cardSize)).height;
  const awareness = buildObjectAwarePayload(String(spec.templatePreset), String(spec.cardSize), width, height);
  const layout = awareness.adjustedLayout;
  const text = spec.text as {
    title: string;
    subtitle?: string;
    benefits: string[];
    extraText: string;
    statsText?: string;
    sizeText?: string;
  };
  const useIcons = spec.useIcons !== false;
  const useArrows = spec.useArrows !== false;
  const useShadows = spec.useShadows !== false;
  const renderMode = input.overlayRenderMode ?? "production";
  const minSide = Math.min(width, height);
  const titleSize = Math.max(34, Math.round(minSide * layout.titleScale));
  const subtitleSize = Math.max(20, Math.round(minSide * layout.bodyScale * 0.95));
  const bodySize = Math.max(20, Math.round(minSide * layout.bodyScale));
  const smallSize = Math.max(16, Math.round(minSide * layout.smallScale));
  const titlePanel =
    templatePreset.id === "clean_catalog" || templatePreset.id === "lifestyle_model" || templatePreset.id === "light_marketplace" || templatePreset.id === "dark_infographic"
      ? ""
      : roundRect(
          layout.title.x - 18,
          layout.title.y - 42,
          layout.title.width + 36,
          layout.title.height + 38,
          32,
          profile.panelFill,
          profile.panelStroke,
          panelAttrs(useShadows),
        );
  const benefitEls = layout.benefits.slice(0, 5).map((zone, idx) => {
    const label = text.benefits[idx];
    if (!label) return "";
    return renderV2BenefitCard(
      label,
      zone,
      profile,
      bodySize,
      idx,
      useIcons && templatePreset.id !== "clean_catalog",
      useShadows,
      templatePreset.id,
    );
  });
  const badgeTexts = [text.extraText, text.statsText, text.sizeText].map((x) => (x ?? "").trim()).filter(Boolean);
  const badgeEls = layout.badges.map((zone, idx) => {
    const value = badgeTexts[idx];
    if (!value) return "";
    return accentPill(value, zone.x, zone.y, zone.width, zone.height, profile, smallSize, "middle");
  });
  const arrowEls = useArrows ? layout.arrows.map((a) => arrowPath(a.from, a.to, profile.markerFill)) : [];
  const schematic = overlaySchematicLayer(layout, awareness, profile, renderMode, input.layoutDebug, minSide);
  const footerText = [text.extraText, text.statsText, text.sizeText].filter(Boolean).join(" · ");
  const footer = footerText
    ? textEl(footerText, {
        x: layout.footer.x,
        y: layout.footer.y + Math.round(layout.footer.height * 0.58),
        width: layout.footer.width,
        fontSize: smallSize,
        lineHeight: Math.round(smallSize * 1.2),
        maxLines: 2,
        maxBoxHeight: Math.round(layout.footer.height * 0.82),
        anchor: "middle",
        role: "extra",
      }, profile)
    : "";
  const inner = [
    schematic,
    titlePanel,
    textEl(text.title, {
      x: layout.title.x,
      y: layout.title.y + Math.round(titleSize * 0.78),
      width: layout.title.width,
      fontSize: titleSize,
      lineHeight: Math.round(titleSize * 1.08),
      maxLines: 2,
      maxBoxHeight: Math.round(layout.title.height * 0.92),
      role: "title",
      shadow: useShadows,
    }, profile),
    textEl(text.subtitle ?? "", {
      x: layout.subtitle.x,
      y: layout.subtitle.y + Math.round(subtitleSize * 0.9),
      width: layout.subtitle.width,
      fontSize: subtitleSize,
      lineHeight: Math.round(subtitleSize * 1.28),
      maxLines: 2,
      maxBoxHeight: Math.round(layout.subtitle.height * 0.9),
      role: "extra",
    }, profile),
    ...arrowEls,
    ...benefitEls,
    ...badgeEls,
    footer,
  ].filter(Boolean).join("\n  ");
  return svgWrap(width, height, inner);
}

export function renderMarketplaceCardOverlaySvg(input: ProductCardOverlayInput): string {
  const spec = buildMarketplaceCardOverlaySpec(input);
  if (spec.renderer === "server_svg_overlay_v2") {
    return renderMarketplaceCardOverlaySvgV2(input);
  }
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
