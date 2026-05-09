/** Kie Market: `sora-2-pro-storyboard` (сториборд по кадрам). */

export function isSora2ProStoryboardModel(
  apiModelId: string | null | undefined,
): boolean {
  return String(apiModelId ?? "").trim() === "sora-2-pro-storyboard";
}

function isRecord(x: unknown): x is Record<string, unknown> {
  return typeof x === "object" && x !== null && !Array.isArray(x);
}

function imageUrlList(settings: Record<string, unknown>): string[] {
  if (!Array.isArray(settings.imageUrls)) return [];
  return settings.imageUrls
    .filter((x): x is string => typeof x === "string" && x.trim() !== "")
    .map((s) => s.trim());
}

/**
 * До 1 референс-изображения: из `imageUrls` или первый публичный URL из вложений.
 */
export function mergeSoraStoryboardSettingsWithInputFiles(
  apiModelId: string,
  settings: Record<string, unknown>,
  inputHttpUrls: string[],
): Record<string, unknown> {
  if (!isSora2ProStoryboardModel(apiModelId)) return settings;
  if (imageUrlList(settings).length > 0) return settings;
  if (inputHttpUrls.length === 0) return settings;
  return { ...settings, imageUrls: [inputHttpUrls[0]!] };
}

function nFramesSeconds(nf: string): number {
  const n = Number.parseInt(nf, 10);
  if (n === 10 || n === 15 || n === 25) return n;
  return 15;
}

function normalizeShot(
  raw: unknown,
): { Scene: string; duration: number } | null {
  if (!isRecord(raw)) return null;
  const scene =
    typeof raw.Scene === "string"
      ? raw.Scene.trim()
      : typeof raw.scene === "string"
        ? raw.scene.trim()
        : "";
  const d = Number(raw.duration);
  if (!scene || !Number.isFinite(d)) return null;
  let duration = d;
  if (duration < 0.1) duration = 0.1;
  if (duration > 15) duration = 15;
  return { Scene: scene, duration };
}

/**
 * Разбор поля `shots` (массив после model-settings) → для Kie.
 */
export function kieShotsFromSettings(
  shots: unknown,
): { Scene: string; duration: number }[] {
  if (!Array.isArray(shots)) return [];
  const out: { Scene: string; duration: number }[] = [];
  for (const item of shots) {
    const s = normalizeShot(item);
    if (s) out.push(s);
  }
  return out.slice(0, 10);
}

export function validateSora2ProStoryboardSettings(
  settings: Record<string, unknown>,
): { ok: true } | { ok: false; message: string } {
  const shotsRaw = settings.shots;
  const shots = kieShotsFromSettings(shotsRaw);
  if (shots.length === 0) {
    return {
      ok: false,
      message:
        "Sora 2 Pro Storyboard: задайте массив кадров `shots` (JSON): для каждого кадра Scene и duration (сек).",
    };
  }
  if (shots.length > 10) {
    return {
      ok: false,
      message: "Sora 2 Pro Storyboard: не более 10 кадров.",
    };
  }

  const nf = String(settings.n_frames ?? "15").trim();
  if (nf !== "10" && nf !== "15" && nf !== "25") {
    return {
      ok: false,
      message: "Sora 2 Pro Storyboard: n_frames — 10, 15 или 25.",
    };
  }

  const cap = nFramesSeconds(nf);
  const sum = shots.reduce((a, s) => a + s.duration, 0);
  if (sum > cap + 1e-6) {
    return {
      ok: false,
      message: `Sora 2 Pro Storyboard: сумма длительностей кадров (${sum.toFixed(1)} с) не может превышать n_frames (${cap} с).`,
    };
  }

  const ar = String(settings.aspect_ratio ?? "landscape").trim().toLowerCase();
  if (ar !== "portrait" && ar !== "landscape") {
    return {
      ok: false,
      message: "Sora 2 Pro Storyboard: aspect_ratio — portrait или landscape.",
    };
  }

  const um = String(settings.upload_method ?? "s3").trim().toLowerCase();
  if (um !== "s3" && um !== "oss") {
    return {
      ok: false,
      message: "Sora 2 Pro Storyboard: upload_method — s3 или oss.",
    };
  }

  return { ok: true };
}
