
import { createHash, createHmac, timingSafeEqual } from "node:crypto";

import { Prisma } from "@/generated/prisma/client";
import { explainKieErrorForUser } from "@/lib/kie-error-hints";
import { prisma } from "@/lib/prisma";
import { createApiLog } from "@/server/services/api-log";
import {
  completeWithOutput,
  markFailed,
} from "@/server/services/generationProcessor";
import {
  normalizeResponse,
  redactKieLogPayload,
} from "@/server/services/provider/kie";

const TERMINAL = new Set<string>([
  "COMPLETED",
  "FAILED",
  "REFUNDED",
  "CANCELLED",
  "BLOCKED",
]);

const KIE_WEBHOOK_PROVIDER = "KIE_AI";

/**
 * РџСЂРѕРІРµСЂРєР°: Bearer / X-Webhook-Token; Р»РёР±Рѕ HMAC-SHA256 С‚РµР»Р° (hex) РІ X-Kie-Signature.
 * Р’ **production** Р±РµР· KIE_WEBHOOK_SECRET вЂ” РѕС‚РєР»РѕРЅСЏРµРј (РЅРµ РѕС‚РєСЂС‹РІР°С‚СЊ callback РІ РёРЅС‚РµСЂРЅРµС‚Рµ).
 * Р’ dev Р±РµР· СЃРµРєСЂРµС‚Р° вЂ” РїСЂРѕРїСѓСЃРє РґР»СЏ Р»РѕРєР°Р»СЊРЅРѕР№ РѕС‚Р»Р°РґРєРё.
 */
export function verifyKieWebhookAuth(
  request: Request,
  rawBody: string,
): boolean {
  const secret = process.env.KIE_WEBHOOK_SECRET?.trim();
  if (!secret) {
    return process.env.NODE_ENV !== "production";
  }
  const auth = request.headers.get("authorization")?.trim();
  if (auth?.toLowerCase().startsWith("bearer ")) {
    const t = auth.slice(7).trim();
    if (t.length === secret.length && timingCompareStrings(t, secret)) {
      return true;
    }
  }
  if (request.headers.get("x-webhook-token")?.trim() === secret) {
    return true;
  }
  const sig = request.headers.get("x-kie-signature")?.trim();
  if (sig) {
    const h = createHmac("sha256", secret).update(rawBody, "utf8").digest("hex");
    if (h.length === sig.length) {
      try {
        if (timingSafeEqual(Buffer.from(h, "utf8"), Buffer.from(sig, "utf8"))) {
          return true;
        }
      } catch {
        // ignore
      }
    }
  }
  return false;
}

function timingCompareStrings(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  try {
    return timingSafeEqual(Buffer.from(a, "utf8"), Buffer.from(b, "utf8"));
  } catch {
    return false;
  }
}

function extractEventType(json: unknown): string {
  if (json && typeof json === "object" && !Array.isArray(json)) {
    const o = json as Record<string, unknown>;
    if (typeof o.event === "string" && o.event) return o.event.slice(0, 128);
    if (typeof o.type === "string" && o.type) return o.type.slice(0, 128);
  }
  return "kie.webhook";
}

function payloadDedupId(rawBody: string): string {
  return createHash("sha256").update(rawBody, "utf8").digest("hex").slice(0, 128);
}

export type KieWebhookHandlerResult =
  | { status: 200 }
  | { status: 400 }
  | { status: 401 }
  | { status: 500 };

export async function processKieIncomingWebhook(
  request: Request,
  rawBody: string,
): Promise<KieWebhookHandlerResult> {
  if (!verifyKieWebhookAuth(request, rawBody)) {
    return { status: 401 };
  }
  let json: unknown;
  try {
    json = rawBody.trim() ? JSON.parse(rawBody) : {};
  } catch {
    return { status: 400 };
  }
  const providerEventId = payloadDedupId(rawBody);
  const existing = await prisma.webhookEvent.findFirst({
    where: { provider: KIE_WEBHOOK_PROVIDER, providerEventId },
  });
  if (existing?.status === "PROCESSED") {
    return { status: 200 };
  }
  // FAILED РёР»Рё RECEIVED (Р·Р°РІРёСЃС€РёР№) вЂ” РѕР±СЂР°Р±РѕС‚Р°С‚СЊ СЃРЅРѕРІР°

  if (!existing) {
    try {
      await prisma.webhookEvent.create({
        data: {
          provider: KIE_WEBHOOK_PROVIDER,
          eventType: extractEventType(json),
          providerEventId,
          payload: json as Prisma.InputJsonValue,
          status: "RECEIVED",
        },
      });
    } catch (e) {
      const code = (e as { code?: string }).code;
      if (code !== "P2002") {
        throw e;
      }
    }
  }

  const norm = normalizeResponse(json, 200);
  const taskId = norm.taskId;

  if (!taskId) {
    await finalizeKieWebhookRow(providerEventId, "PROCESSED", null);
    await createApiLog({
      provider: "KIE_AI",
      endpoint: "webhook/kie",
      requestPayload: { note: "no_taskId" },
      responsePayload: redactKieLogPayload(json),
      statusCode: 200,
      errorMessage: "Kie webhook: РЅРµС‚ taskId",
    });
    return { status: 200 };
  }

  const row = await prisma.generation.findFirst({
    where: { providerTaskId: taskId },
    include: { model: true },
  });

  if (!row) {
    await finalizeKieWebhookRow(providerEventId, "PROCESSED", null);
    return { status: 200 };
  }

  if (TERMINAL.has(row.status)) {
    await finalizeKieWebhookRow(providerEventId, "PROCESSED", null);
    return { status: 200 };
  }

  const { model, ...gen } = row;
  const imgs = norm.imageUrls ?? [];
  const vids = norm.videoUrls ?? [];
  const hasMedia = imgs.length > 0 || vids.length > 0;

  try {
    if (hasMedia) {
      if (model.type === "IMAGE" && imgs.length > 0) {
        await completeWithOutput(gen, "IMAGE", imgs);
      } else if (model.type === "VIDEO") {
        const urls = vids.length > 0 ? vids : imgs;
        if (urls.length > 0) {
          await completeWithOutput(gen, "VIDEO", urls);
        }
      } else if (imgs.length === 0 && vids.length > 0) {
        await completeWithOutput(gen, "IMAGE", vids);
      }
    } else if (!norm.success && norm.errorMessage) {
      await markFailed(
        gen.id,
        explainKieErrorForUser(
          `Kie webhook: ${norm.errorMessage}`,
          "РћС€РёР±РєР° Kie (webhook)",
        ),
      );
    }

    await createApiLog({
      generationId: gen.id,
      provider: "KIE_AI",
      endpoint: "webhook/kie",
      requestPayload: { taskId, hasMedia, ackOnly: !hasMedia && !(!norm.success && norm.errorMessage) },
      responsePayload: redactKieLogPayload(json),
      statusCode: 200,
      errorMessage:
        !hasMedia && !norm.success ? norm.errorMessage?.slice(0, 2000) ?? null : null,
    });

    await finalizeKieWebhookRow(providerEventId, "PROCESSED", null);
    return { status: 200 };
  } catch (e) {
    const message =
      e instanceof Error ? e.message : "Kie webhook: РІРЅСѓС‚СЂРµРЅРЅСЏСЏ РѕС€РёР±РєР°";
    await finalizeKieWebhookRow(providerEventId, "FAILED", message.slice(0, 2000));
    return { status: 500 };
  }
}

async function finalizeKieWebhookRow(
  providerEventId: string,
  status: "PROCESSED" | "FAILED",
  errorMessage: string | null,
) {
  await prisma.webhookEvent.updateMany({
    where: { provider: KIE_WEBHOOK_PROVIDER, providerEventId },
    data: {
      status,
      processedAt: new Date(),
      errorMessage: errorMessage?.slice(0, 2000) ?? undefined,
    },
  });
}
