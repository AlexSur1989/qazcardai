
import type { Prisma } from "@/generated/prisma/client";
import { writeAdminAuditLog } from "@/lib/admin-audit";
import { prisma } from "@/lib/prisma";

export const EMAIL_TEMPLATE_KEYS = [
  "WELCOME_USER",
  "PAYMENT_SUCCESS",
  "GENERATION_COMPLETED",
  "GENERATION_FAILED",
  "LOW_BALANCE",
  "ADMIN_PROVIDER_ERROR",
  "ADMIN_WORKER_ERROR",
  "PASSWORD_RESET",
] as const;

export type EmailTemplateKey = (typeof EMAIL_TEMPLATE_KEYS)[number];

const VAR_LIST: Record<EmailTemplateKey, string[]> = {
  WELCOME_USER: [
    "appName",
    "userName",
    "userEmail",
    "dashboardUrl",
    "createdAt",
  ],
  PAYMENT_SUCCESS: [
    "appName",
    "userName",
    "userEmail",
    "packageName",
    "credits",
    "amount",
    "currency",
    "balanceCredits",
    "billingUrl",
    "createdAt",
  ],
  GENERATION_COMPLETED: [
    "appName",
    "userName",
    "userEmail",
    "generationId",
    "generationType",
    "modelName",
    "balanceCredits",
    "dashboardUrl",
    "createdAt",
  ],
  GENERATION_FAILED: [
    "appName",
    "userName",
    "userEmail",
    "generationId",
    "generationType",
    "modelName",
    "errorMessage",
    "dashboardUrl",
    "createdAt",
  ],
  LOW_BALANCE: [
    "appName",
    "userName",
    "userEmail",
    "balanceCredits",
    "dashboardUrl",
    "billingUrl",
    "createdAt",
  ],
  ADMIN_PROVIDER_ERROR: [
    "appName",
    "errorMessage",
    "createdAt",
  ],
  ADMIN_WORKER_ERROR: [
    "appName",
    "generationId",
    "errorMessage",
    "createdAt",
  ],
  PASSWORD_RESET: [
    "appName",
    "userName",
    "resetUrl",
    "expiresInMinutes",
  ],
};

const DEFAULTS: Record<
  EmailTemplateKey,
  { name: string; subject: string; bodyText: string; bodyHtml?: string }
> = {
  WELCOME_USER: {
    name: "РџСЂРёРІРµС‚СЃС‚РІРёРµ / Welcome",
    subject: "Р”РѕР±СЂРѕ РїРѕР¶Р°Р»РѕРІР°С‚СЊ РІ QazCard AI",
    bodyText:
      "Р—РґСЂР°РІСЃС‚РІСѓР№С‚Рµ, {{userName}}!\n\n" +
      "РЎРїР°СЃРёР±Рѕ Р·Р° СЂРµРіРёСЃС‚СЂР°С†РёСЋ РІ {{appName}}. Р’Р°С€ email: {{userEmail}}.\n\n" +
      "РџРµСЂРµР№РґРёС‚Рµ РІ РєР°Р±РёРЅРµС‚: {{dashboardUrl}}\n\n" +
      "вЂ” РљРѕРјР°РЅРґР° {{appName}}",
  },
  PAYMENT_SUCCESS: {
    name: "РЈСЃРїРµС€РЅР°СЏ РѕРїР»Р°С‚Р° / Payment success",
    subject: "РџР°РєРµС‚ С‚РѕРєРµРЅРѕРІ СѓСЃРїРµС€РЅРѕ Р°РєС‚РёРІРёСЂРѕРІР°РЅ",
    bodyText:
      "{{userName}}, РїР°РєРµС‚ В«{{packageName}}В» Р°РєС‚РёРІРёСЂРѕРІР°РЅ.\n" +
      "РќР°С‡РёСЃР»РµРЅРѕ С‚РѕРєРµРЅРѕРІ: {{credits}}. РЎСѓРјРјР°: {{amount}} {{currency}}.\n" +
      "РўРµРєСѓС‰РёР№ Р±Р°Р»Р°РЅСЃ: {{balanceCredits}}.\n\n" +
      "РСЃС‚РѕСЂРёСЏ: {{billingUrl}}\n\n" +
      "вЂ” {{appName}}",
  },
  GENERATION_COMPLETED: {
    name: "Р“РµРЅРµСЂР°С†РёСЏ РіРѕС‚РѕРІР° / Generation completed",
    subject: "Р“РµРЅРµСЂР°С†РёСЏ Р·Р°РІРµСЂС€РµРЅР°",
    bodyText:
      "Р—РґСЂР°РІСЃС‚РІСѓР№С‚Рµ, {{userName}}!\n\n" +
      "Р“РµРЅРµСЂР°С†РёСЏ ({{generationType}}) РЅР° РјРѕРґРµР»Рё В«{{modelName}}В» Р·Р°РІРµСЂС€РµРЅР°.\n" +
      "ID: {{generationId}}\n" +
      "Р‘Р°Р»Р°РЅСЃ: {{balanceCredits}} С‚РѕРєРµРЅРѕРІ.\n\n" +
      "РћС‚РєСЂС‹С‚СЊ: {{dashboardUrl}}\n",
  },
  GENERATION_FAILED: {
    name: "РћС€РёР±РєР° РіРµРЅРµСЂР°С†РёРё / Generation failed",
    subject: "Р“РµРЅРµСЂР°С†РёСЏ Р·Р°РІРµСЂС€РёР»Р°СЃСЊ СЃ РѕС€РёР±РєРѕР№",
    bodyText:
      "{{userName}}, Рє СЃРѕР¶Р°Р»РµРЅРёСЋ, РіРµРЅРµСЂР°С†РёСЏ ({{generationType}}) РЅРµ СѓРґР°Р»Р°СЃСЊ.\n" +
      "ID: {{generationId}}\n" +
      "РњРѕРґРµР»СЊ: {{modelName}}\n" +
      "РЎРѕРѕР±С‰РµРЅРёРµ: {{errorMessage}}\n\n" +
      "РљР°Р±РёРЅРµС‚: {{dashboardUrl}}\n",
  },
  LOW_BALANCE: {
    name: "РќРёР·РєРёР№ Р±Р°Р»Р°РЅСЃ / Low balance",
    subject: "РЈ РІР°СЃ Р·Р°РєР°РЅС‡РёРІР°СЋС‚СЃСЏ С‚РѕРєРµРЅС‹",
    bodyText:
      "{{userName}}, Р±Р°Р»Р°РЅСЃ: {{balanceCredits}} С‚РѕРєРµРЅРѕРІ вЂ” СЂРµРєРѕРјРµРЅРґСѓРµРј РїРѕРїРѕР»РЅРёС‚СЊ.\n" +
      "РљР°Р±РёРЅРµС‚: {{dashboardUrl}} В· РћРїР»Р°С‚Р°: {{billingUrl}}\n",
  },
  ADMIN_PROVIDER_ERROR: {
    name: "РђРґРјРёРЅ: РѕС€РёР±РєР° РїСЂРѕРІР°Р№РґРµСЂР° / Admin provider error",
    subject: "РћС€РёР±РєР° РїСЂРѕРІР°Р№РґРµСЂР° Kie.ai",
    bodyText:
      "РџСЂРѕРІРµСЂРєР° РїСЂРѕРІР°Р№РґРµСЂР° Р·Р°РІРµСЂС€РёР»Р°СЃСЊ СЃ РѕС€РёР±РєРѕР№.\n" +
      "{{errorMessage}}\n" +
      "Р’СЂРµРјСЏ: {{createdAt}} В· {{appName}}",
  },
  ADMIN_WORKER_ERROR: {
    name: "РђРґРјРёРЅ: РѕС€РёР±РєР° worker / Admin worker error",
    subject: "РћС€РёР±РєР° worker/РѕС‡РµСЂРµРґРё РіРµРЅРµСЂР°С†РёР№",
    bodyText:
      "РћС‡РµСЂРµРґСЊ РіРµРЅРµСЂР°С†РёР№: job РёСЃС‡РµСЂРїР°Р» СЂРµС‚СЂР°Рё.\n" +
      "Generation ID: {{generationId}}\n" +
      "{{errorMessage}}\n" +
      "Р’СЂРµРјСЏ: {{createdAt}}",
  },
  PASSWORD_RESET: {
    name: "Password reset / Р’РѕСЃСЃС‚Р°РЅРѕРІР»РµРЅРёРµ РїР°СЂРѕР»СЏ",
    subject: "Р’РѕСЃСЃС‚Р°РЅРѕРІР»РµРЅРёРµ РїР°СЂРѕР»СЏ QazCard AI",
    bodyText:
      "Р—РґСЂР°РІСЃС‚РІСѓР№С‚Рµ!\n\n" +
      "РњС‹ РїРѕР»СѓС‡РёР»Рё Р·Р°РїСЂРѕСЃ РЅР° РІРѕСЃСЃС‚Р°РЅРѕРІР»РµРЅРёРµ РїР°СЂРѕР»СЏ РґР»СЏ Р°РєРєР°СѓРЅС‚Р° QazCard AI.\n\n" +
      "РџРµСЂРµР№РґРёС‚Рµ РїРѕ СЃСЃС‹Р»РєРµ, С‡С‚РѕР±С‹ Р·Р°РґР°С‚СЊ РЅРѕРІС‹Р№ РїР°СЂРѕР»СЊ:\n" +
      "{{resetUrl}}\n\n" +
      "РЎСЃС‹Р»РєР° РґРµР№СЃС‚РІСѓРµС‚ {{expiresInMinutes}} РјРёРЅСѓС‚.\n\n" +
      "Р•СЃР»Рё РІС‹ РЅРµ Р·Р°РїСЂР°С€РёРІР°Р»Рё РІРѕСЃСЃС‚Р°РЅРѕРІР»РµРЅРёРµ РїР°СЂРѕР»СЏ, РїСЂРѕСЃС‚Рѕ РїСЂРѕРёРіРЅРѕСЂРёСЂСѓР№С‚Рµ СЌС‚Рѕ РїРёСЃСЊРјРѕ.\n",
  },
};

const TEMPLATE_KEY_SET = new Set<string>(EMAIL_TEMPLATE_KEYS);

function isKey(k: string): k is EmailTemplateKey {
  return TEMPLATE_KEY_SET.has(k);
}

export function isEmailTemplateKey(k: string): k is EmailTemplateKey {
  return isKey(k);
}

const VAR_RE = /\{\{(\w+)\}\}/g;

/**
 * РџРѕРґСЃС‚Р°РІР»СЏРµС‚ `{{name}}` РёР· СЃР»РѕРІР°СЂСЏ; РЅРµРёР·РІРµСЃС‚РЅС‹Рµ вЂ” РїСѓСЃС‚Р°СЏ СЃС‚СЂРѕРєР°. Р‘РµР· eval.
 */
export function renderEmailTemplateString(
  template: string,
  variables: Record<string, string | number | undefined | null>,
): string {
  return template.replace(
    VAR_RE,
    (_m, name: string) => {
      if (!name) return "";
      const v = variables[name];
      if (v == null) return "";
      return String(v);
    },
  );
}

export type RenderEmailTemplateResult = {
  subject: string;
  bodyText: string;
  bodyHtml: string;
};

/**
 * Р’РѕР·РІСЂР°С‰Р°РµС‚ РѕС‚СЂРµРЅРґРµСЂРµРЅРЅС‹Рµ РїРѕР»СЏ; РµСЃР»Рё bodyHtml РїСѓСЃС‚, РґСѓР±Р»РёСЂСѓРµС‚ text c СЌРєСЂР°РЅРёСЂРѕРІР°РЅРёРµРј.
 */
export async function renderEmailTemplate(args: {
  key: EmailTemplateKey;
  variables: Record<string, string | number | undefined | null>;
}): Promise<RenderEmailTemplateResult | null> {
  const row = await prisma.emailTemplate.findUnique({
    where: { key: args.key },
  });
  if (!row || !row.isActive) {
    return null;
  }
  const subject = renderEmailTemplateString(row.subject, args.variables);
  const bodyText = row.bodyText
    ? renderEmailTemplateString(row.bodyText, args.variables)
    : "";
  const bodyHtmlRaw = row.bodyHtml?.trim();
  const bodyHtml = bodyHtmlRaw
    ? renderEmailTemplateString(bodyHtmlRaw, args.variables)
    : bodyText
        .split("\n")
        .map((l) => `<p>${l.replace(/&/g, "&amp;").replace(/</g, "&lt;")}</p>`)
        .join("");
  return { subject, bodyText, bodyHtml };
}

export async function ensureDefaultEmailTemplates(): Promise<{ upserted: number }> {
  let upserted = 0;
  for (const key of EMAIL_TEMPLATE_KEYS) {
    const d = DEFAULTS[key];
    const existing = await prisma.emailTemplate.findUnique({ where: { key } });
    if (existing) continue;
    await prisma.emailTemplate.create({
      data: {
        key,
        name: d.name,
        subject: d.subject,
        bodyText: d.bodyText,
        bodyHtml: null,
        isActive: true,
        variables: VAR_LIST[key] as Prisma.InputJsonValue,
        version: 1,
      },
    });
    upserted += 1;
  }
  return { upserted };
}

export async function getEmailTemplates() {
  return prisma.emailTemplate.findMany({
    orderBy: { key: "asc" },
  });
}

export async function getEmailTemplate(key: string) {
  if (!isKey(key)) {
    return null;
  }
  return prisma.emailTemplate.findUnique({ where: { key } });
}

export async function updateEmailTemplate(input: {
  key: string;
  subject: string;
  bodyText: string | null;
  bodyHtml: string | null;
  isActive: boolean;
  adminUserId: string;
}): Promise<
  { ok: true; template: Awaited<ReturnType<typeof prisma.emailTemplate.findUnique>> } | { ok: false; error: string }
> {
  if (!isKey(input.key)) {
    return { ok: false, error: "unknown_key" };
  }
  const existing = await prisma.emailTemplate.findUnique({
    where: { key: input.key },
  });
  if (!existing) {
    return { ok: false, error: "not_seeded" };
  }
  const name = existing.name;
  const oldSnap = {
    subject: existing.subject,
    bodyText: existing.bodyText,
    bodyHtml: existing.bodyHtml,
    isActive: existing.isActive,
    version: existing.version,
  };
  const next = await prisma.emailTemplate.update({
    where: { key: input.key },
    data: {
      subject: input.subject.slice(0, 500),
      bodyText: input.bodyText,
      bodyHtml: input.bodyHtml,
      isActive: input.isActive,
      version: { increment: 1 },
      updatedBy: input.adminUserId,
    },
  });
  await writeAdminAuditLog({
    adminUserId: input.adminUserId,
    action: "EMAIL_TEMPLATE_UPDATED",
    targetType: "EmailTemplate",
    targetId: input.key,
    oldValue: oldSnap,
    newValue: {
      subject: next.subject,
      bodyText: next.bodyText,
      bodyHtml: next.bodyHtml,
      isActive: next.isActive,
      version: next.version,
    },
    metadata: { key: input.key, name },
  });
  return { ok: true, template: next };
}
