
import { prisma } from "@/lib/prisma";

/**
 * Р‘РµР·РѕРїР°СЃРЅС‹Р№ Р»РѕРі РІС…РѕРґСЏС‰РµРіРѕ webhook Kaspi (ApiLog). РќРµ РїРµСЂРµРґР°РІР°С‚СЊ РєР»СЋС‡Рё Рё Authorization.
 */
export async function logKaspiWebhookApi(args: {
  endpoint: string;
  statusCode: number;
  sanitizedPayload: unknown;
  errorMessage?: string | null;
}) {
  try {
    await prisma.apiLog.create({
      data: {
        provider: "KASPI",
        endpoint: args.endpoint.slice(0, 2048),
        requestPayload: args.sanitizedPayload as object,
        statusCode: args.statusCode,
        errorMessage: args.errorMessage?.slice(0, 2000) ?? null,
      },
    });
  } catch {
    // РЅРµ Р»РѕРјР°РµРј webhook РїСЂРё СЃР±РѕРµ Р»РѕРіРёСЂРѕРІР°РЅРёСЏ
  }
}
