import "server-only";

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
    name: "Приветствие / Welcome",
    subject: "Добро пожаловать в QazCard AI",
    bodyText:
      "Здравствуйте, {{userName}}!\n\n" +
      "Спасибо за регистрацию в {{appName}}. Ваш email: {{userEmail}}.\n\n" +
      "Перейдите в кабинет: {{dashboardUrl}}\n\n" +
      "— Команда {{appName}}",
  },
  PAYMENT_SUCCESS: {
    name: "Успешная оплата / Payment success",
    subject: "Пакет токенов успешно активирован",
    bodyText:
      "{{userName}}, пакет «{{packageName}}» активирован.\n" +
      "Начислено токенов: {{credits}}. Сумма: {{amount}} {{currency}}.\n" +
      "Текущий баланс: {{balanceCredits}}.\n\n" +
      "История: {{billingUrl}}\n\n" +
      "— {{appName}}",
  },
  GENERATION_COMPLETED: {
    name: "Генерация готова / Generation completed",
    subject: "Генерация завершена",
    bodyText:
      "Здравствуйте, {{userName}}!\n\n" +
      "Генерация ({{generationType}}) на модели «{{modelName}}» завершена.\n" +
      "ID: {{generationId}}\n" +
      "Баланс: {{balanceCredits}} токенов.\n\n" +
      "Открыть: {{dashboardUrl}}\n",
  },
  GENERATION_FAILED: {
    name: "Ошибка генерации / Generation failed",
    subject: "Генерация завершилась с ошибкой",
    bodyText:
      "{{userName}}, к сожалению, генерация ({{generationType}}) не удалась.\n" +
      "ID: {{generationId}}\n" +
      "Модель: {{modelName}}\n" +
      "Сообщение: {{errorMessage}}\n\n" +
      "Кабинет: {{dashboardUrl}}\n",
  },
  LOW_BALANCE: {
    name: "Низкий баланс / Low balance",
    subject: "У вас заканчиваются токены",
    bodyText:
      "{{userName}}, баланс: {{balanceCredits}} токенов — рекомендуем пополнить.\n" +
      "Кабинет: {{dashboardUrl}} · Оплата: {{billingUrl}}\n",
  },
  ADMIN_PROVIDER_ERROR: {
    name: "Админ: ошибка провайдера / Admin provider error",
    subject: "Ошибка провайдера Kie.ai",
    bodyText:
      "Проверка провайдера завершилась с ошибкой.\n" +
      "{{errorMessage}}\n" +
      "Время: {{createdAt}} · {{appName}}",
  },
  ADMIN_WORKER_ERROR: {
    name: "Админ: ошибка worker / Admin worker error",
    subject: "Ошибка worker/очереди генераций",
    bodyText:
      "Очередь генераций: job исчерпал ретраи.\n" +
      "Generation ID: {{generationId}}\n" +
      "{{errorMessage}}\n" +
      "Время: {{createdAt}}",
  },
  PASSWORD_RESET: {
    name: "Password reset / Восстановление пароля",
    subject: "Восстановление пароля QazCard AI",
    bodyText:
      "Здравствуйте!\n\n" +
      "Мы получили запрос на восстановление пароля для аккаунта QazCard AI.\n\n" +
      "Перейдите по ссылке, чтобы задать новый пароль:\n" +
      "{{resetUrl}}\n\n" +
      "Ссылка действует {{expiresInMinutes}} минут.\n\n" +
      "Если вы не запрашивали восстановление пароля, просто проигнорируйте это письмо.\n",
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
 * Подставляет `{{name}}` из словаря; неизвестные — пустая строка. Без eval.
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
 * Возвращает отрендеренные поля; если bodyHtml пуст, дублирует text c экранированием.
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
