/**
 * Выходные размеры сценария «Создать карточку» (универсальный профиль).
 * Соотношения совместимы с Kie GPT Image 2: 1:1, 4:3, 3:4, 16:9, 9:16.
 */
export const CARD_BUILDER_OUTPUT_SIZE_IDS = [
  "1x1",
  "4x3",
  "3x4",
  "16x9",
  "9x16",
] as const;

export type CardBuilderOutputSizeId = (typeof CARD_BUILDER_OUTPUT_SIZE_IDS)[number];

export type CardBuilderOutputSizePreset = {
  id: CardBuilderOutputSizeId;
  label: string;
  aspectRatio: "1:1" | "4:3" | "3:4" | "16:9" | "9:16";
  width: number;
  height: number;
};

export const CARD_BUILDER_OUTPUT_SIZES: readonly CardBuilderOutputSizePreset[] = [
  { id: "1x1", label: "1:1", aspectRatio: "1:1", width: 1500, height: 1500 },
  { id: "4x3", label: "4:3", aspectRatio: "4:3", width: 1600, height: 1200 },
  { id: "3x4", label: "3:4", aspectRatio: "3:4", width: 1200, height: 1600 },
  { id: "16x9", label: "16:9", aspectRatio: "16:9", width: 1344, height: 768 },
  { id: "9x16", label: "9:16", aspectRatio: "9:16", width: 768, height: 1344 },
] as const;

export const CARD_BUILDER_DEFAULT_OUTPUT_SIZE_ID: CardBuilderOutputSizeId = "1x1";

const SIZE_BY_ID = new Map(CARD_BUILDER_OUTPUT_SIZES.map((s) => [s.id, s]));

export function labelForCardBuilderOutputSize(id: CardBuilderOutputSizeId): string {
  const row = SIZE_BY_ID.get(id);
  if (!row) return id;
  return `${row.label} · ${row.width}×${row.height}`;
}

export function isCardBuilderOutputSizeId(raw: string): raw is CardBuilderOutputSizeId {
  return (CARD_BUILDER_OUTPUT_SIZE_IDS as readonly string[]).includes(raw);
}

export function normalizeCardBuilderOutputSizeId(
  raw: string | null | undefined,
): CardBuilderOutputSizeId {
  const t = raw?.trim();
  if (t && isCardBuilderOutputSizeId(t)) return t;
  return CARD_BUILDER_DEFAULT_OUTPUT_SIZE_ID;
}

export function getCardBuilderOutputSizePreset(
  id: string | null | undefined,
): CardBuilderOutputSizePreset {
  return SIZE_BY_ID.get(normalizeCardBuilderOutputSizeId(id)) ?? CARD_BUILDER_OUTPUT_SIZES[0]!;
}
