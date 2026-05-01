import "server-only";

import nodemailer from "nodemailer";

import { prisma } from "@/lib/prisma";
import { getAppName } from "@/lib/app-name";
import { getAppBaseUrl } from "@/lib/app-base-url";
import { getAppSetting } from "@/server/services/appSettings";
import {
  renderEmailTemplate,
  type EmailTemplateKey,
} from "@/server/services/emailTemplates";

export type SendEmailResult =
  | { status: "sent" }
  | { status: "skipped"; reason: string }
  | { status: "error"; message: string };

const ALLOWED_PROVIDERS = new Set(["none", "smtp", "resend", "sendgrid"]);

function fromHeader(): string {
  const smtp = process.env.SMTP_FROM?.trim();
  if (smtp) return smtp;
  return "";
}

async function fromAppSettingOrEnv(): Promise<string> {
  const f = fromHeader();
  if (f) return f;
  const v = await getAppSetting("EMAIL_FROM");
  return typeof v === "string" && v.trim() ? v.trim() : "QazCard AI <noreply@qazcard.ai>";
}

export function getSmtpEnvConfigured(): boolean {
  return Boolean(
    process.env.SMTP_HOST?.trim() &&
      process.env.SMTP_USER?.trim() &&
      process.env.SMTP_PASSWORD?.trim(),
  );
}

export function getResendEnvConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY?.trim());
}

export function getSendgridEnvConfigured(): boolean {
  return Boolean(process.env.SENDGRID_API_KEY?.trim());
}

/**
 * Статусы env без секретов.
 */
export async function getEmailProviderEnvStatus() {
  const [providerRaw, enabledRaw] = await Promise.all([
    getAppSetting("EMAIL_PROVIDER"),
    getAppSetting("EMAIL_ENABLED"),
  ]);
  const providerStr =
    typeof providerRaw === "string" && providerRaw.trim()
      ? providerRaw.trim().toLowerCase()
      : "none";
  const emailEnabled = enabledRaw === true;
  return {
    smtpConfigured: getSmtpEnvConfigured(),
    resendApiConfigured: getResendEnvConfigured(),
    sendgridApiConfigured: getSendgridEnvConfigured(),
    apiKeyConfigured: getResendEnvConfigured() || getSendgridEnvConfigured(),
    emailEnabled,
    emailProvider: ALLOWED_PROVIDERS.has(providerStr) ? providerStr : "none",
  };
}

export async function sendEmail(args: {
  to: string;
  subject: string;
  text: string;
  html?: string;
}): Promise<SendEmailResult> {
  const [enabledRaw, providerRaw] = await Promise.all([
    getAppSetting("EMAIL_ENABLED"),
    getAppSetting("EMAIL_PROVIDER"),
  ]);
  if (enabledRaw !== true) {
    return { status: "skipped", reason: "email_disabled" };
  }
  const p =
    typeof providerRaw === "string" && providerRaw.trim()
      ? providerRaw.trim().toLowerCase()
      : "none";
  if (p === "none" || !ALLOWED_PROVIDERS.has(p)) {
    return { status: "skipped", reason: "provider_none" };
  }
  if (p === "smtp") {
    if (!getSmtpEnvConfigured()) {
      return { status: "skipped", reason: "smtp_not_configured" };
    }
    return sendViaSmtp({ ...args, from: await fromAppSettingOrEnv() });
  }
  if (p === "resend") {
    if (!getResendEnvConfigured()) {
      return { status: "skipped", reason: "resend_not_configured" };
    }
    return sendViaResend({ ...args, from: await fromAppSettingOrEnv() });
  }
  if (p === "sendgrid") {
    if (!getSendgridEnvConfigured()) {
      return { status: "skipped", reason: "sendgrid_not_configured" };
    }
    return sendViaSendgrid({ ...args, from: await fromAppSettingOrEnv() });
  }
  return { status: "skipped", reason: "unknown_provider" };
}

async function sendViaSmtp(args: {
  to: string;
  from: string;
  subject: string;
  text: string;
  html?: string;
}): Promise<SendEmailResult> {
  const host = process.env.SMTP_HOST!.trim();
  const port = Math.max(1, parseInt(process.env.SMTP_PORT?.trim() || "587", 10) || 587);
  const user = process.env.SMTP_USER!.trim();
  const pass = process.env.SMTP_PASSWORD!;
  try {
    const transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: { user, pass },
    });
    await transporter.sendMail({
      from: args.from,
      to: args.to,
      subject: args.subject,
      text: args.text,
      html: args.html,
    });
    return { status: "sent" };
  } catch (e) {
    const message = e instanceof Error ? e.message : "smtp_error";
    console.error("[emailService] smtp", message);
    return { status: "error", message: "send_failed" };
  }
}

async function sendViaResend(args: {
  to: string;
  from: string;
  subject: string;
  text: string;
  html?: string;
}): Promise<SendEmailResult> {
  const key = process.env.RESEND_API_KEY!.trim();
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: args.from,
        to: [args.to],
        subject: args.subject,
        text: args.text,
        html: args.html,
      }),
    });
    if (!res.ok) {
      console.error("[emailService] resend http", res.status);
      return { status: "error", message: "resend_http" };
    }
    return { status: "sent" };
  } catch (e) {
    console.error("[emailService] resend", e);
    return { status: "error", message: "resend_error" };
  }
}

async function sendViaSendgrid(args: {
  to: string;
  from: string;
  subject: string;
  text: string;
  html?: string;
}): Promise<SendEmailResult> {
  const key = process.env.SENDGRID_API_KEY!.trim();
  const fromMatch = args.from.match(/^(?:"?([^"]*)"?\s+)?<([^>]+)>$/);
  const fromEmail = fromMatch ? fromMatch[2].trim() : args.from.trim();
  const fromName = fromMatch?.[1]?.trim() || "QazCard AI";
  const body: Record<string, unknown> = {
    personalizations: [
      { to: [{ email: args.to }], subject: args.subject },
    ],
    from: { email: fromEmail, name: fromName },
    content: [
      { type: "text/plain", value: args.text },
    ],
  };
  if (args.html) {
    (body.content as { type: string; value: string }[]).push({
      type: "text/html",
      value: args.html,
    });
  }
  try {
    const res = await fetch("https://api.sendgrid.com/v3/mail/send", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
    if (res.status !== 200 && res.status !== 202) {
      console.error("[emailService] sendgrid http", res.status);
      return { status: "error", message: "sendgrid_http" };
    }
    return { status: "sent" };
  } catch (e) {
    console.error("[emailService] sendgrid", e);
    return { status: "error", message: "sendgrid_error" };
  }
}

/**
 * value приводит к подстановке; timestamp — дружелюбная строка.
 */
function normVars(
  v: Record<string, string | number | undefined | null | Date>,
): Record<string, string | number | undefined | null> {
  const o: Record<string, string | number | undefined | null> = {};
  for (const [k, val] of Object.entries(v)) {
    if (val instanceof Date) {
      o[k] = val.toISOString();
    } else {
      o[k] = val;
    }
  }
  return o;
}

export async function sendTemplateEmail(args: {
  to: string;
  templateKey: EmailTemplateKey;
  variables: Record<string, string | number | undefined | null | Date>;
}): Promise<SendEmailResult> {
  const rendered = await renderEmailTemplate({
    key: args.templateKey,
    variables: normVars(args.variables),
  });
  if (!rendered) {
    return { status: "skipped", reason: "template_inactive" };
  }
  return sendEmail({
    to: args.to,
    subject: rendered.subject,
    text: rendered.bodyText,
    html: rendered.bodyHtml,
  });
}

const LOW_BALANCE_THROTTLE_HOURS = 72;

const ADMIN_THROTTLE_MS = 60 * 60 * 1000; // 1h between same admin channel

export async function canSendUserLowBalanceAgain(userId: string): Promise<boolean> {
  const u = await prisma.user.findUnique({
    where: { id: userId },
    select: { lastLowBalanceEmailAt: true },
  });
  if (!u?.lastLowBalanceEmailAt) return true;
  const diff = Date.now() - u.lastLowBalanceEmailAt.getTime();
  return diff > LOW_BALANCE_THROTTLE_HOURS * 60 * 60 * 1000;
}

export async function markUserLowBalanceEmailSent(userId: string) {
  await prisma.user.update({
    where: { id: userId },
    data: { lastLowBalanceEmailAt: new Date() },
  });
}

function adminThrottleId(kind: "provider" | "worker") {
  return `admin_${kind}` as const;
}

export async function canSendAdminAlert(kind: "provider" | "worker"): Promise<boolean> {
  const id = adminThrottleId(kind);
  const row = await prisma.adminEmailThrottle.findUnique({ where: { id } });
  if (!row) return true;
  return Date.now() - row.lastSentAt.getTime() > ADMIN_THROTTLE_MS;
}

export async function markAdminAlertSent(kind: "provider" | "worker") {
  const id = adminThrottleId(kind);
  const now = new Date();
  await prisma.adminEmailThrottle.upsert({
    where: { id },
    create: { id, lastSentAt: now },
    update: { lastSentAt: now },
  });
}

/**
 * Вспомогательные URL для писем.
 */
export function getEmailFlowUrls() {
  const base = getAppBaseUrl();
  return {
    dashboardUrl: `${base}/dashboard`,
    billingUrl: `${base}/dashboard/billing`,
    appName: (() => {
      try {
        return getAppName();
      } catch {
        return "QazCard AI";
      }
    })(),
  };
}
