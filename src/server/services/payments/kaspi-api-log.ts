
import { prisma } from "@/lib/prisma";

/**
 * Безопасный лог входящего webhook Kaspi (ApiLog). Не передавать ключи и Authorization.
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
    // не ломаем webhook при сбое логирования
  }
}
