import { toAbsoluteIfAppPath } from "@/lib/app-base-url";

export const PRODUCT_CLASSIFIER_IMAGE_UNAVAILABLE_ERROR =
  "Фото временно недоступно. Загрузите фото заново или попробуйте позже.";

const PRECHECK_TIMEOUT_MS = 8_000;

function isImageContentType(contentType: string | null): boolean {
  if (!contentType) return false;
  const ct = contentType.split(";")[0]!.trim().toLowerCase();
  return ct.startsWith("image/");
}

async function probeImageUrl(url: string, method: "HEAD" | "GET"): Promise<Response> {
  return fetch(url, {
    method,
    redirect: "follow",
    signal: AbortSignal.timeout(PRECHECK_TIMEOUT_MS),
  });
}

/**
 * Проверка доступности фото для Kie до RESERVE. Без секретов, без Kie.
 */
export async function precheckClassifierImageUrl(
  imageUrl: string,
): Promise<{ ok: true } | { ok: false }> {
  const absolute = toAbsoluteIfAppPath(imageUrl.trim());
  if (!/^https:\/\//i.test(absolute)) {
    // relative / storage paths resolved server-side — skip HTTP precheck
    return { ok: true };
  }

  try {
    let res = await probeImageUrl(absolute, "HEAD");
    if (res.status === 405 || res.status === 501) {
      res = await probeImageUrl(absolute, "GET");
    }
    if (!res.ok) return { ok: false };
    const ct = res.headers.get("content-type");
    if (!isImageContentType(ct)) return { ok: false };
    return { ok: true };
  } catch {
    return { ok: false };
  }
}
