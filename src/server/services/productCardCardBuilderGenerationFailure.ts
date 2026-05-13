import { prisma } from "@/lib/prisma";

import { patchCardBuilderGenerationEntry } from "@/server/services/productCardCardBuilderMeta";

function userReadableFailureMessage(raw: string): string {
  const s = raw.trim().slice(0, 900);
  if (!s) return "Не удалось сгенерировать слайд. Кредиты возвращены.";
  const low = s.toLowerCase();
  if (
    low.includes("moderation") ||
    low.includes("bannedword") ||
    low.includes("nsfw") ||
    low.includes("blocked_pattern")
  ) {
    return "Текст не прошёл проверку. Измените формулировки и попробуйте снова.";
  }
  if (low.includes("kie") || low.includes("provider") || low.includes("polling")) {
    return "Не удалось получить результат у провайдера. Попробуйте позже — кредиты возвращены.";
  }
  if (low.includes("хранилищ") || low.includes("storage")) {
    return "Ошибка при сохранении файла. Попробуйте позже.";
  }
  return "Не удалось завершить генерацию. Попробуйте снова или измените параметры.";
}

/** При FAILED генерации карточки — не оставляем generation в локальном «queued». */
export async function syncFailedCardBuilderProjectGenerationEntry(
  generationId: string,
  rawErrorFromJob: string,
): Promise<void> {
  let meta: Record<string, unknown>;
  try {
    const gen = await prisma.generation.findUnique({
      where: { id: generationId },
      select: { metadata: true },
    });
    meta =
      gen?.metadata &&
      typeof gen.metadata === "object" &&
      !Array.isArray(gen.metadata)
        ? (gen.metadata as Record<string, unknown>)
        : {};
  } catch {
    return;
  }
  if (meta.flow !== "product_card" || meta.tab !== "card_builder") return;
  const projectId =
    typeof meta.projectId === "string" ? meta.projectId.trim() : "";
  if (!projectId) return;
  await patchCardBuilderGenerationEntry(projectId, generationId, {
    status: "error",
    errorMessage: userReadableFailureMessage(rawErrorFromJob),
  }).catch(() => {});
}
