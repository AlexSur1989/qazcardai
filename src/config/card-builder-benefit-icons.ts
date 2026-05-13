/**
 * Иконки преимуществ для SVG-overlay (совпадают с ключами iconPath в productCardOverlayRenderer).
 */
export const CARD_BUILDER_BENEFIT_TAG_ICON: Record<string, string> = {
  design: "eye",
  material: "fabric",
  size: "size",
  comfort: "check",
  reliability: "shield",
  premium_feel: "star",
  gift: "gift",
  home: "check",
  office: "check",
  sport: "check",
  kitchen: "check",
};

/** Эвристика mustShow → иконка для коллаутов */
export const CARD_BUILDER_MUST_SHOW_ICON: Record<string, string> = {
  texture: "fabric",
  scale: "size",
  usage: "check",
  packaging: "check",
  details: "eye",
  color: "droplet",
  brand_style: "star",
};
