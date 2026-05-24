/** WhatsApp wa.me для ручного пополнения (без автоначисления). */

export const DEFAULT_WHATSAPP_MESSAGE_TEMPLATE =
  "Здравствуйте! Я оплатил пополнение QazCard AI.\n\nКод заявки: {{paymentCode}}\nПакет: {{packageLabel}}\nСумма: {{amountKzt}} ₸\nТокены: {{creditsAmount}}\nАккаунт: {{userEmail}}\n\nПрикрепляю чек.";

export type WhatsAppMessageVars = {
  paymentCode: string;
  packageLabel: string;
  amountKzt: number;
  creditsAmount: number;
  userEmail: string;
};

/** Только цифры, без + пробелов скобок. */
export function normalizeWhatsAppPhone(raw: string): string {
  return raw.replace(/\D/g, "");
}

/** Красивый формат для KZ: +7 700 123 45 67 */
export function formatWhatsAppPhoneDisplay(digits: string): string {
  const d = normalizeWhatsAppPhone(digits);
  if (d.length === 11 && d.startsWith("7")) {
    return `+7 ${d.slice(1, 4)} ${d.slice(4, 7)} ${d.slice(7, 9)} ${d.slice(9, 11)}`;
  }
  if (d.length >= 10) {
    return `+${d}`;
  }
  return d ? `+${d}` : "";
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
  return template
    .replaceAll("{{paymentCode}}", vars.paymentCode)
    .replaceAll("{{packageLabel}}", vars.packageLabel)
    .replaceAll("{{amountKzt}}", amountStr)
    .replaceAll("{{creditsAmount}}", creditsStr)
    .replaceAll("{{userEmail}}", vars.userEmail);
}

export function buildWhatsAppTopUpUrl(
  whatsappPhoneDigits: string,
  message: string,
): string | null {
  const phone = normalizeWhatsAppPhone(whatsappPhoneDigits);
  if (!phone) return null;
  return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
}
