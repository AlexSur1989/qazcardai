export type ProductCardCanvasId = "square" | "story" | "vertical" | "banner";

export type ProductCardTemplatePresetId =
  | "dark_infographic"
  | "light_marketplace"
  | "promo_poster"
  | "lifestyle_model"
  | "clean_catalog"
  | "feature_grid";

export type ProductCardTypographyPresetId =
  | "classic"
  | "premium"
  | "marketplace"
  | "minimalism"
  | "fashion";

export type ProductCardCanvas = {
  id: ProductCardCanvasId;
  label: string;
  width: number;
  height: number;
  aspectRatio: string;
  overlayPresetSuffix: "square" | "story" | "vertical" | "banner";
  supportedTemplates: ProductCardTemplatePresetId[];
};

export type ProductCardTemplatePreset = {
  id: ProductCardTemplatePresetId;
  label: string;
  description: string;
  aiStyle: string;
  backgroundStyle: string;
  compositionInstruction: string;
  theme: "dark" | "light" | "promo" | "minimal" | "lifestyle" | "grid";
  accentColor: string;
  panelFill: string;
  panelStroke: string;
  textColor: string;
  mutedTextColor: string;
  bestFor: string[];
};

export type ProductCardTypographyPreset = {
  id: ProductCardTypographyPresetId;
  label: string;
  titleFont: string;
  bodyFont: string;
  titleWeight: number;
  bodyWeight: number;
};

export type RectZone = { x: number; y: number; width: number; height: number };
export type PointZone = { x: number; y: number };

export type ProductCardLayoutPreset = {
  key: string;
  templatePreset: ProductCardTemplatePresetId;
  cardSize: ProductCardCanvasId;
  title: RectZone;
  subtitle: RectZone;
  productSafeArea: RectZone;
  benefits: RectZone[];
  badges: RectZone[];
  callouts: RectZone[];
  arrows: { from: PointZone; to: PointZone }[];
  footer: RectZone;
  padding: number;
  titleScale: number;
  bodyScale: number;
  smallScale: number;
};

export const PRODUCT_CARD_TEMPLATE_PRESETS: readonly ProductCardTemplatePreset[] = [
  {
    id: "dark_infographic",
    label: "Темная инфографика",
    description: "Темный фон, крупный заголовок, преимущества в контрастных плашках.",
    aiStyle: "dark premium infographic product scene, high contrast, dramatic studio light",
    backgroundStyle: "deep dark matte background with subtle gradients and premium contrast",
    compositionInstruction: "Keep product on the right or centered with clean left-side negative space for benefit cards.",
    theme: "dark",
    accentColor: "#38bdf8",
    panelFill: "rgba(3, 12, 24, 0.78)",
    panelStroke: "rgba(56, 189, 248, 0.46)",
    textColor: "#f8fafc",
    mutedTextColor: "#cbd5e1",
    bestFor: ["одежда", "аксессуары", "спорттовары", "техника", "зимние товары"],
  },
  {
    id: "light_marketplace",
    label: "Светлый маркетплейс",
    description: "Светлый фон, товар справа, чистые callout-блоки и тонкие линии.",
    aiStyle: "clean bright marketplace product card base, soft shadows, commercial clarity",
    backgroundStyle: "light white or pastel marketplace background with plenty of negative space",
    compositionInstruction: "Place product right side or center-right; leave top and side zones clean for callouts.",
    theme: "light",
    accentColor: "#00afca",
    panelFill: "rgba(255, 255, 255, 0.88)",
    panelStroke: "rgba(0, 175, 202, 0.32)",
    textColor: "#0c2d38",
    mutedTextColor: "#345b66",
    bestFor: ["косметика", "еда", "товары для дома", "аптечные товары", "упаковки"],
  },
  {
    id: "promo_poster",
    label: "Промо-постер",
    description: "Эмоциональный рекламный постер с акцентным цветом и нижней плашкой.",
    aiStyle: "bold promotional poster product scene, energetic accent color, advertising composition",
    backgroundStyle: "dynamic bright advertising background with color blocks and clean text-safe areas",
    compositionInstruction: "Make product large and emotional; leave bottom strip and title area clean for overlay.",
    theme: "promo",
    accentColor: "#facc15",
    panelFill: "rgba(255, 255, 255, 0.9)",
    panelStroke: "rgba(250, 204, 21, 0.6)",
    textColor: "#082f49",
    mutedTextColor: "#164e63",
    bestFor: ["Instagram", "Stories", "акции", "новинки", "fashion"],
  },
  {
    id: "lifestyle_model",
    label: "Lifestyle / на модели",
    description: "Lifestyle-сцена, минимум плашек, короткий список преимуществ.",
    aiStyle: "lifestyle advertising product scene, natural use case, premium social media look",
    backgroundStyle: "realistic lifestyle background with clean editorial negative space",
    compositionInstruction: "Use a model or lifestyle scene when appropriate; keep overlay areas minimal and clean.",
    theme: "lifestyle",
    accentColor: "#fb7185",
    panelFill: "rgba(255, 255, 255, 0.76)",
    panelStroke: "rgba(251, 113, 133, 0.36)",
    textColor: "#1f2937",
    mutedTextColor: "#4b5563",
    bestFor: ["одежда", "обувь", "аксессуары", "спорт", "fashion"],
  },
  {
    id: "clean_catalog",
    label: "Чистый каталог",
    description: "Белый/серый фон, товар по центру, минимум текста и аккуратные преимущества.",
    aiStyle: "minimal clean catalog product photography base, white or light gray background",
    backgroundStyle: "simple white or light gray catalog background with soft shadow",
    compositionInstruction: "Keep product centered and dominant; reserve bottom area for compact benefits.",
    theme: "minimal",
    accentColor: "#111827",
    panelFill: "rgba(255, 255, 255, 0.82)",
    panelStroke: "rgba(17, 24, 39, 0.16)",
    textColor: "#111827",
    mutedTextColor: "#4b5563",
    bestFor: ["маркетплейсы", "каталоги", "Kaspi", "Ozon", "WB"],
  },
  {
    id: "feature_grid",
    label: "Сетка преимуществ",
    description: "Товар в центре, 4 карточки преимуществ вокруг, понятная инфографика.",
    aiStyle: "structured product infographic base, centered product, clean feature grid zones",
    backgroundStyle: "clean technical infographic background with symmetrical negative spaces",
    compositionInstruction: "Place product in the center; keep four corner zones clean for feature cards.",
    theme: "grid",
    accentColor: "#7c3aed",
    panelFill: "rgba(255, 255, 255, 0.86)",
    panelStroke: "rgba(124, 58, 237, 0.34)",
    textColor: "#1e1b4b",
    mutedTextColor: "#4c1d95",
    bestFor: ["техника", "косметика", "БАДы", "характеристики", "функциональные товары"],
  },
] as const;

export const PRODUCT_CARD_TYPOGRAPHY_PRESETS: readonly ProductCardTypographyPreset[] = [
  { id: "classic", label: "Классический", titleFont: "Noto Sans, DejaVu Sans, Arial, sans-serif", bodyFont: "Noto Sans, DejaVu Sans, Arial, sans-serif", titleWeight: 800, bodyWeight: 600 },
  { id: "premium", label: "Премиальный", titleFont: "Manrope, Noto Sans, DejaVu Sans, Arial, sans-serif", bodyFont: "Noto Sans, DejaVu Sans, Arial, sans-serif", titleWeight: 800, bodyWeight: 550 },
  { id: "marketplace", label: "Маркетплейс", titleFont: "Montserrat, Noto Sans, DejaVu Sans, Arial, sans-serif", bodyFont: "Noto Sans, DejaVu Sans, Arial, sans-serif", titleWeight: 800, bodyWeight: 600 },
  { id: "minimalism", label: "Минимализм", titleFont: "Noto Sans, DejaVu Sans, Arial, sans-serif", bodyFont: "Noto Sans, DejaVu Sans, Arial, sans-serif", titleWeight: 700, bodyWeight: 500 },
  { id: "fashion", label: "Fashion", titleFont: "Manrope, Noto Sans, DejaVu Sans, Arial, sans-serif", bodyFont: "Manrope, Noto Sans, DejaVu Sans, Arial, sans-serif", titleWeight: 800, bodyWeight: 600 },
] as const;

const SUPPORTED: ProductCardTemplatePresetId[] = [
  "dark_infographic",
  "light_marketplace",
  "promo_poster",
  "lifestyle_model",
  "clean_catalog",
  "feature_grid",
];

export const PRODUCT_CARD_CANVASES: readonly ProductCardCanvas[] = [
  { id: "square", label: "Квадрат 1000x1000", width: 1000, height: 1000, aspectRatio: "1:1", overlayPresetSuffix: "square", supportedTemplates: SUPPORTED },
  { id: "story", label: "Story 1080x1920", width: 1080, height: 1920, aspectRatio: "9:16", overlayPresetSuffix: "story", supportedTemplates: SUPPORTED },
  { id: "vertical", label: "Вертикальная 1200x1600", width: 1200, height: 1600, aspectRatio: "3:4", overlayPresetSuffix: "vertical", supportedTemplates: SUPPORTED },
  { id: "banner", label: "Баннер 1200x628", width: 1200, height: 628, aspectRatio: "16:9", overlayPresetSuffix: "banner", supportedTemplates: SUPPORTED },
] as const;

const TEMPLATE_BY_ID = new Map(PRODUCT_CARD_TEMPLATE_PRESETS.map((p) => [p.id, p]));
const TYPOGRAPHY_BY_ID = new Map(PRODUCT_CARD_TYPOGRAPHY_PRESETS.map((p) => [p.id, p]));
const CANVAS_BY_ID = new Map(PRODUCT_CARD_CANVASES.map((p) => [p.id, p]));

export function isProductCardTemplatePresetId(value: string): value is ProductCardTemplatePresetId {
  return TEMPLATE_BY_ID.has(value as ProductCardTemplatePresetId);
}

export function isProductCardTypographyPresetId(value: string): value is ProductCardTypographyPresetId {
  return TYPOGRAPHY_BY_ID.has(value as ProductCardTypographyPresetId);
}

export function getProductCardTemplatePreset(id: string | null | undefined): ProductCardTemplatePreset {
  return TEMPLATE_BY_ID.get((id ?? "") as ProductCardTemplatePresetId) ?? PRODUCT_CARD_TEMPLATE_PRESETS[0]!;
}

export function getProductCardTypographyPreset(id: string | null | undefined): ProductCardTypographyPreset {
  return TYPOGRAPHY_BY_ID.get((id ?? "") as ProductCardTypographyPresetId) ?? PRODUCT_CARD_TYPOGRAPHY_PRESETS[0]!;
}

export function resolveProductCardCanvas(cardSize: string | null | undefined): ProductCardCanvas {
  return CANVAS_BY_ID.get((cardSize ?? "") as ProductCardCanvasId) ?? PRODUCT_CARD_CANVASES[0]!;
}

export function getProductCardLayoutKey(
  templatePreset: string | null | undefined,
  cardSize: string | null | undefined,
): string {
  const template = getProductCardTemplatePreset(templatePreset);
  const canvas = resolveProductCardCanvas(cardSize);
  return `${template.id}_${canvas.overlayPresetSuffix}`;
}

function rect(x: number, y: number, width: number, height: number): RectZone {
  return { x, y, width, height };
}

function pt(x: number, y: number): PointZone {
  return { x, y };
}

export function getProductCardLayoutPreset(
  templatePreset: string | null | undefined,
  cardSize: string | null | undefined,
): ProductCardLayoutPreset {
  const template = getProductCardTemplatePreset(templatePreset);
  const canvas = resolveProductCardCanvas(cardSize);
  const story = canvas.id === "story";
  const key = getProductCardLayoutKey(template.id, canvas.id);
  const base = {
    key,
    templatePreset: template.id,
    cardSize: canvas.id,
    padding: story ? 70 : 48,
    titleScale: story ? 0.052 : 0.056,
    bodyScale: story ? 0.024 : 0.028,
    smallScale: story ? 0.019 : 0.021,
  } satisfies Omit<ProductCardLayoutPreset, "title" | "subtitle" | "productSafeArea" | "benefits" | "badges" | "callouts" | "arrows" | "footer">;

  if (template.id === "dark_infographic" || template.id === "light_marketplace") {
    return {
      ...base,
      // Заголовок: даем больше ширины и сдвигаем чуть ниже
      title: story ? rect(70, 120, 760, 220) : rect(58, 75, 580, 150),
      // Подзаголовок: сразу под заголовком
      subtitle: story ? rect(70, 350, 680, 92) : rect(58, 235, 500, 70),
      // Товар: сдвигаем правее, чтобы освободить левую часть
      productSafeArea: story ? rect(410, 500, 590, 930) : rect(490, 230, 450, 555),
      // Преимущества: делаем плашки шире и выше, как на референсе
      benefits: story 
        ? [rect(70, 520, 480, 130), rect(70, 670, 480, 130), rect(70, 820, 480, 130), rect(70, 970, 480, 130)] 
        : [rect(58, 352, 410, 96), rect(58, 468, 410, 96), rect(58, 584, 410, 96), rect(58, 700, 410, 96)],
      // Бейджи внизу
      badges: story ? [rect(70, 1548, 420, 76), rect(520, 1548, 420, 76)] : [rect(58, 858, 260, 58), rect(340, 858, 260, 58)],
      callouts: [],
      arrows: story ? [{ from: pt(560, 600), to: pt(700, 700) }, { from: pt(560, 880), to: pt(730, 930) }] : [{ from: pt(480, 400), to: pt(610, 395) }, { from: pt(480, 630), to: pt(620, 580) }],
      footer: story ? rect(70, 1660, 940, 130) : rect(58, 928, 884, 42),
    };
  }

  if (template.id === "feature_grid") {
    return {
      ...base,
      title: story ? rect(90, 105, 900, 190) : rect(120, 58, 760, 120),
      subtitle: story ? rect(120, 295, 840, 78) : rect(180, 178, 640, 48),
      productSafeArea: story ? rect(255, 540, 570, 760) : rect(315, 270, 370, 390),
      benefits: story ? [rect(70, 455, 410, 130), rect(600, 455, 410, 130), rect(70, 1280, 410, 130), rect(600, 1280, 410, 130)] : [rect(58, 270, 290, 105), rect(652, 270, 290, 105), rect(58, 635, 290, 105), rect(652, 635, 290, 105)],
      badges: story ? [rect(220, 1490, 640, 78)] : [rect(340, 810, 320, 58)],
      callouts: [],
      arrows: [],
      footer: story ? rect(90, 1640, 900, 120) : rect(90, 885, 820, 68),
    };
  }

  if (template.id === "clean_catalog") {
    return {
      ...base,
      title: story ? rect(105, 115, 870, 160) : rect(105, 70, 790, 105),
      subtitle: story ? rect(130, 285, 820, 70) : rect(150, 182, 700, 45),
      productSafeArea: story ? rect(175, 430, 730, 880) : rect(230, 250, 540, 470),
      benefits: story ? [rect(90, 1390, 420, 92), rect(570, 1390, 420, 92), rect(90, 1505, 420, 92), rect(570, 1505, 420, 92)] : [rect(90, 765, 390, 70), rect(520, 765, 390, 70), rect(90, 850, 390, 70), rect(520, 850, 390, 70)],
      badges: story ? [rect(270, 1640, 540, 70)] : [rect(365, 928, 270, 46)],
      callouts: [],
      arrows: [],
      footer: story ? rect(110, 1740, 860, 80) : rect(110, 930, 780, 40),
    };
  }

  if (template.id === "promo_poster") {
    return {
      ...base,
      title: story ? rect(70, 100, 940, 245) : rect(58, 58, 710, 150),
      subtitle: story ? rect(80, 360, 780, 78) : rect(62, 215, 520, 55),
      productSafeArea: story ? rect(155, 445, 790, 980) : rect(350, 235, 590, 560),
      benefits: story ? [rect(75, 1460, 440, 96), rect(565, 1460, 440, 96), rect(75, 1570, 440, 96), rect(565, 1570, 440, 96)] : [rect(58, 810, 275, 70), rect(360, 810, 275, 70), rect(662, 810, 275, 70)],
      badges: story ? [rect(70, 1705, 360, 78), rect(460, 1705, 260, 78), rect(750, 1705, 260, 78)] : [rect(58, 900, 250, 52), rect(330, 900, 210, 52), rect(565, 900, 210, 52)],
      callouts: [],
      arrows: [],
      footer: story ? rect(70, 1810, 940, 70) : rect(58, 938, 880, 40),
    };
  }

  if (template.id === "lifestyle_model") {
    return {
      ...base,
      title: story ? rect(72, 104, 760, 185) : rect(68, 72, 610, 116),
      subtitle: story ? rect(72, 305, 650, 82) : rect(68, 198, 520, 55),
      productSafeArea: story ? rect(210, 420, 800, 1060) : rect(315, 230, 625, 575),
      benefits: story ? [rect(70, 1465, 460, 86), rect(550, 1465, 460, 86), rect(70, 1570, 460, 86)] : [rect(64, 792, 275, 66), rect(360, 792, 275, 66), rect(656, 792, 275, 66)],
      badges: story ? [rect(72, 1690, 620, 72)] : [rect(68, 885, 450, 52)],
      callouts: [],
      arrows: [],
      footer: story ? rect(72, 1785, 760, 78) : rect(68, 930, 640, 42),
    };
  }

  return {
    ...base,
    title: story ? rect(70, 105, 780, 185) : rect(58, 68, 620, 120),
    subtitle: story ? rect(70, 300, 650, 76) : rect(58, 195, 510, 52),
    productSafeArea: story ? rect(400, 430, 610, 930) : rect(470, 250, 470, 500),
    benefits: story ? [rect(70, 505, 420, 105), rect(70, 635, 420, 105), rect(70, 765, 420, 105), rect(70, 895, 420, 105)] : [rect(58, 312, 360, 80), rect(58, 410, 360, 80), rect(58, 508, 360, 80), rect(58, 606, 360, 80)],
    badges: story ? [rect(70, 1515, 440, 78), rect(540, 1515, 360, 78)] : [rect(58, 835, 280, 56), rect(360, 835, 250, 56)],
    callouts: [],
    arrows: story ? [{ from: pt(505, 560), to: pt(690, 650) }, { from: pt(505, 820), to: pt(720, 870) }] : [{ from: pt(420, 350), to: pt(620, 390) }, { from: pt(420, 545), to: pt(635, 560) }],
    footer: story ? rect(70, 1640, 940, 115) : rect(58, 910, 860, 58),
  };
}

export function variantTemplatePresetAt(index: number): ProductCardTemplatePresetId {
  return SUPPORTED[((index % SUPPORTED.length) + SUPPORTED.length) % SUPPORTED.length]!;
}

export function variantTypographyPresetAt(index: number): ProductCardTypographyPresetId {
  const ids = PRODUCT_CARD_TYPOGRAPHY_PRESETS.map((p) => p.id);
  return ids[((index % ids.length) + ids.length) % ids.length]!;
}

export function getPublicProductCardTemplatePresets() {
  return PRODUCT_CARD_TEMPLATE_PRESETS.map(({ id, label, description, bestFor }) => ({ id, label, description, bestFor }));
}

export function getPublicProductCardTypographyPresets() {
  return PRODUCT_CARD_TYPOGRAPHY_PRESETS.map(({ id, label }) => ({ id, label }));
}

export const PRODUCT_CARD_TYPOGRAPHY_TEST_STRINGS = {
  ru: ["Стильные солнцезащитные очки", "Классический черный цвет", "Удобная посадка", "Премиум качество"],
  kk: ["Күннен қорғайтын көзілдірік", "Жеңіл жақтау", "Ыңғайлы отырады", "Премиум сапа", "Ә Ғ Қ Ң Ө Ұ Ү Һ І"],
} as const;
