/**
 * Публичная (без секретов) конфигурация SMTP из env.
 * SMTP_PASSWORD никогда не экспортируется наружу API/UI.
 */

const DEFAULT_SUPPORT_EMAIL = "support@qazcardai.kz";
const DEFAULT_FROM_EMAIL = "noreply@qazcardai.kz";
const DEFAULT_FROM_NAME = "QazCard AI";

function envTrim(name: string): string {
  return process.env[name]?.trim() ?? "";
}

export function parseSmtpSecure(port: number): boolean {
  const raw = envTrim("SMTP_SECURE").toLowerCase();
  if (raw === "true" || raw === "1" || raw === "yes") return true;
  if (raw === "false" || raw === "0" || raw === "no") return false;
  return port === 465;
}

export function getSmtpPort(): number {
  const parsed = parseInt(envTrim("SMTP_PORT") || "587", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 587;
}

export function isSmtpPasswordConfigured(): boolean {
  return Boolean(envTrim("SMTP_PASSWORD"));
}

export function isSmtpEnvConfigured(): boolean {
  return Boolean(
    envTrim("SMTP_HOST") && envTrim("SMTP_USER") && isSmtpPasswordConfigured(),
  );
}

export function getSmtpFromEmail(): string {
  return envTrim("SMTP_FROM_EMAIL") || envTrim("SMTP_USER") || DEFAULT_FROM_EMAIL;
}

export function getSmtpFromName(): string {
  return envTrim("SMTP_FROM_NAME") || DEFAULT_FROM_NAME;
}

/** RFC5322 From для nodemailer / API провайдеров. */
export function buildSmtpFromHeader(): string {
  const legacy = envTrim("SMTP_FROM");
  if (legacy) return legacy;

  const email = getSmtpFromEmail();
  const name = getSmtpFromName();
  if (name && email) return `${name} <${email}>`;
  return email;
}

export function getSupportEmailFromEnv(): string {
  return envTrim("SUPPORT_EMAIL") || DEFAULT_SUPPORT_EMAIL;
}

/** Без секретов — для admin API / UI. */
export function getSmtpPublicEnvStatus() {
  const port = getSmtpPort();
  return {
    smtpConfigured: isSmtpEnvConfigured(),
    smtpHost: envTrim("SMTP_HOST") || null,
    smtpPort: envTrim("SMTP_HOST") ? port : null,
    smtpSecure: envTrim("SMTP_HOST") ? parseSmtpSecure(port) : null,
    smtpUser: envTrim("SMTP_USER") || null,
    smtpFromEmail: getSmtpFromEmail(),
    smtpFromName: getSmtpFromName(),
    smtpPasswordConfigured: isSmtpPasswordConfigured(),
    supportEmail: getSupportEmailFromEnv(),
  };
}

export function getSmtpTransportOptions() {
  const host = envTrim("SMTP_HOST");
  const port = getSmtpPort();
  const user = envTrim("SMTP_USER");
  const pass = process.env.SMTP_PASSWORD ?? "";
  return {
    host,
    port,
    secure: parseSmtpSecure(port),
    auth: { user, pass },
  };
}
