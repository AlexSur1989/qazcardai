/**
 * Конфигурация Kaspi Pay (сервер). Секреты не экспортируем; только флаги для UI.
 */
export const KASPI_PAYMENT_PROVIDER = "KASPI" as const;

/** Включена ли оплата Kaspi (боевой флаг или mock). */
export function isKaspiBillingEnabled(): boolean {
  const enabled = process.env.KASPI_PAY_ENABLED?.trim().toLowerCase() === "true";
  const mock = process.env.KASPI_PAY_MOCK?.trim().toLowerCase() === "true";
  return enabled || mock;
}

export function isKaspiMockMode(): boolean {
  return process.env.KASPI_PAY_MOCK?.trim().toLowerCase() === "true";
}

export function getKaspiProviderMode(): "mock" | "live" {
  const v = process.env.KASPI_PROVIDER?.trim().toLowerCase() ?? "mock";
  return v === "live" ? "live" : "mock";
}

export function getAppBaseUrl(): string {
  return (
    process.env.APP_URL?.trim() ||
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    "http://localhost:3000"
  ).replace(/\/$/, "");
}
