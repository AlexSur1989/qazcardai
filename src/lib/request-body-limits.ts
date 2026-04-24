import { NextResponse } from "next/server";

const DEFAULT_JSON = 256 * 1024;
const DEFAULT_WEBHOOK = 1024 * 1024;

/** JSON API (генерация, checkout и т.д.): по умолчанию 256 KiB. */
export function getMaxJsonBodyBytes(): number {
  const raw = process.env.API_MAX_JSON_BODY_BYTES?.trim();
  if (!raw) return DEFAULT_JSON;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n >= 4096 ? n : DEFAULT_JSON;
}

/** Входящие webhooks (Stripe и т.п.): по умолчанию 1 MiB. */
export function getMaxWebhookBodyBytes(): number {
  const raw = process.env.API_MAX_WEBHOOK_BODY_BYTES?.trim();
  if (!raw) return DEFAULT_WEBHOOK;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n >= 4096 ? n : DEFAULT_WEBHOOK;
}

/**
 * Если есть заголовок Content-Length и он больше лимита — отклоняем до чтения тела.
 * Chunked-запросы без заголовка не режем здесь (редко для JSON); см. README_DEPLOY.
 */
export function rejectOversizedBody(
  request: Request,
  maxBytes: number,
): NextResponse | null {
  const cl = request.headers.get("content-length");
  if (!cl) return null;
  const n = Number.parseInt(cl, 10);
  if (!Number.isFinite(n) || n < 0) return null;
  if (n > maxBytes) {
    return NextResponse.json(
      { error: "Слишком большой запрос" },
      { status: 413 },
    );
  }
  return null;
}
