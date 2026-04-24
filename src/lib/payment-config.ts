import "server-only";

/**
 * Публичный URL приложения для redirect после Stripe (без хардкода домена).
 */
export function getAppBaseUrl(): string {
  const u =
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    process.env.AUTH_URL?.trim() ||
    process.env.APP_URL?.trim() ||
    "http://localhost:3000";
  return u.replace(/\/$/, "");
}

export function isStripeSecretConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY?.trim());
}

export function isStripeWebhookSecretConfigured(): boolean {
  return Boolean(process.env.STRIPE_WEBHOOK_SECRET?.trim());
}
