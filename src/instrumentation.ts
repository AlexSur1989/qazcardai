import { shouldSkipEnvValidationInThisProcess } from "@/lib/env";

/**
 * Старт Node.js: проверяем критичные env до обработки запросов.
 * Не логируем значения секретов.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "edge") {
    return;
  }
  if (shouldSkipEnvValidationInThisProcess()) {
    return;
  }
  const { assertRequiredEnvOrThrow } = await import("@/lib/env");
  assertRequiredEnvOrThrow();
}
