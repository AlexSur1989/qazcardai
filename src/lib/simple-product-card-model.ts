import type { AiModel } from "@/generated/prisma/client";
import { getSchemaFields } from "@/lib/generation-form-settings-schema";
import { modelHasSettingsSchema } from "@/server/services/model-settings";

/** Модель принимает отдельное reference image (Image B) помимо product photo. */
export function modelSupportsSimpleCardReferenceImage(model: {
  settingsSchema: unknown;
  supportsImageInput: boolean;
}): boolean {
  if (!model.supportsImageInput) return false;
  if (!modelHasSettingsSchema(model.settingsSchema)) {
    return false;
  }
  const fields = getSchemaFields(model.settingsSchema);
  const names = new Set(fields.map((f) => f.name));
  if (names.has("referenceImageUrls")) return true;
  return fields.some(
    (f) =>
      (f.name === "imageUrls" || f.name === "inputUrls") &&
      (f.type === "url-list" ||
        f.type === "image-upload-list" ||
        (typeof f.maxItems === "number" && f.maxItems > 1)),
  );
}

export const SIMPLE_CARD_REFERENCE_UNSUPPORTED_MESSAGE =
  "Выбранная модель не поддерживает фото-референс. Используйте классический стиль без референса или премиум стиль, либо настройте модель в админке.";
