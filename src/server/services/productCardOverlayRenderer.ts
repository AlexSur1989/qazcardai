import "server-only";

export type ProductCardOverlayInput = {
  template: string;
  cardSize: string;
  productTitle: string;
  benefits: string[];
  extraText: string;
  style: string;
};

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

export function renderMarketplaceCardOverlaySvg(input: ProductCardOverlayInput): string {
  const spec = buildMarketplaceCardOverlaySpec(input);
  const title = escapeXml(spec.text.title || "Название товара");
  const extraText = escapeXml(spec.text.extraText);
  const benefits = spec.text.benefits.map(escapeXml);
  const benefitRows = benefits
    .map((benefit, idx) => `<text x="70" y="${760 + idx * 42}" font-size="28" fill="#12323a">• ${benefit}</text>`)
    .join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="1000" viewBox="0 0 1000 1000">
  <defs>
    <linearGradient id="panel" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#ffffff" stop-opacity="0.94"/>
      <stop offset="100%" stop-color="#e8f5f9" stop-opacity="0.94"/>
    </linearGradient>
  </defs>
  <rect x="0" y="0" width="1000" height="1000" fill="none"/>
  <rect x="40" y="660" width="920" height="300" rx="36" fill="url(#panel)"/>
  <text x="70" y="725" font-size="44" font-weight="700" fill="#0b2530">${title}</text>
  ${benefitRows}
  ${extraText ? `<text x="70" y="925" font-size="24" fill="#2e6c78">${extraText}</text>` : ""}
</svg>`;
}
