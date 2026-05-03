
export type ProductCardOverlayInput = {
  template: string;
  cardSize: string;
  productTitle: string;
  benefits: string[];
  extraText: string;
  style: string;
};

/** Системные шрифты в Alpine: ttf-dejavu (Dockerfile). */
const FONT_FAMILY = "DejaVu Sans, Liberation Sans, Arial, sans-serif";

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function buildMarketplaceCardOverlaySpec(input: ProductCardOverlayInput) {
  const benefits = input.benefits.map((item) => item.trim()).filter(Boolean).slice(0, 6);
  return {
    renderer: "server_svg_overlay_v1",
    template: input.template || "bottom_panel",
    cardSize: input.cardSize || "square",
    style: input.style,
    text: {
      title: input.productTitle.trim(),
      benefits,
      extraText: input.extraText.trim(),
    },
  };
}

function svgWrap(inner: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="1000" viewBox="0 0 1000 1000">
  <rect x="0" y="0" width="1000" height="1000" fill="none"/>
${inner}
</svg>`;
}

/** Плашки и фон отрисовывает модель; здесь только читаемый текст в зарезервированных зонах. */
function renderBottomPanelTexts(
  title: string,
  benefitXmlList: string[],
  extra: string,
): string {
  const titleEl = title
    ? `<text x="72" y="712" font-size="40" font-weight="700" fill="#0b2530" font-family="${FONT_FAMILY}">${title}</text>`
    : "";
  const benefitYs = [764, 808, 852, 896];
  const benefitEls = benefitXmlList
    .map(
      (b, idx) =>
        `<text x="72" y="${benefitYs[idx] ?? 764 + idx * 44}" font-size="26" fill="#12323a" font-family="${FONT_FAMILY}">${b}</text>`,
    )
    .join("\n  ");
  const extraEl = extra
    ? `<text x="72" y="938" font-size="22" fill="#2e6c78" font-family="${FONT_FAMILY}">${extra}</text>`
    : "";
  return svgWrap([titleEl, benefitEls, extraEl].filter(Boolean).join("\n  "));
}

/** Колонка слева: заголовок сверху, список выгод, подпись внизу (как типовая AI-раскладка). */
function renderLeftPanelTexts(
  title: string,
  benefitXmlList: string[],
  extra: string,
): string {
  const titleEl = title
    ? `<text x="78" y="118" font-size="34" font-weight="700" fill="#0b2530" font-family="${FONT_FAMILY}">${title}</text>`
    : "";
  const benefitYs = [318, 388, 458, 528];
  const benefitEls = benefitXmlList
    .map(
      (b, idx) =>
        `<text x="132" y="${benefitYs[idx] ?? 318 + idx * 70}" font-size="25" fill="#12323a" font-family="${FONT_FAMILY}">${b}</text>`,
    )
    .join("\n  ");
  const extraEl = extra
    ? `<text x="78" y="932" font-size="22" fill="#2e6c78" font-family="${FONT_FAMILY}">${extra}</text>`
    : "";
  return svgWrap([titleEl, benefitEls, extraEl].filter(Boolean).join("\n  "));
}

function renderBadgesCalloutsTexts(
  title: string,
  benefitXmlList: string[],
  extra: string,
): string {
  const titleEl = title
    ? `<text x="500" y="108" text-anchor="middle" font-size="32" font-weight="700" fill="#0b2530" font-family="${FONT_FAMILY}">${title}</text>`
    : "";
  const benefitYs = [310, 380, 450, 520];
  const benefitEls = benefitXmlList
    .map(
      (b, idx) =>
        `<text x="96" y="${benefitYs[idx] ?? 310 + idx * 70}" font-size="24" fill="#12323a" font-family="${FONT_FAMILY}">${b}</text>`,
    )
    .join("\n  ");
  const extraEl = extra
    ? `<text x="500" y="938" text-anchor="middle" font-size="22" fill="#2e6c78" font-family="${FONT_FAMILY}">${extra}</text>`
    : "";
  return svgWrap([titleEl, benefitEls, extraEl].filter(Boolean).join("\n  "));
}

export function renderMarketplaceCardOverlaySvg(input: ProductCardOverlayInput): string {
  const spec = buildMarketplaceCardOverlaySpec(input);
  const title = spec.text.title.trim() ? escapeXml(spec.text.title.trim()) : "";
  const extraText = spec.text.extraText.trim() ? escapeXml(spec.text.extraText.trim()) : "";
  const benefits = spec.text.benefits.map(escapeXml);
  const tpl = spec.template;

  if (tpl === "left_panel") {
    return renderLeftPanelTexts(title, benefits, extraText);
  }
  if (tpl === "badges_callouts") {
    return renderBadgesCalloutsTexts(title, benefits, extraText);
  }
  return renderBottomPanelTexts(title, benefits, extraText);
}
