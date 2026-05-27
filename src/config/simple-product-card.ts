/** Простой сценарий «Карточка товара» (card_builder). */

export const SIMPLE_CARD_STYLE_MODES = ["classic", "reference", "premium"] as const;
export type SimpleCardStyleMode = (typeof SIMPLE_CARD_STYLE_MODES)[number];

export const SIMPLE_CARD_ASPECT_RATIOS = ["9:16", "3:4", "1:1", "4:3", "16:9"] as const;
export type SimpleCardAspectRatio = (typeof SIMPLE_CARD_ASPECT_RATIOS)[number];

export const SIMPLE_CARD_DEFAULT_STYLE_MODE: SimpleCardStyleMode = "classic";
export const SIMPLE_CARD_DEFAULT_ASPECT_RATIO: SimpleCardAspectRatio = "1:1";
export const SIMPLE_CARD_USER_TEXT_MAX = 1200;
export const SIMPLE_CARD_CREATIVITY_MIN = 0;
export const SIMPLE_CARD_CREATIVITY_MAX = 100;
export const SIMPLE_CARD_CREATIVITY_DEFAULT = 50;

export type SimpleCardStyleModeMeta = {
  id: SimpleCardStyleMode;
  label: string;
  description: string;
  allowReference: boolean;
  referenceRequired: boolean;
  premiumLocked: boolean;
};

export const SIMPLE_CARD_STYLE_MODE_META: readonly SimpleCardStyleModeMeta[] = [
  {
    id: "classic",
    label: "Классический стиль",
    description:
      "Чистая маркетплейс-карточка: понятный фон, аккуратный товар, читаемый текст.",
    allowReference: true,
    referenceRequired: false,
    premiumLocked: false,
  },
  {
    id: "reference",
    label: "По фото-референсу",
    description:
      "Загрузите пример дизайна. AI возьмёт из него стиль, фон, композицию и визуальную подачу.",
    allowReference: true,
    referenceRequired: true,
    premiumLocked: false,
  },
  {
    id: "premium",
    label: "Премиум стиль",
    description:
      "Дорогая визуальная подача: premium light, аккуратная композиция, современный рекламный дизайн.",
    allowReference: false,
    referenceRequired: false,
    premiumLocked: true,
  },
] as const;

export const SIMPLE_CARD_ASPECT_RATIO_TO_SIZE_ID: Record<SimpleCardAspectRatio, string> = {
  "1:1": "1x1",
  "4:3": "4x3",
  "3:4": "3x4",
  "16:9": "16x9",
  "9:16": "9x16",
};

export function metaForSimpleCardStyleMode(id: SimpleCardStyleMode): SimpleCardStyleModeMeta {
  return SIMPLE_CARD_STYLE_MODE_META.find((m) => m.id === id) ?? SIMPLE_CARD_STYLE_MODE_META[0]!;
}
