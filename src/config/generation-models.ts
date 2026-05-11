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
    slug: "gpt-image-2-text-to-image-general",
    optionLabel: "Текст → изображение",
  },
  {
    slug: "gpt-image-2-image-to-image",
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
      "Видео по тексту, first/last frame, референсы изображений/видео/аудио (Kie: bytedance/seedance-2).",
    tasks: ["text_to_video", "image_to_video", "lip_sync"],
    category: "video",
    dbSlugCandidates: ["seedance-2-0"],
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
      "Более быстрый режим той же линейки API (Kie: bytedance/seedance-2-fast).",
    tasks: ["text_to_video", "image_to_video", "lip_sync"],
    category: "video",
    dbSlugCandidates: ["seedance-2-0-fast"],
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
      "Видео Kie Market: bytedance/seedance-1.5-pro (сценарии и поля как у Seedance 2.0).",
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
    catalogSlug: "kling-3-0-video",
    displayName: "Kling 3.0 Video",
    providerLabel: "Kuaishou",
    descriptionFallback:
      "Тот же сценарий, что у Kling 3.0; отдельная запись Kie Market: kling-3.0/video.",
    tasks: ["image_to_video", "text_to_video", "video_to_video"],
    category: "video",
    dbSlugCandidates: ["kling-3-0-video"],
    urlSlugForGenerator: "kling-3-video",
    openBehavior: { kind: "video", querySlug: "kling-3-video" },
    gradientClass:
      "from-orange-500/84 via-rose-500/80 to-red-600/82",
  },
  {
    catalogSlug: "kling-2-6",
    displayName: "Kling 2.6",
    providerLabel: "Kuaishou",
    descriptionFallback:
      "Видео по тексту и из изображения (Kie: kling-2.6/text-to-video и kling-2.6/image-to-video). Поля как у Kling 3.0.",
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
    displayName: "Wan 2.7 · Текст → видео",
    providerLabel: "Alibaba",
    descriptionFallback:
      "Генерация видео по тексту (ratio, аудио, negative prompt). Модель Kie: wan/2-7-text-to-video.",
    tasks: ["text_to_video"],
    category: "video",
    dbSlugCandidates: ["wan-2-7-text-to-video"],
    urlSlugForGenerator: "wan-2-7",
    openBehavior: { kind: "video", querySlug: "wan-2-7" },
    gradientClass:
      "from-emerald-500/86 via-teal-600/84 to-cyan-700/87",
  },
  {
    catalogSlug: "wan-2-7-image-to-video",
    displayName: "Wan 2.7 · Изображение → видео",
    providerLabel: "Alibaba",
    descriptionFallback:
      "Из первого/последнего кадра или продолжение клипа; driving audio. Kie: wan/2-7-image-to-video.",
    tasks: ["image_to_video", "video_to_video"],
    category: "video",
    dbSlugCandidates: ["wan-2-7-image-to-video"],
    urlSlugForGenerator: "wan-2-7-i2v",
    openBehavior: { kind: "video", querySlug: "wan-2-7-i2v" },
    gradientClass:
      "from-emerald-500/86 via-teal-600/84 to-cyan-700/87",
  },
  {
    catalogSlug: "wan-2-7-r2v",
    displayName: "Wan 2.7 · Reference → видео",
    providerLabel: "Alibaba",
    descriptionFallback:
      "Ссылки на референс-изображения и/или видео, опционально first frame и голос. Kie: wan/2-7-r2v.",
    tasks: ["text_to_video", "image_to_video", "video_editing"],
    category: "video",
    dbSlugCandidates: ["wan-2-7-r2v"],
    urlSlugForGenerator: "wan-2-7-r2v",
    openBehavior: { kind: "video", querySlug: "wan-2-7-r2v" },
    gradientClass:
      "from-emerald-500/86 via-teal-600/84 to-cyan-700/87",
  },
  {
    catalogSlug: "wan-2-7-videoedit",
    displayName: "Wan 2.7 · Редактирование видео",
    providerLabel: "Alibaba",
    descriptionFallback:
      "Изменение исходного ролика по промпту, опционально референс-изображение. Kie: wan/2-7-videoedit.",
    tasks: ["video_editing"],
    category: "video",
    dbSlugCandidates: ["wan-2-7-videoedit"],
    urlSlugForGenerator: "wan-2-7-edit",
    openBehavior: { kind: "video", querySlug: "wan-2-7-edit" },
    gradientClass:
      "from-emerald-500/86 via-teal-600/84 to-cyan-700/87",
  },
  {
    catalogSlug: "wan-2-6",
    displayName: "Wan 2.6 · Текст → видео",
    providerLabel: "Alibaba",
    descriptionFallback:
      "Видео по тексту (Kie: wan/2-6-text-to-video). Поля как у Wan 2.7 T2V.",
    tasks: ["text_to_video"],
    category: "video",
    dbSlugCandidates: ["wan-2-6-text-to-video"],
    urlSlugForGenerator: "wan-2-6",
    openBehavior: { kind: "video", querySlug: "wan-2-6" },
    gradientClass:
      "from-teal-500/85 via-cyan-600/82 to-emerald-800/85",
  },
  {
    catalogSlug: "wan-2-6-image-to-video",
    displayName: "Wan 2.6 · Изображение → видео",
    providerLabel: "Alibaba",
    descriptionFallback:
      "First/last frame, продолжение клипа (Kie: wan/2-6-image-to-video).",
    tasks: ["image_to_video", "video_to_video"],
    category: "video",
    dbSlugCandidates: ["wan-2-6-image-to-video"],
    urlSlugForGenerator: "wan-2-6-i2v",
    openBehavior: { kind: "video", querySlug: "wan-2-6-i2v" },
    gradientClass:
      "from-teal-500/85 via-cyan-600/82 to-emerald-800/85",
  },
  {
    catalogSlug: "wan-2-6-video-to-video",
    displayName: "Wan 2.6 · Видео → видео",
    providerLabel: "Alibaba",
    descriptionFallback:
      "Исходный ролик и промпт (Kie: wan/2-6-video-to-video). Поля как у Video Edit 2.7.",
    tasks: ["video_editing", "video_to_video"],
    category: "video",
    dbSlugCandidates: ["wan-2-6-video-to-video"],
    urlSlugForGenerator: "wan-2-6-v2v",
    openBehavior: { kind: "video", querySlug: "wan-2-6-v2v" },
    gradientClass:
      "from-teal-500/85 via-cyan-600/82 to-emerald-800/85",
  },
  {
    catalogSlug: "grok-imagine-text-to-image",
    displayName: "Grok Imagine · Текст → изображение",
    providerLabel: "xAI",
    descriptionFallback:
      "Текст → изображение (Kie: grok-imagine/text-to-image).",
    tasks: ["text_to_image"],
    category: "image",
    dbSlugCandidates: ["grok-imagine-text-to-image"],
    urlSlugForGenerator: "grok-imagine-t2i",
    openBehavior: { kind: "image", querySlug: "grok-imagine-t2i" },
    gradientClass:
      "from-slate-600/85 via-zinc-700/82 to-neutral-900/88",
  },
  {
    catalogSlug: "grok-imagine-image-to-image",
    displayName: "Grok Imagine · Изображение → изображение",
    providerLabel: "xAI",
    descriptionFallback:
      "Референс в imageUrls (Kie: grok-imagine/image-to-image).",
    tasks: ["image_to_image", "image_editing"],
    category: "image",
    dbSlugCandidates: ["grok-imagine-image-to-image"],
    urlSlugForGenerator: "grok-imagine-i2i",
    openBehavior: { kind: "image", querySlug: "grok-imagine-i2i" },
    gradientClass:
      "from-slate-600/85 via-zinc-700/82 to-neutral-900/88",
  },
  {
    catalogSlug: "grok-imagine-text-to-video",
    displayName: "Grok Imagine · Текст → видео",
    providerLabel: "xAI",
    descriptionFallback:
      "Текст → видео (Kie: grok-imagine/text-to-video).",
    tasks: ["text_to_video"],
    category: "video",
    dbSlugCandidates: ["grok-imagine-text-to-video"],
    urlSlugForGenerator: "grok-imagine-t2v",
    openBehavior: { kind: "video", querySlug: "grok-imagine-t2v" },
    gradientClass:
      "from-slate-600/85 via-zinc-700/82 to-neutral-900/88",
  },
  {
    catalogSlug: "grok-imagine-image-to-video",
    displayName: "Grok Imagine · Изображение → видео",
    providerLabel: "xAI",
    descriptionFallback:
      "Изображение → видео (Kie: grok-imagine/image-to-video).",
    tasks: ["image_to_video", "text_to_video"],
    category: "video",
    dbSlugCandidates: ["grok-imagine-image-to-video"],
    urlSlugForGenerator: "grok-imagine-i2v",
    openBehavior: { kind: "video", querySlug: "grok-imagine-i2v" },
    gradientClass:
      "from-slate-600/85 via-zinc-700/82 to-neutral-900/88",
  },
  {
    catalogSlug: "hailuo-2-3-i2v-standard",
    displayName: "Hailuo 2.3 · Image→Video (Standard)",
    providerLabel: "MiniMax",
    descriptionFallback:
      "Анимация кадра (Kie: hailuo/2-3-image-to-video-standard). 768P/1080P, 6–10 с.",
    tasks: ["image_to_video"],
    category: "video",
    dbSlugCandidates: ["hailuo-2-3-image-to-video-standard"],
    urlSlugForGenerator: "hailuo-2-3-standard",
    openBehavior: { kind: "video", querySlug: "hailuo-2-3-standard" },
    gradientClass:
      "from-blue-600/86 via-indigo-600/84 to-violet-800/88",
  },
  {
    catalogSlug: "hailuo-2-3-i2v-pro",
    displayName: "Hailuo 2.3 · Image→Video (Pro)",
    providerLabel: "MiniMax",
    descriptionFallback:
      "Анимация кадра, режим Pro (Kie: hailuo/2-3-image-to-video-pro).",
    tasks: ["image_to_video"],
    category: "video",
    dbSlugCandidates: ["hailuo-2-3-image-to-video-pro"],
    urlSlugForGenerator: "hailuo-2-3-pro",
    openBehavior: { kind: "video", querySlug: "hailuo-2-3-pro" },
    gradientClass:
      "from-indigo-600/87 via-violet-600/85 to-purple-900/88",
  },
  {
    catalogSlug: "sora-2-pro-storyboard",
    displayName: "Sora 2 Pro · Storyboard",
    providerLabel: "OpenAI (Kie)",
    descriptionFallback:
      "Видео по сценарию из кадров с длительностями (Kie: sora-2-pro-storyboard): shots, n_frames 10/15/25 с.",
    tasks: ["text_to_video", "image_to_video"],
    category: "video",
    dbSlugCandidates: ["sora-2-pro-storyboard"],
    urlSlugForGenerator: "sora-2-storyboard",
    openBehavior: { kind: "video", querySlug: "sora-2-storyboard" },
    gradientClass:
      "from-violet-500/88 via-fuchsia-600/85 to-pink-700/90",
  },
  {
    catalogSlug: "veo-3-1",
    displayName: "Google Veo 3.1",
    providerLabel: "Google (Kie)",
    descriptionFallback:
      "Генерация видео Veo 3.1 через Kie `/api/v1/veo/generate`: veoModel, aspect_ratio, resolution, generationType, до 3 imageUrls.",
    tasks: ["text_to_video", "image_to_video"],
    category: "video",
    dbSlugCandidates: ["veo-3-1"],
    urlSlugForGenerator: "veo-3-1",
    openBehavior: { kind: "video", querySlug: "veo-3-1" },
    gradientClass:
      "from-emerald-500/86 via-teal-600/84 to-cyan-800/88",
  },
  {
    catalogSlug: "veo-3-1-extend",
    displayName: "Google Veo 3.1 · Extend",
    providerLabel: "Google (Kie)",
    descriptionFallback:
      "Продолжение ролика Veo (`/api/v1/veo/extend`): sourceTaskId и промпт; модель fast | quality | lite.",
    tasks: ["video_to_video", "video_editing"],
    category: "video",
    dbSlugCandidates: ["veo-extend"],
    urlSlugForGenerator: "veo-extend",
    openBehavior: { kind: "video", querySlug: "veo-extend" },
    gradientClass:
      "from-teal-500/85 via-emerald-600/83 to-slate-800/86",
  },
  {
    catalogSlug: "veo-3-1-get-4k",
    displayName: "Google Veo 3.1 · Get 4K",
    providerLabel: "Google (Kie)",
    descriptionFallback:
      "Получить 4K-версию по taskId готового Veo (`/api/v1/veo/get-4k-video`), опционально videoIndex.",
    tasks: ["video_editing"],
    category: "video",
    dbSlugCandidates: ["veo-get-4k-video"],
    urlSlugForGenerator: "veo-get-4k",
    openBehavior: { kind: "video", querySlug: "veo-get-4k" },
    gradientClass:
      "from-cyan-500/84 via-blue-700/82 to-indigo-900/88",
  },
  {
    catalogSlug: "veo-3-1-get-1080p",
    displayName: "Google Veo 3.1 · Get 1080p",
    providerLabel: "Google (Kie)",
    descriptionFallback:
      "Получить 1080p по taskId Veo (GET `/api/v1/veo/get-1080p-video?taskId=…`).",
    tasks: ["video_editing"],
    category: "video",
    dbSlugCandidates: ["veo-get-1080p-video"],
    urlSlugForGenerator: "veo-get-1080p",
    openBehavior: { kind: "video", querySlug: "veo-get-1080p" },
    gradientClass:
      "from-sky-500/82 via-blue-600/80 to-slate-900/85",
  },
  {
    catalogSlug: "happyhorse-1-0",
    displayName: "Happy Horse 1.0",
    providerLabel: "Alibaba ATH",
    descriptionFallback:
      "Текст → видео, изображение → видео, по референсам и редактирование готового ролика (загрузки с компьютера).",
    tasks: ["text_to_video", "image_to_video", "video_editing"],
    category: "video",
    dbSlugCandidates: ["happyhorse-1-0"],
    urlSlugForGenerator: "happyhorse",
    openBehavior: { kind: "video", querySlug: "happyhorse" },
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
  map["kling-2.6"] = "kling-2-6-text-to-video";
  map["kling-2-6-t2v"] = "kling-2-6-text-to-video";
  map["kling-2-6-i2v"] = "kling-2-6-image-to-video";
  map.seedance = "seedance-2-0";
  map["seedance-fast"] = "seedance-2-0-fast";
  map["seedance-1.5"] = "seedance-1-5-pro";
  map.wan = "wan-2-7-text-to-video";
  map["wan-2-6"] = "wan-2-6-text-to-video";
  map["happyhorse-1"] = "happyhorse-1-0";
  map["grok-imagine"] = "grok-imagine-text-to-image";
  map["hailuo-2-3"] = "hailuo-2-3-image-to-video-standard";
  map["sora-storyboard"] = "sora-2-pro-storyboard";
  map.veo = "veo-3-1";
  map["gpt-image-2-text-to-image"] = "gpt-image-2-text-to-image-general";
  return map;
}

export const MODEL_SLUG_ALIASES: Record<string, string> =
  buildModelSlugAliasMap();
