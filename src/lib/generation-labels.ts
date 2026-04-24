import type { GenerationStatus, GenerationType } from "@/generated/prisma/enums";

export function generationTypeLabel(t: GenerationType): string {
  return t === "IMAGE" ? "Изображение" : "Видео";
}

export function generationStatusLabel(s: GenerationStatus): string {
  const map: Record<GenerationStatus, string> = {
    CREATED: "Создана",
    QUEUED: "В очереди",
    PROCESSING: "В обработке",
    COMPLETED: "Готово",
    FAILED: "Ошибка",
    BLOCKED: "Блок",
    CANCELLED: "Отменена",
    REFUNDED: "Возврат",
  };
  return map[s] ?? s;
}
