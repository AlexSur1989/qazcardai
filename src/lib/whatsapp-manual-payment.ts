/** WhatsApp wa.me для ручного пополнения (без автоначисления). */

export const DEFAULT_WHATSAPP_MESSAGE_TEMPLATE =
  "Здравствуйте! Я оплатил пополнение QazCard AI.\n\nКод заявки: {{paymentCode}}\nПакет: {{packageLabel}}\nСумма: {{amountKzt}} ₸\nТокены: {{creditsAmount}}\nАккаунт: {{userEmail}}\n\nПрикрепляю чек.";

export type WhatsAppMessageVars = {
  paymentCode: string;
  packageLabel: string;
  amountKzt: number;
  creditsAmount: number;
  userEmail: string;
  /** Telegram @username без @ или null — см. formatUserTelegramForWhatsApp */
  userTelegram?: string | null;
};

/** @username для шаблона; без username — fallback на userEmail (не оставляем literal). */
export function formatUserTelegramForWhatsApp(
  username: string | null | undefined,
  fallbackEmail: string,
): string {
  const raw = username?.trim().replace(/^@/, "");
  if (raw) return `@${raw}`;
  return fallbackEmail.trim();
}

/** Только цифры, без + пробелов скобок. */
export function normalizeWhatsAppPhone(raw: string): string {
  return raw.replace(/\D/g, "");
}

/** Readable KZ format: 77001234567 → +7 700 123 45 67 */
export function formatKazakhstanPhoneForDisplay(raw: string): string {
  const d = normalizeWhatsAppPhone(raw);
  if (!d) return raw.trim();
  if (d.length === 11 && d.startsWith("7")) {
    return `+7 ${d.slice(1, 4)} ${d.slice(4, 7)} ${d.slice(7, 9)} ${d.slice(9, 11)}`;
  }
  if (d.length >= 10) {
    return `+${d}`;
  }
  return d ? `+${d}` : raw.trim();
}

/** @deprecated alias — используйте formatKazakhstanPhoneForDisplay */
export function formatWhatsAppPhoneDisplay(digits: string): string {
  return formatKazakhstanPhoneForDisplay(digits);
}

export function interpolateWhatsAppTemplate(
  template: string,
  vars: WhatsAppMessageVars,
): string {
  const amountStr = Number.isFinite(vars.amountKzt)
    ? String(Math.round(vars.amountKzt))
    : "0";
  const creditsStr = Number.isFinite(vars.creditsAmount)
    ? String(Math.round(vars.creditsAmount))
    : "0";
  const userTelegram = formatUserTelegramForWhatsApp(vars.userTelegram, vars.userEmail);
  return template
    .replaceAll("{{paymentCode}}", vars.paymentCode)
    .replaceAll("{{packageLabel}}", vars.packageLabel)
    .replaceAll("{{amountKzt}}", amountStr)
    .replaceAll("{{creditsAmount}}", creditsStr)
    .replaceAll("{{userEmail}}", vars.userEmail)
    .replaceAll("{{userTelegram}}", userTelegram);
}

export function buildWhatsAppTopUpUrl(
  whatsappPhoneDigits: string,
  message: string,
): string | null {
  const phone = normalizeWhatsAppPhone(whatsappPhoneDigits);
  if (!phone) return null;
  return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
}
