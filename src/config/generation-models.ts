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

/** Секции фильтров каталога: id задачи → label */
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
   * Все slug одной «семьи»: при merge считаются одной витринной карточкой и не дают второй строки хвоста.
   */
  familyDbSlugCandidates?: string[];
  /**
   * Slug для ?model= при открытии create flow — обычно короткий (как в ТЗ).
   * Должен мапиться на первую активную модель с одним из dbSlugCandidates через alias map.
   */
  urlSlugForGenerator?: string;
  /** CSS gradient для карточки без превью */
  gradientClass: string;
  /**
   * Каталог: кнопка «Открыть» ведёт на /dashboard/models/[slug] (хаб с режимами),
   * а не сразу на общую форму create/image|video.
   */
  catalogOpenIsModelHub?: boolean;
  /**
   * Не показывать карточку на /dashboard/models (общий каталог).
   * Сценарии карточки товара остаются в /dashboard/create/product-card.
   */
  hideFromModelsCatalog?: boolean;
};

const GPT_IMAGE_2_FAMILY_VARIANTS: readonly {
  slug: string;
  optionLabel: string;
}[] = [
  {
    slug: "gpt-image-2-text-to-image",
    optionLabel: "Текст → изображение",
  },
  {
    slug: "gpt-image-2-image-to-image-general",
    optionLabel: "Изображение → изображение",
  },
];

const GPT_IMAGE_2_FAMILY_SLUGS = GPT_IMAGE_2_FAMILY_VARIANTS.map((v) => v.slug);

/** Группы в селекторе «Создать фото» (одна папка — несколько AiModel). */
export type ImageCreateModelGroupSpec = {
  label: string;
  variants: readonly { slug: string; optionLabel: string }[];
};

export const IMAGE_CREATE_MODEL_GROUPS: ImageCreateModelGroupSpec[] = [
  { label: "GPT Image 2", variants: GPT_IMAGE_2_FAMILY_VARIANTS },
];

export const GENERATION_MODEL_CATALOG: CatalogModelDefinition[] = [
  {
    catalogSlug: "gpt-image-2",
    displayName: "GPT Image 2",
    providerLabel: "OpenAI",
    descriptionFallback:
      "Генерация и редактирование изображений для товаров, рекламы и карточек.",
    tasks: ["text_to_image", "image_to_image", "image_editing"],
    category: "image",
    dbSlugCandidates: [...GPT_IMAGE_2_FAMILY_SLUGS],
    familyDbSlugCandidates: [...GPT_IMAGE_2_FAMILY_SLUGS],
    urlSlugForGenerator: "gpt-image-2",
    openBehavior: { kind: "image", querySlug: "gpt-image-2" },
    catalogOpenIsModelHub: true,
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
    hideFromModelsCatalog: true,
    gradientClass:
      "from-cyan-500/85 via-sky-500/80 to-blue-600/90",
  },
  {
    catalogSlug: "seedance-2",
    displayName: "Seedance 2.0",
    providerLabel: "ByteDance",
    descriptionFallback:
      "Видео по тексту, первый и последний кадр, референсы изображений, видео и аудио.",
    tasks: ["text_to_video", "image_to_video", "lip_sync"],
    category: "video",
    dbSlugCandidates: [
      "seedance-2-0-text-to-video",
      "seedance-2-0-image-to-video",
    ],
    familyDbSlugCandidates: [
      "seedance-2-0-text-to-video",
      "seedance-2-0-image-to-video",
    ],
    urlSlugForGenerator: "seedance-2",
    openBehavior: { kind: "video", querySlug: "seedance-2" },
    gradientClass:
      "from-violet-500/88 via-purple-600/85 to-fuchsia-700/88",
  },
  {
    catalogSlug: "seedance-2-fast",
    displayName: "Seedance 2.0 Fast",
    providerLabel: "ByteDance",
    descriptionFallback:
      "Более быстрый режим той же линейки для ускоренной генерации видео.",
    tasks: ["text_to_video", "image_to_video", "lip_sync"],
    category: "video",
    dbSlugCandidates: [
      "seedance-2-0-fast-text-to-video",
      "seedance-2-0-fast-image-to-video",
    ],
    familyDbSlugCandidates: [
      "seedance-2-0-fast-text-to-video",
      "seedance-2-0-fast-image-to-video",
    ],
    urlSlugForGenerator: "seedance-2-fast",
    openBehavior: { kind: "video", querySlug: "seedance-2-fast" },
    gradientClass:
      "from-violet-500/82 via-purple-500/78 to-pink-600/82",
  },
  {
    catalogSlug: "seedance-1-5-pro",
    displayName: "Seedance 1.5 Pro",
    providerLabel: "ByteDance",
    descriptionFallback:
      "Видео Seedance 1.5 Pro: сценарии и настройки как у Seedance 2.0.",
    tasks: ["text_to_video", "image_to_video", "lip_sync"],
    category: "video",
    dbSlugCandidates: ["seedance-1-5-pro"],
    urlSlugForGenerator: "seedance-1-5-pro",
    openBehavior: { kind: "video", querySlug: "seedance-1-5-pro" },
    gradientClass:
      "from-fuchsia-500/85 via-violet-600/82 to-indigo-700/88",
  },
  {
    catalogSlug: "kling-3",
    displayName: "Kling 3.0",
    providerLabel: "Kuaishou",
    descriptionFallback:
      "Качественное видео из изображения и текста; режимы Kling 3.0, Kling 3.0 Video и Motion Control.",
    tasks: ["image_to_video", "text_to_video", "video_to_video"],
    category: "video",
    dbSlugCandidates: [
      "kling-3-0",
      "kling-3-0-video",
      "kling-3-0-motion-control",
    ],
    familyDbSlugCandidates: [
      "kling-3-0",
      "kling-3-0-video",
      "kling-3-0-motion-control",
    ],
    urlSlugForGenerator: "kling",
    openBehavior: { kind: "video", querySlug: "kling" },
    catalogOpenIsModelHub: true,
    gradientClass:
      "from-orange-500/87 via-rose-500/82 to-red-700/85",
    hideFromModelsCatalog: true,
  },
  {
    catalogSlug: "kling-2-6",
    displayName: "Kling 2.6",
    providerLabel: "Kuaishou",
    descriptionFallback:
      "Видео по тексту и из изображения — отдельные режимы с понятными настройками для каждого сценария.",
    tasks: ["text_to_video", "image_to_video"],
    category: "video",
    dbSlugCandidates: [
      "kling-2-6-text-to-video",
      "kling-2-6-image-to-video",
    ],
    familyDbSlugCandidates: [
      "kling-2-6-text-to-video",
      "kling-2-6-image-to-video",
    ],
    urlSlugForGenerator: "kling-2-6",
    openBehavior: { kind: "video", querySlug: "kling-2-6" },
    catalogOpenIsModelHub: true,
    gradientClass:
      "from-amber-500/86 via-orange-600/83 to-rose-700/86",
  },
  {
    catalogSlug: "wan-2-7",
    displayName: "Wan 2.7 Video",
    providerLabel: "Alibaba",
    descriptionFallback:
      "Wan 2.7: текст в видео, изображение в видео, по референсам и редактирование ролика.",
    tasks: ["text_to_video", "image_to_video", "video_to_video", "video_editing"],
    category: "video",
    dbSlugCandidates: [
      "wan-2-7-text-to-video",
      "wan-2-7-image-to-video",
      "wan-2-7-r2v",
      "wan-2-7-videoedit",
    ],
    familyDbSlugCandidates: [
      "wan-2-7-text-to-video",
      "wan-2-7-image-to-video",
      "wan-2-7-r2v",
      "wan-2-7-videoedit",
    ],
    urlSlugForGenerator: "wan-2-7",
    openBehavior: { kind: "video", querySlug: "wan-2-7" },
    catalogOpenIsModelHub: true,
    gradientClass:
      "from-emerald-500/86 via-teal-600/84 to-cyan-700/87",
  },
  {
    catalogSlug: "gemini-omni",
    displayName: "Gemini Omni",
    providerLabel: "Google",
    descriptionFallback:
      "Gemini Omni: мультимодальное видео с референсами, голосами и персонажами.",
    tasks: ["text_to_video", "image_to_video", "video_to_video"],
    category: "video",
    dbSlugCandidates: [
      "gemini-omni-video",
      "gemini-omni-audio",
      "gemini-omni-character",
    ],
    familyDbSlugCandidates: [
      "gemini-omni-video",
      "gemini-omni-audio",
      "gemini-omni-character",
    ],
    urlSlugForGenerator: "gemini-omni",
    openBehavior: { kind: "video", querySlug: "gemini-omni" },
    catalogOpenIsModelHub: true,
    gradientClass:
      "from-violet-500/86 via-indigo-600/84 to-blue-700/87",
  },
  {
    catalogSlug: "wan-2-6",
    displayName: "Wan 2.6",
    providerLabel: "Alibaba",
    descriptionFallback:
      "Wan 2.6: текст в видео, изображение в видео и видео в видео.",
    tasks: ["text_to_video", "image_to_video", "video_to_video", "video_editing"],
    category: "video",
    dbSlugCandidates: [
      "wan-2-6-text-to-video",
      "wan-2-6-image-to-video",
      "wan-2-6-video-to-video",
    ],
    familyDbSlugCandidates: [
      "wan-2-6-text-to-video",
      "wan-2-6-image-to-video",
      "wan-2-6-video-to-video",
    ],
    urlSlugForGenerator: "wan-2-6",
    openBehavior: { kind: "video", querySlug: "wan-2-6" },
    catalogOpenIsModelHub: true,
    gradientClass:
      "from-teal-500/85 via-cyan-600/82 to-emerald-800/85",
    hideFromModelsCatalog: true,
  },
  {
    catalogSlug: "grok-imagine",
    displayName: "Grok Imagine",
    providerLabel: "xAI",
    descriptionFallback:
      "Grok Imagine: изображения, редактирование, текст в видео и изображение в видео.",
    tasks: ["text_to_image", "image_to_image", "image_editing", "text_to_video", "image_to_video"],
    category: "image",
    dbSlugCandidates: [
      "grok-imagine-text-to-image",
      "grok-imagine-image-to-image",
      "grok-imagine-text-to-video",
      "grok-imagine-image-to-video",
    ],
    familyDbSlugCandidates: [
      "grok-imagine-text-to-image",
      "grok-imagine-image-to-image",
      "grok-imagine-text-to-video",
      "grok-imagine-image-to-video",
    ],
    urlSlugForGenerator: "grok-imagine",
    openBehavior: { kind: "image", querySlug: "grok-imagine" },
    catalogOpenIsModelHub: true,
    gradientClass:
      "from-slate-600/85 via-zinc-700/82 to-neutral-900/88",
    hideFromModelsCatalog: true,
  },
  {
    catalogSlug: "nano-banana-2",
    displayName: "Nano Banana 2",
    providerLabel: "Google",
    descriptionFallback:
      "Nano Banana 2 image generation with optional reference images.",
    tasks: ["text_to_image", "image_to_image"],
    category: "image",
    dbSlugCandidates: [
      "nano-banana-2-text-to-image",
      "nano-banana-2-image-to-image",
    ],
    familyDbSlugCandidates: [
      "nano-banana-2-text-to-image",
      "nano-banana-2-image-to-image",
    ],
    urlSlugForGenerator: "nano-banana-2",
    openBehavior: { kind: "image", querySlug: "nano-banana-2" },
    catalogOpenIsModelHub: true,
    gradientClass:
      "from-yellow-400/86 via-amber-500/82 to-orange-700/86",
  },
  {
    catalogSlug: "nano-banana-pro",
    displayName: "Nano Banana Pro",
    providerLabel: "Google",
    descriptionFallback: "Nano Banana Pro image-to-image generation.",
    tasks: ["image_to_image", "image_editing"],
    category: "image",
    dbSlugCandidates: ["nano-banana-pro-image-to-image"],
    urlSlugForGenerator: "nano-banana-pro",
    openBehavior: { kind: "image", querySlug: "nano-banana-pro" },
    gradientClass:
      "from-amber-500/88 via-yellow-600/84 to-lime-700/85",
  },
  {
    catalogSlug: "seedream-5-lite",
    displayName: "Seedream 5.0 Lite",
    providerLabel: "ByteDance",
    descriptionFallback: "Seedream 5.0 Lite image-to-image generation.",
    tasks: ["image_to_image", "image_editing"],
    category: "image",
    dbSlugCandidates: ["seedream-5-lite-image-to-image"],
    urlSlugForGenerator: "seedream-5-lite",
    openBehavior: { kind: "image", querySlug: "seedream-5-lite" },
    gradientClass:
      "from-pink-500/86 via-rose-600/82 to-orange-700/86",
  },
  {
    catalogSlug: "seedream-4-5",
    displayName: "Seedream 4.5",
    providerLabel: "ByteDance",
    descriptionFallback: "Seedream 4.5 text-to-image and edit modes.",
    tasks: ["text_to_image", "image_to_image", "image_editing"],
    category: "image",
    dbSlugCandidates: [
      "seedream-4-5-text-to-image",
      "seedream-4-5-edit",
    ],
    familyDbSlugCandidates: [
      "seedream-4-5-text-to-image",
      "seedream-4-5-edit",
    ],
    urlSlugForGenerator: "seedream-4-5",
    openBehavior: { kind: "image", querySlug: "seedream-4-5" },
    catalogOpenIsModelHub: true,
    gradientClass:
      "from-rose-500/86 via-pink-600/82 to-purple-800/86",
  },
  {
    catalogSlug: "flux-2",
    displayName: "Flux 2",
    providerLabel: "Black Forest Labs",
    descriptionFallback:
      "Flux 2 Flex: текст в изображение и изображение в изображение.",
    tasks: ["text_to_image", "image_to_image"],
    category: "image",
    dbSlugCandidates: [
      "flux-2-flex-text-to-image",
      "flux-2-flex-image-to-image",
    ],
    familyDbSlugCandidates: [
      "flux-2-flex-text-to-image",
      "flux-2-flex-image-to-image",
    ],
    urlSlugForGenerator: "flux-2",
    openBehavior: { kind: "image", querySlug: "flux-2" },
    catalogOpenIsModelHub: true,
    gradientClass:
      "from-neutral-700/86 via-zinc-800/82 to-black/88",
  },
  {
    catalogSlug: "qwen-image",
    displayName: "Qwen Image",
    providerLabel: "Alibaba",
    descriptionFallback: "Qwen text-to-image and Qwen2 image edit.",
    tasks: ["text_to_image", "image_editing"],
    category: "image",
    dbSlugCandidates: ["qwen-text-to-image", "qwen2-image-edit"],
    familyDbSlugCandidates: ["qwen-text-to-image", "qwen2-image-edit"],
    urlSlugForGenerator: "qwen-image",
    openBehavior: { kind: "image", querySlug: "qwen-image" },
    catalogOpenIsModelHub: true,
    gradientClass:
      "from-blue-500/86 via-indigo-600/82 to-violet-800/86",
  },
  {
    catalogSlug: "ideogram-v3",
    displayName: "Ideogram V3",
    providerLabel: "Ideogram",
    descriptionFallback: "Ideogram V3 edit and remix modes.",
    tasks: ["image_to_image", "image_editing"],
    category: "image",
    dbSlugCandidates: ["ideogram-v3-edit", "ideogram-v3-remix"],
    familyDbSlugCandidates: ["ideogram-v3-edit", "ideogram-v3-remix"],
    urlSlugForGenerator: "ideogram-v3",
    openBehavior: { kind: "image", querySlug: "ideogram-v3" },
    catalogOpenIsModelHub: true,
    gradientClass:
      "from-lime-500/84 via-emerald-600/82 to-teal-800/86",
  },
  {
    catalogSlug: "hailuo-2-3",
    displayName: "Hailuo 2.3",
    providerLabel: "MiniMax",
    descriptionFallback:
      "Hailuo 2.3: анимация изображения в видео, режимы Standard и Pro.",
    tasks: ["image_to_video"],
    category: "video",
    dbSlugCandidates: [
      "hailuo-2-3-image-to-video-standard",
      "hailuo-2-3-image-to-video-pro",
    ],
    familyDbSlugCandidates: [
      "hailuo-2-3-image-to-video-standard",
      "hailuo-2-3-image-to-video-pro",
    ],
    urlSlugForGenerator: "hailuo-2-3",
    openBehavior: { kind: "video", querySlug: "hailuo-2-3" },
    catalogOpenIsModelHub: true,
    gradientClass:
      "from-indigo-600/87 via-violet-600/85 to-purple-900/88",
    hideFromModelsCatalog: true,
  },
  {
    catalogSlug: "sora-2-pro-storyboard",
    displayName: "Sora 2 Pro · Storyboard",
    providerLabel: "OpenAI",
    descriptionFallback:
      "Видео по сценарию из кадров с длительностями 10, 15 или 25 секунд.",
    tasks: ["text_to_video", "image_to_video"],
    category: "video",
    dbSlugCandidates: ["sora-2-pro-storyboard"],
    urlSlugForGenerator: "sora-2-storyboard",
    openBehavior: { kind: "video", querySlug: "sora-2-storyboard" },
    gradientClass:
      "from-violet-500/88 via-fuchsia-600/85 to-pink-700/90",
    hideFromModelsCatalog: true,
  },
  {
    catalogSlug: "veo-3-1",
    displayName: "Google Veo 3.1",
    providerLabel: "Google",
    descriptionFallback:
      "Google Veo 3.1: генерация видео, продление ролика и результат в 4K или 1080p.",
    tasks: ["text_to_video", "image_to_video", "video_to_video", "video_editing"],
    category: "video",
    dbSlugCandidates: [
      "veo-3-1",
      "veo-extend",
      "veo-get-4k-video",
      "veo-get-1080p-video",
    ],
    familyDbSlugCandidates: [
      "veo-3-1",
      "veo-extend",
      "veo-get-4k-video",
      "veo-get-1080p-video",
    ],
    urlSlugForGenerator: "veo-3-1",
    openBehavior: { kind: "video", querySlug: "veo-3-1" },
    catalogOpenIsModelHub: true,
    gradientClass:
      "from-emerald-500/86 via-teal-600/84 to-cyan-800/88",
    hideFromModelsCatalog: true,
  },
  {
    catalogSlug: "happyhorse-1-0",
    displayName: "HappyHorse-1.0",
    providerLabel: "Alibaba",
    descriptionFallback:
      "Текст в видео, изображение в видео, по референсам и редактирование ролика.",
    tasks: ["text_to_video", "image_to_video", "video_editing"],
    category: "video",
    dbSlugCandidates: [
      "happyhorse-1-0-text-to-video",
      "happyhorse-1-0-image-to-video",
      "happyhorse-1-0-reference-to-video",
      "happyhorse-1-0-video-edit",
    ],
    familyDbSlugCandidates: [
      "happyhorse-1-0-text-to-video",
      "happyhorse-1-0-image-to-video",
      "happyhorse-1-0-reference-to-video",
      "happyhorse-1-0-video-edit",
    ],
    urlSlugForGenerator: "happyhorse-1-0",
    openBehavior: { kind: "video", querySlug: "happyhorse-1-0" },
    catalogOpenIsModelHub: true,
    gradientClass:
      "from-amber-500/88 via-orange-600/85 to-rose-700/88",
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
    hideFromModelsCatalog: true,
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
  map["kling-3-video"] = "kling-3-0-video";
  map["kling-2.6"] = "kling-2-6-text-to-video";
  map["kling-2-6-t2v"] = "kling-2-6-text-to-video";
  map["kling-2-6-i2v"] = "kling-2-6-image-to-video";
  map.seedance = "seedance-2-0-text-to-video";
  map["seedance-2"] = "seedance-2-0-text-to-video";
  map["seedance-2-i2v"] = "seedance-2-0-image-to-video";
  map["seedance-fast"] = "seedance-2-0-fast-text-to-video";
  map["seedance-2-fast"] = "seedance-2-0-fast-text-to-video";
  map["seedance-2-fast-i2v"] = "seedance-2-0-fast-image-to-video";
  map["seedance-1.5"] = "seedance-1-5-pro";
  map.wan = "wan-2-7-text-to-video";
  map["wan-2-7-i2v"] = "wan-2-7-image-to-video";
  map["wan-2-7-r2v"] = "wan-2-7-r2v";
  map["wan-2-7-edit"] = "wan-2-7-videoedit";
  map["gemini-omni"] = "gemini-omni-video";
  map["gemini-omni-video"] = "gemini-omni-video";
  map["gemini-omni-audio"] = "gemini-omni-audio";
  map["gemini-omni-character"] = "gemini-omni-character";
  map["wan-2-6"] = "wan-2-6-text-to-video";
  map["wan-2-6-i2v"] = "wan-2-6-image-to-video";
  map["wan-2-6-v2v"] = "wan-2-6-video-to-video";
  map["happyhorse-1-0"] = "happyhorse-1-0-text-to-video";
  map.happyhorse = "happyhorse-1-0-text-to-video";
  map["happyhorse-1"] = "happyhorse-1-0-text-to-video";
  map["nano-banana-2"] = "nano-banana-2-text-to-image";
  map["nano-banana-2-i2i"] = "nano-banana-2-image-to-image";
  map["nano-banana-pro"] = "nano-banana-pro-image-to-image";
  map["seedream-5-lite"] = "seedream-5-lite-image-to-image";
  map["seedream-4-5"] = "seedream-4-5-text-to-image";
  map["seedream-4-5-edit"] = "seedream-4-5-edit";
  map["flux-2"] = "flux-2-flex-text-to-image";
  map["flux-2-i2i"] = "flux-2-flex-image-to-image";
  map["flux-2-flex-i2i"] = "flux-2-flex-image-to-image";
  map["qwen-image"] = "qwen-text-to-image";
  map.qwen = "qwen-text-to-image";
  map.qwen2 = "qwen2-image-edit";
  map["ideogram-v3"] = "ideogram-v3-edit";
  map["ideogram-v3-remix"] = "ideogram-v3-remix";
  map["grok-imagine"] = "grok-imagine-text-to-image";
  map["grok-imagine-t2i"] = "grok-imagine-text-to-image";
  map["grok-imagine-i2i"] = "grok-imagine-image-to-image";
  map["grok-imagine-t2v"] = "grok-imagine-text-to-video";
  map["grok-imagine-i2v"] = "grok-imagine-image-to-video";
  map["hailuo-2-3"] = "hailuo-2-3-image-to-video-standard";
  map["hailuo-2-3-standard"] = "hailuo-2-3-image-to-video-standard";
  map["hailuo-2-3-pro"] = "hailuo-2-3-image-to-video-pro";
  map["sora-storyboard"] = "sora-2-pro-storyboard";
  map.veo = "veo-3-1";
  map["veo-extend"] = "veo-extend";
  map["veo-get-4k"] = "veo-get-4k-video";
  map["veo-get-1080p"] = "veo-get-1080p-video";
  /** Старый slug после переименования канонического T2I */
  map["gpt-image-2-text-to-image-general"] = "gpt-image-2-text-to-image";
  return map;
}

export const MODEL_SLUG_ALIASES: Record<string, string> =
  buildModelSlugAliasMap();
