
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
};

const DEFAULT_OUTPUT_WIDTH = 1000;
const DEFAULT_OUTPUT_HEIGHT = 1000;

/** Системные DejaVu доступны в Alpine; роли дают разную типографику без внешних лицензий. */
const BASE_SANS = "DejaVu Sans, Liberation Sans, Arial, sans-serif";
const BASE_SERIF = "DejaVu Serif, Georgia, serif";
const BASE_CONDENSED = "DejaVu Sans Condensed, Arial Narrow, Arial, sans-serif";

const TYPOGRAPHY: Record<string, TypographyProfile> = {
  clean_marketplace: {
    id: "clean_marketplace",
    titleFont: BASE_SANS,
    bodyFont: BASE_SANS,
    extraFont: BASE_SANS,
    titleWeight: 700,
    bodyWeight: 500,
    extraWeight: 400,
    titleColor: "#0b2530",
    bodyColor: "#12323a",
    extraColor: "#2e6c78",
    panelFill: "rgba(255,255,255,0.88)",
    panelStroke: "rgba(0,175,202,0.28)",
    accentFill: "rgba(232,248,251,0.92)",
  },
  premium: {
    id: "premium",
    titleFont: BASE_SERIF,
    bodyFont: BASE_SANS,
    extraFont: BASE_SANS,
    titleWeight: 700,
    bodyWeight: 500,
    extraWeight: 400,
    titleColor: "#1f1a12",
    bodyColor: "#3a2f1e",
    extraColor: "#7a5b20",
    panelFill: "rgba(255,248,234,0.88)",
    panelStroke: "rgba(190,142,46,0.35)",
    accentFill: "rgba(255,241,204,0.92)",
  },
  bright_advertising: {
    id: "bright_advertising",
    titleFont: BASE_CONDENSED,
    bodyFont: BASE_SANS,
    extraFont: BASE_SANS,
    titleWeight: 800,
    bodyWeight: 700,
    extraWeight: 500,
    titleColor: "#072a36",
    bodyColor: "#083947",
    extraColor: "#007c93",
    panelFill: "rgba(255,255,255,0.9)",
    panelStroke: "rgba(0,175,202,0.42)",
    accentFill: "rgba(210,247,255,0.94)",
  },
  minimalist: {
    id: "minimalist",
    titleFont: BASE_SANS,
    bodyFont: BASE_SANS,
    extraFont: BASE_SANS,
    titleWeight: 600,
    bodyWeight: 400,
    extraWeight: 400,
    titleColor: "#111827",
    bodyColor: "#374151",
    extraColor: "#6b7280",
    panelFill: "rgba(255,255,255,0.84)",
    panelStroke: "rgba(17,24,39,0.14)",
    accentFill: "rgba(249,250,251,0.92)",
  },
  infographic: {
    id: "infographic",
    titleFont: BASE_CONDENSED,
    bodyFont: BASE_SANS,
    extraFont: BASE_SANS,
    titleWeight: 800,
    bodyWeight: 700,
    extraWeight: 500,
    titleColor: "#082f49",
    bodyColor: "#0c4a6e",
    extraColor: "#0369a1",
    panelFill: "rgba(240,249,255,0.9)",
    panelStroke: "rgba(3,105,161,0.28)",
    accentFill: "rgba(224,242,254,0.94)",
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
  const tspans = lines
    .map(
      (line, idx) =>
        `<tspan x="${textX}" dy="${idx === 0 ? 0 : block.lineHeight}">${escapeXml(line)}</tspan>`,
    )
    .join("");
  return `<text x="${textX}" y="${block.y}" text-anchor="${anchor}" font-size="${block.fontSize}" font-weight="${fontWeight(profile, block.role)}" fill="${colorFor(profile, block.role)}" font-family="${fontFamily(profile, block.role)}">${tspans}</text>`;
}

function roundRect(
  x: number,
  y: number,
  width: number,
  height: number,
  rx: number,
  fill: string,
  stroke: string,
): string {
  return `<rect x="${x}" y="${y}" width="${width}" height="${height}" rx="${rx}" fill="${fill}" stroke="${stroke}" stroke-width="${Math.max(1, Math.round(Math.min(width, height) * 0.006))}"/>`;
}

function pct(value: number, total: number): number {
  return Math.round(value * total);
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
  const panelY = pct(0.64, height);
  const panelW = pct(0.89, width);
  const panelH = pct(0.3, height);
  const titleSize = Math.round(Math.min(width, height) * 0.043);
  const bodySize = Math.round(Math.min(width, height) * 0.027);
  const extraSize = Math.round(Math.min(width, height) * 0.022);
  const lineGap = Math.round(bodySize * 1.55);
  const contentX = panelX + pad * 0.55;
  const contentW = panelW - pad * 1.1;

  const benefitEls = benefits.slice(0, 4).map((benefit, idx) => {
    const y = panelY + pct(0.13, height) + titleSize * 1.25 + idx * lineGap;
    return textEl(`• ${benefit}`, {
      x: contentX,
      y,
      width: contentW,
      fontSize: bodySize,
      lineHeight: Math.round(bodySize * 1.25),
      maxLines: 1,
      role: "body",
    }, profile);
  });

  return [
    roundRect(panelX, panelY, panelW, panelH, Math.round(Math.min(width, height) * 0.035), profile.panelFill, profile.panelStroke),
    textEl(title, {
      x: contentX,
      y: panelY + pct(0.065, height),
      width: contentW,
      fontSize: titleSize,
      lineHeight: Math.round(titleSize * 1.18),
      maxLines: 2,
      role: "title",
    }, profile),
    ...benefitEls,
    textEl(extra, {
      x: contentX,
      y: panelY + panelH - pct(0.04, height),
      width: contentW,
      fontSize: extraSize,
      lineHeight: Math.round(extraSize * 1.2),
      maxLines: 1,
      role: "extra",
    }, profile),
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
  const panelW = pct(width > height ? 0.34 : 0.4, width);
  const panelH = pct(0.86, height);
  const pad = pct(0.035, width);
  const titleSize = Math.round(Math.min(width, height) * 0.037);
  const bodySize = Math.round(Math.min(width, height) * 0.024);
  const extraSize = Math.round(Math.min(width, height) * 0.02);
  const contentX = panelX + pad;
  const contentW = panelW - pad * 2;

  const benefitEls = benefits.slice(0, 5).map((benefit, idx) =>
    textEl(`• ${benefit}`, {
      x: contentX,
      y: panelY + pct(0.26, panelH) + idx * Math.round(bodySize * 2.35),
      width: contentW,
      fontSize: bodySize,
      lineHeight: Math.round(bodySize * 1.22),
      maxLines: 2,
      role: "body",
    }, profile),
  );

  return [
    roundRect(panelX, panelY, panelW, panelH, Math.round(Math.min(width, height) * 0.032), profile.panelFill, profile.panelStroke),
    textEl(title, {
      x: contentX,
      y: panelY + pct(0.065, panelH),
      width: contentW,
      fontSize: titleSize,
      lineHeight: Math.round(titleSize * 1.18),
      maxLines: 3,
      role: "title",
    }, profile),
    ...benefitEls,
    textEl(extra, {
      x: contentX,
      y: panelY + panelH - pct(0.055, panelH),
      width: contentW,
      fontSize: extraSize,
      lineHeight: Math.round(extraSize * 1.2),
      maxLines: 2,
      role: "extra",
    }, profile),
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
  const titleW = pct(width > height ? 0.52 : 0.76, width);
  const titleX = (width - titleW) / 2;
  const titleY = pct(0.055, height);
  const titleH = pct(0.14, height);
  const titleSize = Math.round(Math.min(width, height) * 0.034);
  const bodySize = Math.round(Math.min(width, height) * 0.023);
  const extraSize = Math.round(Math.min(width, height) * 0.02);

  const badgeW = pct(width > height ? 0.26 : 0.34, width);
  const badgeH = Math.max(pct(0.075, height), bodySize * 2.3);
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
      roundRect(x, y, badgeW, badgeH, Math.round(badgeH * 0.44), profile.accentFill, profile.panelStroke),
      textEl(benefit, {
        x: x + pct(0.045, width),
        y: y + Math.round(badgeH * 0.58),
        width: badgeW - pct(0.09, width),
        fontSize: bodySize,
        lineHeight: Math.round(bodySize * 1.15),
        maxLines: 1,
        role: "body",
      }, profile),
    ];
  });

  const extraW = pct(0.72, width);
  return [
    roundRect(titleX, titleY, titleW, titleH, Math.round(Math.min(width, height) * 0.028), profile.panelFill, profile.panelStroke),
    textEl(title, {
      x: titleX + pct(0.025, width),
      y: titleY + Math.round(titleH * 0.45),
      width: titleW - pct(0.05, width),
      fontSize: titleSize,
      lineHeight: Math.round(titleSize * 1.15),
      maxLines: 2,
      anchor: "middle",
      role: "title",
    }, profile),
    ...badges,
    textEl(extra, {
      x: (width - extraW) / 2,
      y: pct(0.94, height),
      width: extraW,
      fontSize: extraSize,
      lineHeight: Math.round(extraSize * 1.2),
      maxLines: 1,
      anchor: "middle",
      role: "extra",
    }, profile),
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
