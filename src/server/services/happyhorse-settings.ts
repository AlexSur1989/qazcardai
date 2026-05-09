/** Сценарии Happy Horse 1.0 (Kie: happyhorse/*). */

export function isHappyHorseModel(
  apiModelId: string | null | undefined,
): boolean {
  const t = String(apiModelId ?? "").trim().toLowerCase();
  return t.startsWith("happyhorse/");
}

const SCENARIOS = new Set([
  "text-to-video",
  "image-to-video",
  "reference-to-video",
  "video-edit",
]);

export function validateHappyHorseScenario(
  settings: Record<string, unknown>,
  promptTrimmed: string,
): { ok: true } | { ok: false; message: string } {
  const raw = settings.scenario;
  const scenario =
    typeof raw === "string" && raw.trim() !== "" ? raw.trim() : "text-to-video";
  if (!SCENARIOS.has(scenario)) {
    return { ok: false, message: "Некорректный сценарий (scenario)." };
  }
  if (scenario === "text-to-video") {
    if (!promptTrimmed) {
      return { ok: false, message: "Введите промпт." };
    }
  }
  if (scenario === "image-to-video") {
    const imgs = Array.isArray(settings.imageUrls)
      ? settings.imageUrls.filter(
          (x): x is string => typeof x === "string" && x.trim() !== "",
        )
      : [];
    if (imgs.length < 1) {
      return {
        ok: false,
        message: "Загрузите исходное изображение (один файл с компьютера или URL).",
      };
    }
  }
  if (scenario === "reference-to-video") {
    if (!promptTrimmed) {
      return {
        ok: false,
        message: "Введите промпт (можно ссылаться на character1, character2, …).",
      };
    }
    const refs = Array.isArray(settings.referenceImageUrls)
      ? settings.referenceImageUrls.filter(
          (x): x is string => typeof x === "string" && x.trim() !== "",
        )
      : [];
    if (refs.length < 1) {
      return {
        ok: false,
        message: "Добавьте от 1 до 9 референс-изображений.",
      };
    }
  }
  if (scenario === "video-edit") {
    if (!promptTrimmed) {
      return { ok: false, message: "Введите инструкцию по редактированию видео." };
    }
    const vids = Array.isArray(settings.videoUrls)
      ? settings.videoUrls.filter(
          (x): x is string => typeof x === "string" && x.trim() !== "",
        )
      : [];
    if (vids.length < 1) {
      return {
        ok: false,
        message: "Загрузите исходное видео (один файл).",
      };
    }
  }
  return { ok: true };
}

/** Публичные http(s) URL из полей Happy Horse (проверки вложений API). */
export function collectHappyHorseSettingsHttpUrls(
  settings: Record<string, unknown>,
): string[] {
  const out: string[] = [];
  const raw = settings.scenario;
  const scenario =
    typeof raw === "string" && raw.trim() !== "" ? raw.trim() : "text-to-video";
  if (scenario === "image-to-video") {
    for (const x of Array.isArray(settings.imageUrls) ? settings.imageUrls : []) {
      if (typeof x === "string" && x.trim() !== "") out.push(x.trim());
    }
    return out;
  }
  if (scenario === "reference-to-video") {
    for (const x of Array.isArray(settings.referenceImageUrls)
      ? settings.referenceImageUrls
      : []) {
      if (typeof x === "string" && x.trim() !== "") out.push(x.trim());
    }
    return out;
  }
  if (scenario === "video-edit") {
    for (const x of Array.isArray(settings.videoUrls) ? settings.videoUrls : []) {
      if (typeof x === "string" && x.trim() !== "") out.push(x.trim());
    }
    for (const x of Array.isArray(settings.editReferenceImageUrls)
      ? settings.editReferenceImageUrls
      : []) {
      if (typeof x === "string" && x.trim() !== "") out.push(x.trim());
    }
    return out;
  }
  return out;
}
