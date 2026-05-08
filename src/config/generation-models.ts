/**
 * Каталог моделей генерации (метаданные UI + задачи).
 * Данные о цене и активности дополняются из БД (AiModel), см. mergeGenerationCatalog.
 */

export type GenerationTaskId =
  | "text_to_image"
  | "image_to_image"
  | "image_editing"
  | "product_card"
  | "text_to_video"
  | "image_to_video"
  | "video_to_video"
  | "video_editing"
  | "lip_sync"
  | "chat"
  | "product_analysis"
  | "prompt_helper";

/** Группа в левой панели фильтров */
export type GenerationTaskFilterGroupId =
  | "image"
  | "video"
  | "chat";

export type GenerationModelCategory =
  | "image"
  | "video"
  | "product_card"
  | "chat";

export type GenerationModelOpenBehavior =
  | { kind: "image"; querySlug: string }
  | { kind: "video"; querySlug: string }
  | { kind: "product_card" }
  | { kind: "detail_only" }; /// страница /dashboard/models/[catalogSlug]

export const TASK_LABELS_RU: Record<GenerationTaskId, string> = {
  text_to_image: "Текст → изображение",
  image_to_image: "Изображение → изображение",
  image_editing: "Редактирование изображения",
  product_card: "Карточка товара",
  text_to_video: "Текст → видео",
  image_to_video: "Изображение → видео",
  video_to_video: "Видео → видео",
  video_editing: "Редактирование видео",
  lip_sync: "Lip Sync",
  chat: "Чат",
  product_analysis: "Анализ товара",
  prompt_helper: "Помощник промптов",
};

/** Секции фильтров (как Kie.ai): id задачи → label */
export const TASK_FILTER_GROUPS: {
  title: string;
  groupId: GenerationTaskFilterGroupId;
  items: { id: GenerationTaskId; label: string }[];
}[] = [
  {
    title: "Изображения",
    groupId: "image",
    items: [
      { id: "text_to_image", label: TASK_LABELS_RU.text_to_image },
      { id: "image_to_image", label: TASK_LABELS_RU.image_to_image },
      { id: "image_editing", label: TASK_LABELS_RU.image_editing },
      { id: "product_card", label: TASK_LABELS_RU.product_card },
    ],
  },
  {
    title: "Видео",
    groupId: "video",
    items: [
      { id: "text_to_video", label: TASK_LABELS_RU.text_to_video },
      { id: "image_to_video", label: TASK_LABELS_RU.image_to_video },
      { id: "video_to_video", label: TASK_LABELS_RU.video_to_video },
      { id: "video_editing", label: TASK_LABELS_RU.video_editing },
      { id: "lip_sync", label: TASK_LABELS_RU.lip_sync },
    ],
  },
  {
    title: "Чат / промпты",
    groupId: "chat",
    items: [
      { id: "chat", label: TASK_LABELS_RU.chat },
      { id: "product_analysis", label: TASK_LABELS_RU.product_analysis },
      { id: "prompt_helper", label: TASK_LABELS_RU.prompt_helper },
    ],
  },
];

/** Статический каталог «витрины» — приоритетные карточки + структура для merge с БД */
export type CatalogModelDefinition = {
  /** URL /dashboard/models/[catalogSlug], поиск по витрине */
  catalogSlug: string;
  /** Имя без БД — подставится из записи AiModel если найден primaryDbSlug */
  displayName: string;
  /** Бренд в UI — если из БД, можно переопределить providerLabel в merge */
  providerLabel: string;
  descriptionFallback: string;
  tasks: GenerationTaskId[];
  category: GenerationModelCategory;
  openBehavior: GenerationModelOpenBehavior;
  /** Сопоставление с AiModel.slug (первая найденная в БД запись побеждает) */
  dbSlugCandidates: string[];
  /**
   * Slug для ?model= при открытии create flow — обычно короткий (как в ТЗ).
   * Должен мапиться на первую активную модель с одним из dbSlugCandidates через alias map.
   */
  urlSlugForGenerator?: string;
  /** CSS gradient для карточки без превью */
  gradientClass: string;
};

export const GENERATION_MODEL_CATALOG: CatalogModelDefinition[] = [
  {
    catalogSlug: "gpt-image-2",
    displayName: "GPT Image 2",
    providerLabel: "OpenAI",
    descriptionFallback:
      "Генерация и редактирование изображений для товаров, рекламы и карточек.",
    tasks: ["text_to_image", "image_to_image", "image_editing"],
    category: "image",
    dbSlugCandidates: ["gpt-image-2-text-to-image-general"],
    urlSlugForGenerator: "gpt-image-2",
    openBehavior: { kind: "image", querySlug: "gpt-image-2" },
    gradientClass:
      "from-sky-500/90 via-blue-600/85 to-indigo-700/90",
  },
  {
    catalogSlug: "product-card-suite",
    displayName: "Product Card Image",
    providerLabel: "OpenAI · QazCard AI",
    descriptionFallback:
      "Поток карточки товара: классификация, концепты, маркетплейс и видео.",
    tasks: ["product_card", "image_to_image"],
    category: "product_card",
    dbSlugCandidates: [],
    openBehavior: { kind: "product_card" },
    gradientClass:
      "from-cyan-500/85 via-sky-500/80 to-blue-600/90",
  },
  {
    catalogSlug: "seedance-2",
    displayName: "Seedance 2.0",
    providerLabel: "ByteDance",
    descriptionFallback:
      "Генерация видео по тексту и изображению, сценарии с персонажами и lip sync.",
    tasks: ["text_to_video", "image_to_video", "lip_sync"],
    category: "video",
    dbSlugCandidates: ["seedance-2-0", "seedance-2-0-fast"],
    urlSlugForGenerator: "seedance-2",
    openBehavior: { kind: "video", querySlug: "seedance-2" },
    gradientClass:
      "from-violet-500/88 via-purple-600/85 to-fuchsia-700/88",
  },
  {
    catalogSlug: "kling-3",
    displayName: "Kling",
    providerLabel: "Kuaishou",
    descriptionFallback:
      "Качественное видео из изображения и текста; расширенные режимы в каталоге.",
    tasks: ["image_to_video", "text_to_video", "video_to_video"],
    category: "video",
    dbSlugCandidates: ["kling-3-0", "kling-3-0-motion-control"],
    urlSlugForGenerator: "kling",
    openBehavior: { kind: "video", querySlug: "kling" },
    gradientClass:
      "from-orange-500/87 via-rose-500/82 to-red-700/85",
  },
  {
    catalogSlug: "wan-2-7",
    displayName: "Wan 2.7 Video",
    providerLabel: "Alibaba",
    descriptionFallback:
      "Текстовое и условное видео с настройкой разрешения и длительности.",
    tasks: ["text_to_video", "image_to_video"],
    category: "video",
    dbSlugCandidates: ["wan-2-7-text-to-video"],
    urlSlugForGenerator: "wan-2-7",
    openBehavior: { kind: "video", querySlug: "wan-2-7" },
    gradientClass:
      "from-emerald-500/86 via-teal-600/84 to-cyan-700/87",
  },
  {
    catalogSlug: "gemini-product-helper",
    displayName: "Gemini / Vision Helper",
    providerLabel: "Google",
    descriptionFallback:
      "Анализ товара по фото и подсказки для промптов в потоке карточки товара.",
    tasks: ["product_analysis", "prompt_helper", "chat"],
    category: "chat",
    dbSlugCandidates: ["gemini-2-5-flash-classifier"],
    openBehavior: { kind: "detail_only" },
    gradientClass:
      "from-blue-500/85 via-sky-400/78 to-indigo-600/88",
  },
];

/** Карта короткий slug (?model=) → канонический slug в БД (первая из dbSlugCandidates) */
export function buildModelSlugAliasMap(): Record<string, string> {
  const map: Record<string, string> = {};
  for (const def of GENERATION_MODEL_CATALOG) {
    if (def.urlSlugForGenerator && def.dbSlugCandidates[0]) {
      map[def.urlSlugForGenerator] = def.dbSlugCandidates[0];
    }
  }
  // Явные алиасы без отдельного catalog entry (например motion control)
  map["kling-motion"] = "kling-3-0-motion-control";
  map.seedance = "seedance-2-0";
  map.wan = "wan-2-7-text-to-video";
  return map;
}

export const MODEL_SLUG_ALIASES: Record<string, string> =
  buildModelSlugAliasMap();
