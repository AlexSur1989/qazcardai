export type ProductCardCanvasId = "square" | "story" | "vertical" | "banner";

export type ProductCardTemplatePresetId =
  | "dark_infographic"
  | "light_marketplace"
  | "promo_poster"
  | "lifestyle_model"
  | "clean_catalog"
  | "feature_grid"
  /** Внутренние fallback-раскладки (не в пикере UI) */
  | "feature_grid_compact"
  | "clean_catalog_compact"
  | "minimal_top_bottom"
  | "minimal_promo"
  | "bottom_chips";

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
  /** Если false — пресет только для серверных fallback-макетов, не показываем в форме пользователя */
  publicInPicker?: boolean;
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
  {
    id: "feature_grid_compact",
    label: "Сетка преимуществ (compact)",
    description: "Серверный fallback: узкая сетка без крупных полей.",
    aiStyle: "structured product infographic base, centered product, clean feature grid zones",
    backgroundStyle: "clean technical infographic background with symmetrical negative spaces",
    compositionInstruction: "Centered product; peripheral feature bands only, no heavy text regions on product.",
    theme: "grid",
    accentColor: "#7c3aed",
    panelFill: "rgba(255, 255, 255, 0.86)",
    panelStroke: "rgba(124, 58, 237, 0.34)",
    textColor: "#1e1b4b",
    mutedTextColor: "#4c1d95",
    bestFor: ["_strict_fallback"],
    publicInPicker: false,
  },
  {
    id: "clean_catalog_compact",
    label: "Чистый каталог (compact)",
    description: "Серверный fallback: компактные чипы преимуществ.",
    aiStyle: "minimal clean catalog product photography base, white or light gray background",
    backgroundStyle: "simple white or light gray catalog background with soft shadow",
    compositionInstruction: "Centered dominant product; only narrow bottom chip rows for overlays.",
    theme: "minimal",
    accentColor: "#111827",
    panelFill: "rgba(255, 255, 255, 0.82)",
    panelStroke: "rgba(17, 24, 39, 0.16)",
    textColor: "#111827",
    mutedTextColor: "#4b5563",
    bestFor: ["_strict_fallback"],
    publicInPicker: false,
  },
  {
    id: "minimal_top_bottom",
    label: "Minimal top/bottom",
    description: "Серверный fallback: заголовок сверху, чипы снизу, без стрелок.",
    aiStyle: "minimal clean marketplace product hero, generous negative margins top and bottom",
    backgroundStyle: "flat neutral backdrop with unobstructed hero product center",
    compositionInstruction:
      "Reserve top band for headline and subtitle only; reserve bottom gutter for compact chips — no overlays on hero product silhouette.",
    theme: "minimal",
    accentColor: "#0c4a6e",
    panelFill: "rgba(255, 255, 255, 0.82)",
    panelStroke: "rgba(15, 23, 42, 0.12)",
    textColor: "#0f172a",
    mutedTextColor: "#475569",
    bestFor: ["_strict_fallback"],
    publicInPicker: false,
  },
  {
    id: "minimal_promo",
    label: "Промо (minimal)",
    description: "Серверный fallback: промо-блоки упрощённые.",
    aiStyle: "bold promotional poster product scene without bitmap text banners",
    backgroundStyle: "dynamic advertising background",
    compositionInstruction: "Dominant hero; minimal peripheral zones for typography overlay only.",
    theme: "promo",
    accentColor: "#facc15",
    panelFill: "rgba(255, 255, 255, 0.9)",
    panelStroke: "rgba(250, 204, 21, 0.6)",
    textColor: "#082f49",
    mutedTextColor: "#164e63",
    bestFor: ["_strict_fallback"],
    publicInPicker: false,
  },
  {
    id: "bottom_chips",
    label: "Bottom chips",
    description: "Серверный fallback: преимущества одной строкой снизу.",
    aiStyle: "clean commercial product framing with unobstructed hero",
    backgroundStyle: "minimal catalog background",
    compositionInstruction:
      "Product dominant in upper two thirds; reserve only bottom stripe for slim benefit chips.",
    theme: "grid",
    accentColor: "#4338ca",
    panelFill: "rgba(255, 255, 255, 0.84)",
    panelStroke: "rgba(79, 70, 229, 0.32)",
    textColor: "#1e1b4b",
    mutedTextColor: "#312e81",
    bestFor: ["_strict_fallback"],
    publicInPicker: false,
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
      title: story ? rect(80, 100, 920, 200) : rect(80, 60, 840, 120),
      subtitle: story ? rect(120, 320, 840, 80) : rect(150, 190, 700, 50),
      productSafeArea: story ? rect(240, 550, 600, 700) : rect(360, 280, 280, 400),
      benefits: story 
        ? [rect(60, 450, 400, 140), rect(620, 450, 400, 140), rect(60, 1300, 400, 140), rect(620, 1300, 400, 140)] 
        : [rect(50, 300, 280, 120), rect(670, 300, 280, 120), rect(50, 500, 280, 120), rect(670, 500, 280, 120)],
      badges: story ? [rect(200, 1500, 680, 80)] : [rect(300, 750, 400, 60)],
      callouts: [],
      arrows: [],
      footer: story ? rect(80, 1700, 920, 100) : rect(80, 880, 840, 60),
    };
  }

  if (template.id === "clean_catalog") {
    return {
      ...base,
      title: story ? rect(80, 100, 920, 200) : rect(80, 60, 840, 120),
      subtitle: story ? rect(100, 320, 880, 80) : rect(100, 190, 800, 50),
      productSafeArea: story ? rect(140, 440, 800, 860) : rect(200, 260, 600, 440),
      benefits: story 
        ? [rect(80, 1360, 440, 100), rect(560, 1360, 440, 100), rect(80, 1480, 440, 100), rect(560, 1480, 440, 100)] 
        : [rect(80, 730, 400, 80), rect(520, 730, 400, 80), rect(80, 830, 400, 80), rect(520, 830, 400, 80)],
      badges: story ? [rect(240, 1620, 600, 80)] : [rect(300, 930, 400, 40)],
      callouts: [],
      arrows: [],
      footer: story ? rect(80, 1760, 920, 80) : rect(80, 970, 840, 30),
    };
  }

  if (template.id === "promo_poster") {
    return {
      ...base,
      title: story ? rect(70, 100, 940, 260) : rect(60, 60, 880, 160),
      subtitle: story ? rect(70, 380, 940, 80) : rect(60, 230, 880, 60),
      productSafeArea: story ? rect(150, 480, 860, 900) : rect(300, 310, 640, 460),
      benefits: story 
        ? [rect(70, 1420, 450, 100), rect(560, 1420, 450, 100), rect(70, 1540, 450, 100), rect(560, 1540, 450, 100)] 
        : [rect(60, 790, 280, 80), rect(360, 790, 280, 80), rect(660, 790, 280, 80)],
      badges: story ? [rect(70, 1680, 450, 80), rect(560, 1680, 450, 80)] : [rect(60, 890, 280, 50), rect(360, 890, 280, 50), rect(660, 890, 280, 50)],
      callouts: [],
      arrows: [],
      footer: story ? rect(70, 1800, 940, 80) : rect(60, 950, 880, 40),
    };
  }

  if (template.id === "lifestyle_model") {
    return {
      ...base,
      title: story ? rect(70, 100, 800, 200) : rect(60, 60, 640, 140),
      subtitle: story ? rect(70, 320, 700, 80) : rect(60, 210, 540, 60),
      productSafeArea: story ? rect(200, 420, 810, 980) : rect(300, 280, 640, 480),
      benefits: story 
        ? [rect(70, 1440, 450, 90), rect(560, 1440, 450, 90), rect(70, 1550, 450, 90)] 
        : [rect(60, 780, 280, 70), rect(360, 780, 280, 70), rect(660, 780, 280, 70)],
      badges: story ? [rect(70, 1680, 600, 80)] : [rect(60, 870, 400, 50)],
      callouts: [],
      arrows: [],
      footer: story ? rect(70, 1800, 940, 80) : rect(60, 940, 880, 40),
    };
  }

  if (template.id === "feature_grid_compact") {
    return {
      ...base,
      title: story ? rect(72, 90, 936, 160) : rect(72, 52, 856, 100),
      subtitle: story ? rect(90, 270, 900, 64) : rect(120, 162, 760, 44),
      productSafeArea: story ? rect(260, 480, 560, 720) : rect(380, 260, 240, 360),
      benefits: story
        ? [
            rect(44, 420, 360, 110),
            rect(676, 420, 360, 110),
            rect(44, 1320, 360, 110),
            rect(676, 1320, 360, 110),
          ]
        : [rect(42, 280, 250, 90), rect(708, 280, 250, 90), rect(42, 460, 250, 90), rect(708, 460, 250, 90)],
      badges: story ? [rect(220, 1500, 640, 64)] : [rect(340, 720, 320, 48)],
      callouts: [],
      arrows: [],
      footer: story ? rect(72, 1720, 936, 72) : rect(72, 860, 856, 48),
    };
  }

  if (template.id === "clean_catalog_compact") {
    return {
      ...base,
      title: story ? rect(80, 90, 920, 150) : rect(82, 52, 836, 95),
      subtitle: story ? rect(100, 260, 880, 64) : rect(100, 158, 800, 44),
      productSafeArea: story ? rect(150, 420, 780, 900) : rect(220, 250, 560, 420),
      benefits: story
        ? [
            rect(80, 1320, 430, 80),
            rect(570, 1320, 430, 80),
            rect(80, 1420, 430, 80),
            rect(570, 1420, 430, 80),
          ]
        : [rect(80, 698, 380, 64), rect(540, 698, 380, 64), rect(80, 778, 380, 64), rect(540, 778, 380, 64)],
      badges: story ? [rect(260, 1588, 560, 56)] : [rect(320, 858, 360, 36)],
      callouts: [],
      arrows: [],
      footer: story ? rect(84, 1700, 912, 48) : rect(82, 940, 836, 28),
    };
  }

  if (template.id === "minimal_top_bottom") {
    return {
      ...base,
      title: story ? rect(54, 96, 972, 150) : rect(52, 48, 896, 100),
      subtitle: story ? rect(54, 268, 972, 64) : rect(52, 158, 896, 56),
      productSafeArea: story ? rect(180, 400, 720, 1040) : rect(260, 240, 480, 520),
      benefits: story
        ? [
            rect(54, 1620, 498, 88),
            rect(570, 1620, 498, 88),
            rect(54, 1726, 498, 88),
          ]
        : [rect(52, 828, 448, 78), rect(520, 828, 428, 78)],
      badges: [],
      callouts: [],
      arrows: [],
      footer: story ? rect(54, 1840, 972, 48) : rect(52, 916, 896, 36),
    };
  }

  if (template.id === "minimal_promo") {
    return {
      ...base,
      title: story ? rect(70, 96, 940, 200) : rect(60, 52, 880, 120),
      subtitle: story ? rect(70, 310, 940, 64) : rect(60, 182, 880, 48),
      productSafeArea: story ? rect(160, 460, 840, 880) : rect(300, 280, 600, 420),
      benefits: story
        ? [rect(70, 1440, 460, 86), rect(550, 1440, 460, 86)]
        : [rect(60, 730, 420, 68), rect(520, 730, 420, 68)],
      badges: story ? [rect(300, 1560, 480, 56)] : [rect(360, 820, 280, 44)],
      callouts: [],
      arrows: [],
      footer: story ? rect(70, 1680, 940, 56) : rect(60, 896, 880, 36),
    };
  }

  if (template.id === "bottom_chips") {
    return {
      ...base,
      title: story ? rect(70, 96, 940, 160) : rect(70, 52, 860, 100),
      subtitle: story ? rect(70, 276, 940, 60) : rect(90, 164, 820, 44),
      productSafeArea: story ? rect(140, 420, 800, 1080) : rect(200, 240, 600, 480),
      benefits: story
        ? [rect(54, 1660, 328, 72), rect(402, 1660, 328, 72), rect(750, 1660, 276, 72)]
        : [rect(52, 780, 292, 64), rect(356, 780, 292, 64), rect(660, 780, 288, 64)],
      badges: [],
      callouts: [],
      arrows: [],
      footer: story ? rect(70, 1760, 940, 48) : rect(70, 858, 860, 40),
    };
  }

  return {
    ...base,
    title: story ? rect(70, 100, 940, 200) : rect(60, 60, 880, 140),
    subtitle: story ? rect(70, 320, 700, 80) : rect(60, 210, 500, 60),
    productSafeArea: story ? rect(400, 420, 610, 980) : rect(460, 280, 480, 500),
    benefits: story 
      ? [rect(70, 450, 310, 120), rect(70, 590, 310, 120), rect(70, 730, 310, 120), rect(70, 870, 310, 120)] 
      : [rect(60, 300, 380, 90), rect(60, 410, 380, 90), rect(60, 520, 380, 90), rect(60, 630, 380, 90)],
    badges: story ? [rect(70, 1500, 450, 80), rect(540, 1500, 450, 80)] : [rect(60, 800, 300, 60), rect(380, 800, 300, 60)],
    callouts: [],
    arrows: story ? [{ from: pt(400, 510), to: pt(600, 600) }, { from: pt(400, 790), to: pt(630, 840) }] : [{ from: pt(460, 345), to: pt(610, 370) }, { from: pt(460, 565), to: pt(620, 530) }],
    footer: story ? rect(70, 1650, 940, 100) : rect(60, 900, 880, 60),
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
  return PRODUCT_CARD_TEMPLATE_PRESETS.filter((p) => p.publicInPicker !== false).map(
    ({ id, label, description, bestFor }) => ({ id, label, description, bestFor }),
  );
}

export function getPublicProductCardTypographyPresets() {
  return PRODUCT_CARD_TYPOGRAPHY_PRESETS.map(({ id, label }) => ({ id, label }));
}

export const PRODUCT_CARD_TYPOGRAPHY_TEST_STRINGS = {
  ru: ["Стильные солнцезащитные очки", "Классический черный цвет", "Удобная посадка", "Премиум качество"],
  kk: ["Күннен қорғайтын көзілдірік", "Жеңіл жақтау", "Ыңғайлы отырады", "Премиум сапа", "Ә Ғ Қ Ң Ө Ұ Ү Һ І"],
} as const;
