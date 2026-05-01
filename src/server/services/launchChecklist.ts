import "server-only";

import IORedis from "ioredis";
import { Queue } from "bullmq";

import { LEGAL_PAGE_SLUGS, LEGAL_PAGE_STATUS } from "@/lib/legal-page-config";
import { validateAdminPricingSchema } from "@/lib/admin-pricing-validation";
import { hasAuthSecret } from "@/lib/env";
import {
  isUploadStorageLocalExplicitInProduction,
  isLocalUploadStorageEffective,
} from "@/lib/upload-storage-mode";
import { prisma } from "@/lib/prisma";
import { isStorageConfigured } from "@/server/services/storage";
import { getStorageConfigStatus } from "@/server/services/storageMonitor";
import { getEmailProviderEnvStatus } from "@/server/services/emailService";
import { getAppSetting } from "@/server/services/appSettings";
import { getRateUploadSettings } from "@/lib/rate-upload-settings";
import { GENERATION_QUEUE_NAME } from "@/server/queues/generationQueue";
import { SEEDANCE_API_MODEL_ID, SEEDANCE_FAST_API_MODEL_ID } from "@/server/services/seedance-settings";
import { generateRobotsTxt, generateSitemapXml } from "@/server/services/seoSettings";
import type {
  LaunchChecklistItem,
  LaunchCheckSeverity,
} from "@/lib/launch-checklist-types";

export type { LaunchChecklistItem, LaunchCheckSeverity } from "@/lib/launch-checklist-types";

function item(
  id: string,
  labelEn: string,
  labelRu: string,
  severity: LaunchCheckSeverity,
  detail?: string | null,
  fixHref?: string | null,
): LaunchChecklistItem {
  return {
    id,
    labelEn,
    labelRu,
    severity,
    detail: detail ?? null,
    fixHref: fixHref ?? null,
  };
}

function envTrim(name: string): string {
  return process.env[name]?.trim() ?? "";
}

function isQueueInline(): boolean {
  return process.env.QUEUE_MODE?.trim().toLowerCase() === "inline";
}

function isMockKieEnabled(): boolean {
  return process.env.MOCK_KIE?.trim().toLowerCase() === "true";
}

async function checkDbConnectivity(): Promise<boolean> {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return true;
  } catch {
    return false;
  }
}

async function checkRedisPing(): Promise<"ok" | "missing" | "error"> {
  const url = process.env.REDIS_URL?.trim();
  if (!url) return "missing";
  const c = new IORedis(url, {
    connectTimeout: 2_000,
    maxRetriesPerRequest: 1,
    enableOfflineQueue: false,
  });
  try {
    const pong = await c.ping();
    return pong === "PONG" ? "ok" : "error";
  } catch {
    return "error";
  } finally {
    c.disconnect();
  }
}

async function healthAlignedSummary(): Promise<{
  status: "ok" | "degraded" | "error";
}> {
  const queueMode = isQueueInline() ? "inline" : "redis";
  let databaseOk = false;
  try {
    await prisma.$queryRaw`SELECT 1`;
    databaseOk = true;
  } catch {
    databaseOk = false;
  }
  if (!databaseOk) return { status: "error" };

  if (queueMode === "inline") return { status: "ok" };

  const redis = await checkRedisPing();
  if (redis === "ok") return { status: "ok" };
  return { status: "degraded" };
}

async function checkWorkersCount(): Promise<{
  severity: LaunchCheckSeverity;
  detail: string | null;
  fixHref: string | null;
}> {
  if (isQueueInline()) {
    return {
      severity: process.env.NODE_ENV === "production" ? "warning" : "ok",
      detail:
        process.env.NODE_ENV === "production"
          ? "QUEUE_MODE=inline не предназначен для production — нужен redis и отдельный worker."
          : null,
      fixHref: process.env.NODE_ENV === "production" ? "/admin/settings" : null,
    };
  }
  const url = process.env.REDIS_URL?.trim();
  if (!url) {
    return {
      severity: "required",
      detail: "Задайте REDIS_URL и процесс npm run worker.",
      fixHref: "/admin/settings",
    };
  }
  const connection = new IORedis(url, {
    maxRetriesPerRequest: null,
  });
  const queue = new Queue(GENERATION_QUEUE_NAME, { connection });
  try {
    const n = await queue.getWorkersCount();
    if (n < 1) {
      return {
        severity: "required",
        detail:
          "Нет зарегистрированных worker для очереди генераций. Запустите процесс worker.",
        fixHref: "/admin/settings",
      };
    }
    return { severity: "ok", detail: null, fixHref: null };
  } catch {
    return {
      severity: "warning",
      detail:
        "Не удалось определить число worker (на части Redis‑окружений команда недоступна). Проверьте worker вручную.",
      fixHref: "/admin/settings",
    };
  } finally {
    await queue.close();
    connection.disconnect();
  }
}

export async function buildLaunchChecklist(): Promise<{
  items: LaunchChecklistItem[];
  summary: { ok: number; warning: number; required: number };
}> {
  const items: LaunchChecklistItem[] = [];

  const dbUrlConfigured = Boolean(envTrim("DATABASE_URL"));
  const dbReachable = await checkDbConnectivity();
  if (!dbUrlConfigured) {
    items.push(
      item(
        "database_url",
        "DATABASE_URL configured",
        "База данных настроена",
        "required",
        "Переменная DATABASE_URL не задана.",
        "/admin/settings",
      ),
    );
  } else if (!dbReachable) {
    items.push(
      item(
        "database_url",
        "DATABASE_URL configured",
        "База данных настроена",
        "required",
        "Подключение к БД не удалось (проверьте строку и доступность сервера).",
        "/admin/settings",
      ),
    );
  } else {
    items.push(
      item(
        "database_url",
        "DATABASE_URL configured",
        "База данных настроена",
        "ok",
      ),
    );
  }

  items.push(
    hasAuthSecret()
      ? item(
          "auth_secret",
          "AUTH_SECRET configured",
          "Auth secret настроен",
          "ok",
        )
      : item(
          "auth_secret",
          "AUTH_SECRET configured",
          "Auth secret настроен",
          "required",
          "Задайте AUTH_SECRET или NEXTAUTH_SECRET.",
          "/admin/settings",
        ),
  );

  const superAdminCount = await prisma.user.count({
    where: { role: "SUPER_ADMIN", status: "ACTIVE" },
  });
  items.push(
    superAdminCount >= 1
      ? item(
          "super_admin",
          "SUPER_ADMIN exists",
          "Super admin создан",
          "ok",
        )
      : item(
          "super_admin",
          "SUPER_ADMIN exists",
          "Super admin создан",
          "required",
          "Нет активного пользователя с ролью SUPER_ADMIN.",
          "/admin/users",
        ),
  );

  items.push(
    envTrim("KIE_API_KEY")
      ? item(
          "kie_api_key",
          "KIE_API_KEY configured",
          "Kie API key настроен",
          "ok",
        )
      : item(
          "kie_api_key",
          "KIE_API_KEY configured",
          "Kie API key настроен",
          "required",
          "Задайте KIE_API_KEY.",
          "/admin/providers",
        ),
  );

  items.push(
    envTrim("KIE_BASE_URL")
      ? item(
          "kie_base_url",
          "KIE_BASE_URL configured",
          "Kie base URL настроен",
          "ok",
        )
      : item(
          "kie_base_url",
          "KIE_BASE_URL configured",
          "Kie base URL настроен",
          "required",
          "Задайте KIE_BASE_URL.",
          "/admin/providers",
        ),
  );

  if (process.env.NODE_ENV === "production" && isMockKieEnabled()) {
    items.push(
      item(
        "mock_kie_prod",
        "MOCK_KIE disabled in production",
        "MOCK_KIE выключен в production",
        "required",
        "В production MOCK_KIE должен быть false.",
        "/admin/providers",
      ),
    );
  } else {
    items.push(
      item(
        "mock_kie_prod",
        "MOCK_KIE disabled in production",
        "MOCK_KIE выключен в production",
        "ok",
      ),
    );
  }

  const storageStatus = getStorageConfigStatus();
  const isProd = process.env.NODE_ENV === "production";
  if (isUploadStorageLocalExplicitInProduction()) {
    items.push(
      item(
        "s3_storage",
        "S3 storage configured",
        "S3 хранилище настроено",
        "required",
        "UPLOAD_STORAGE=local недопустим в production.",
        "/admin/storage",
      ),
    );
  } else if (!isLocalUploadStorageEffective()) {
    const s3Ready =
      storageStatus.mode === "s3" &&
      storageStatus.s3EndpointConfigured &&
      storageStatus.s3BucketConfigured &&
      storageStatus.accessKeyConfigured &&
      storageStatus.secretKeyConfigured &&
      storageStatus.s3RegionConfigured;
    items.push(
      s3Ready
        ? item(
            "s3_storage",
            "S3 storage configured",
            "S3 хранилище настроено",
            "ok",
          )
        : item(
            "s3_storage",
            "S3 storage configured",
            "S3 хранилище настроено",
            "required",
            "Задайте S3_ENDPOINT, S3_REGION, S3_BUCKET, ключи и регион.",
            "/admin/storage",
          ),
    );
  } else {
    items.push(
      item(
        "s3_storage",
        "S3 storage configured",
        "S3 хранилище настроено",
        isProd ? "warning" : "ok",
        isProd
          ? "Используется локальное хранилище — для production нужен S3."
          : null,
        isProd ? "/admin/storage" : null,
      ),
    );
  }

  if (!isLocalUploadStorageEffective()) {
    items.push(
      storageStatus.s3PublicUrlConfigured
        ? item(
            "s3_public_url",
            "S3_PUBLIC_URL configured",
            "Публичный URL хранилища настроен",
            "ok",
          )
        : item(
            "s3_public_url",
            "S3_PUBLIC_URL configured",
            "Публичный URL хранилища настроен",
            "required",
            "Без S3_PUBLIC_URL провайдер может не получить URL загрузок.",
            "/admin/storage",
          ),
    );
  } else {
    items.push(
      item(
        "s3_public_url",
        "S3_PUBLIC_URL configured",
        "Публичный URL хранилища настроен",
        isProd ? "warning" : "ok",
        isProd
          ? "Для production задайте object storage и S3_PUBLIC_URL."
          : "При локальном хранилище S3_PUBLIC_URL не используется.",
        isProd ? "/admin/storage" : null,
      ),
    );
  }

  const redisPing = await checkRedisPing();
  if (isQueueInline()) {
    items.push(
      item(
        "redis",
        "Redis configured",
        "Redis настроен",
        "warning",
        "При QUEUE_MODE=inline Redis не обязателен для очереди.",
        "/admin/settings",
      ),
    );
  } else if (redisPing === "ok") {
    items.push(
      item(
        "redis",
        "Redis configured",
        "Redis настроен",
        "ok",
      ),
    );
  } else if (redisPing === "missing") {
    items.push(
      item(
        "redis",
        "Redis configured",
        "Redis настроен",
        "required",
        "Задайте REDIS_URL для BullMQ.",
        "/admin/settings",
      ),
    );
  } else {
    items.push(
      item(
        "redis",
        "Redis configured",
        "Redis настроен",
        "required",
        "REDIS_URL задан, но соединение не удалось.",
        "/admin/settings",
      ),
    );
  }

  if (isProd && isQueueInline()) {
    items.push(
      item(
        "queue_mode",
        "Queue mode production-ready",
        "Очередь готова к production",
        "required",
        "В production используйте QUEUE_MODE=redis (или не задавайте inline).",
        "/admin/settings",
      ),
    );
  } else if (!isQueueInline() && redisPing !== "ok") {
    items.push(
      item(
        "queue_mode",
        "Queue mode production-ready",
        "Очередь готова к production",
        "required",
        "Режим redis требует рабочий REDIS_URL.",
        "/admin/settings",
      ),
    );
  } else {
    items.push(
      item(
        "queue_mode",
        "Queue mode production-ready",
        "Очередь готова к production",
        "ok",
      ),
    );
  }

  const workerCheck = await checkWorkersCount();
  items.push(
    item(
      "worker",
      "Worker status checked",
      "Worker проверен",
      workerCheck.severity,
      workerCheck.detail,
      workerCheck.fixHref,
    ),
  );

  const imageActive = await prisma.aiModel.count({
    where: { isActive: true, type: "IMAGE" },
  });
  items.push(
    imageActive >= 1
      ? item(
          "image_model",
          "Active IMAGE model exists",
          "Есть активная IMAGE модель",
          "ok",
        )
      : item(
          "image_model",
          "Active IMAGE model exists",
          "Есть активная IMAGE модель",
          "required",
          "Создайте и активируйте хотя бы одну модель IMAGE.",
          "/admin/models",
        ),
  );

  const videoActive = await prisma.aiModel.count({
    where: { isActive: true, type: "VIDEO" },
  });
  items.push(
    videoActive >= 1
      ? item(
          "video_model",
          "Active VIDEO model exists",
          "Есть активная VIDEO модель",
          "ok",
        )
      : item(
          "video_model",
          "Active VIDEO model exists",
          "Есть активная VIDEO модель",
          "required",
          "Создайте и активируйте хотя бы одну модель VIDEO.",
          "/admin/models",
        ),
  );

  const seedanceActive = await prisma.aiModel.count({
    where: {
      isActive: true,
      apiModelId: {
        in: [SEEDANCE_API_MODEL_ID, SEEDANCE_FAST_API_MODEL_ID],
      },
    },
  });
  items.push(
    seedanceActive >= 1
      ? item(
          "seedance",
          "Seedance 2.0 active",
          "Seedance 2.0 активна",
          "ok",
        )
      : item(
          "seedance",
          "Seedance 2.0 active",
          "Seedance 2.0 активна",
          "required",
          "Нужна активная модель с apiModelId bytedance/seedance-2 или bytedance/seedance-2-fast.",
          "/admin/models",
        ),
  );

  const pricingModels = await prisma.aiModel.findMany({
    where: { isActive: true },
    select: { slug: true, pricingSchema: true },
  });
  const pricingErrors: string[] = [];
  for (const m of pricingModels) {
    if (m.pricingSchema == null || typeof m.pricingSchema !== "object") continue;
    const r = validateAdminPricingSchema(m.pricingSchema);
    if (!r.ok) pricingErrors.push(`${m.slug}: ${r.error}`);
  }
  items.push(
    pricingErrors.length === 0
      ? item(
          "pricing_schemas",
          "Pricing schemas valid",
          "Схемы цен валидны",
          "ok",
        )
      : item(
          "pricing_schemas",
          "Pricing schemas valid",
          "Схемы цен валидны",
          "required",
          pricingErrors.slice(0, 5).join(" · "),
          "/admin/models",
        ),
  );

  const productCardRoles = await prisma.aiModel.findMany({
    where: {
      scope: "PRODUCT_CARD",
      isActive: true,
      productCardModelType: {
        in: [
          "PRODUCT_CLASSIFIER",
          "PRODUCT_CONCEPT_IMAGE",
          "PRODUCT_MARKETPLACE_CARD",
          "PRODUCT_VIDEO",
        ],
      },
    },
    select: { productCardModelType: true, pricingSchema: true },
  });
  const pcRoleSet = new Set(productCardRoles.map((m) => m.productCardModelType));
  const missingPcRoles = [
    "PRODUCT_CLASSIFIER",
    "PRODUCT_CONCEPT_IMAGE",
    "PRODUCT_MARKETPLACE_CARD",
    "PRODUCT_VIDEO",
  ].filter((role) => !pcRoleSet.has(role));
  items.push(
    missingPcRoles.length === 0
      ? item(
          "product_card_models",
          "Product Card models configured",
          "Модели Product Card настроены",
          "ok",
        )
      : item(
          "product_card_models",
          "Product Card models configured",
          "Модели Product Card настроены",
          "required",
          `Не хватает ролей: ${missingPcRoles.join(", ")}.`,
          "/admin/product-card?tab=models",
        ),
  );

  const productCardPricingErrors = productCardRoles
    .filter((m) => {
      const ps = m.pricingSchema;
      return !(
        ps &&
        typeof ps === "object" &&
        !Array.isArray(ps) &&
        (ps as { pricingScope?: unknown; type?: unknown }).pricingScope === "PRODUCT_CARD" &&
        (ps as { pricingScope?: unknown; type?: unknown }).type === "product_card_matrix"
      );
    })
    .map((m) => m.productCardModelType ?? "unknown");
  items.push(
    productCardPricingErrors.length === 0
      ? item(
          "product_card_pricing",
          "Product Card pricing configured",
          "Product Card pricing настроен",
          "ok",
        )
      : item(
          "product_card_pricing",
          "Product Card pricing configured",
          "Product Card pricing настроен",
          "required",
          `Нужен pricingScope=PRODUCT_CARD/type=product_card_matrix: ${productCardPricingErrors.join(", ")}.`,
          "/admin/product-card?tab=pricing",
        ),
  );

  const pcSettings = await prisma.appSetting.findMany({
    where: {
      key: {
        in: [
          "PRODUCT_CARD_CONCEPT_IMAGE_SIZES",
          "PRODUCT_CARD_MARKETPLACE_CARD_SIZES",
          "PRODUCT_CARD_VIDEO_PRESETS",
        ],
      },
    },
    select: { key: true, value: true },
  });
  const missingPcSettings = pcSettings.filter(
    (s) => !Array.isArray(s.value) || s.value.length === 0,
  );
  items.push(
    missingPcSettings.length === 0 && pcSettings.length === 3
      ? item(
          "product_card_presets",
          "Product Card presets configured",
          "Product Card presets настроены",
          "ok",
        )
      : item(
          "product_card_presets",
          "Product Card presets configured",
          "Product Card presets настроены",
          "warning",
          "Проверьте presets размеров и видео для Product Card.",
          "/admin/product-card?tab=settings",
        ),
  );

  const tokenPackages = await prisma.tokenPackage.count({
    where: { isActive: true },
  });
  items.push(
    tokenPackages >= 1
      ? item(
          "token_packages",
          "Token packages active",
          "Есть активные пакеты токенов",
          "ok",
        )
      : item(
          "token_packages",
          "Token packages active",
          "Есть активные пакеты токенов",
          "required",
          "Создайте хотя бы один активный пакет токенов.",
          "/admin/token-packages",
        ),
  );

  const legalPublished = await prisma.legalPage.findMany({
    where: { slug: { in: [...LEGAL_PAGE_SLUGS] }, status: LEGAL_PAGE_STATUS.PUBLISHED },
    select: { slug: true },
  });
  const pubSet = new Set(legalPublished.map((r) => r.slug));
  const missingLegal = LEGAL_PAGE_SLUGS.filter((s) => !pubSet.has(s));
  items.push(
    missingLegal.length === 0
      ? item(
          "legal_pages",
          "Legal pages published",
          "Юридические страницы опубликованы",
          "ok",
        )
      : item(
          "legal_pages",
          "Legal pages published",
          "Юридические страницы опубликованы",
          "required",
          `Не опубликованы: ${missingLegal.join(", ")}.`,
          "/admin/legal",
        ),
  );

  let robotsOk = false;
  let sitemapOk = false;
  try {
    const robotsBody = await generateRobotsTxt();
    robotsOk = robotsBody.trim().length > 0;
  } catch {
    robotsOk = false;
  }
  try {
    const mapBody = await generateSitemapXml();
    sitemapOk = mapBody.includes("<urlset") || mapBody.includes("<url>");
  } catch {
    sitemapOk = false;
  }

  items.push(
    robotsOk
      ? item(
          "robots",
          "robots.txt available",
          "robots.txt доступен",
          "ok",
        )
      : item(
          "robots",
          "robots.txt available",
          "robots.txt доступен",
          "required",
          "Не удалось сгенерировать robots.txt (проверьте SEO‑настройки).",
          "/admin/seo",
        ),
  );

  items.push(
    sitemapOk
      ? item(
          "sitemap",
          "sitemap.xml available",
          "sitemap.xml доступен",
          "ok",
        )
      : item(
          "sitemap",
          "sitemap.xml available",
          "sitemap.xml доступен",
          "required",
          "Не удалось сгенерировать sitemap (проверьте SEO‑настройки и страницы).",
          "/admin/seo",
        ),
  );

  const emailStatus = await getEmailProviderEnvStatus();
  const pwdTpl = await prisma.emailTemplate.findUnique({
    where: { key: "PASSWORD_RESET" },
    select: { isActive: true },
  });
  let emailPwdSeverity: LaunchCheckSeverity = "ok";
  let emailPwdDetail: string | null = null;
  if (!emailStatus.emailEnabled) {
    emailPwdSeverity = "required";
    emailPwdDetail = "Включите EMAIL_ENABLED.";
  } else if (
    emailStatus.emailProvider === "none" ||
    emailStatus.emailProvider === ""
  ) {
    emailPwdSeverity = "required";
    emailPwdDetail = "Задайте EMAIL_PROVIDER (smtp, resend или sendgrid).";
  } else if (emailStatus.emailProvider === "smtp" && !emailStatus.smtpConfigured) {
    emailPwdSeverity = "required";
    emailPwdDetail = "Для SMTP задайте SMTP_HOST, SMTP_USER, SMTP_PASSWORD.";
  } else if (
    emailStatus.emailProvider === "resend" &&
    !emailStatus.resendApiConfigured
  ) {
    emailPwdSeverity = "required";
    emailPwdDetail = "Задайте RESEND_API_KEY.";
  } else if (
    emailStatus.emailProvider === "sendgrid" &&
    !emailStatus.sendgridApiConfigured
  ) {
    emailPwdSeverity = "required";
    emailPwdDetail = "Задайте SENDGRID_API_KEY.";
  } else if (!pwdTpl?.isActive) {
    emailPwdSeverity = "warning";
    emailPwdDetail =
      "Шаблон PASSWORD_RESET отсутствует или отключён — проверьте таблицу email_templates.";
  }
  items.push(
    item(
      "email_password_reset",
      "Email password reset configured",
      "Email для восстановления пароля настроен",
      emailPwdSeverity,
      emailPwdDetail,
      "/admin/notifications",
    ),
  );

  items.push(
    isStorageConfigured()
      ? item(
          "upload",
          "Upload endpoint works",
          "Upload endpoint работает",
          "ok",
        )
      : item(
          "upload",
          "Upload endpoint works",
          "Upload endpoint работает",
          "required",
          "Хранилище не сконфигурировано для загрузок.",
          "/admin/storage",
        ),
  );

  const moderationEnabled = (await getAppSetting("MODERATION_ENABLED")) === true;
  items.push(
    moderationEnabled
      ? item(
          "moderation",
          "Moderation enabled",
          "Модерация включена",
          "ok",
        )
      : item(
          "moderation",
          "Moderation enabled",
          "Модерация включена",
          "warning",
          "MODERATION_ENABLED выключен.",
          "/admin/settings",
        ),
  );

  await getRateUploadSettings();
  const rlSeverity: LaunchCheckSeverity =
    isProd && !envTrim("REDIS_URL") ? "warning" : "ok";
  items.push(
    item(
      "rate_limits",
      "Rate limits configured",
      "Rate limits настроены",
      rlSeverity,
      rlSeverity === "warning"
        ? "Без Redis ограничения только в памяти процесса — для нескольких инстансов нужен REDIS_URL."
        : null,
      rlSeverity === "warning" ? "/admin/settings" : null,
    ),
  );

  const health = await healthAlignedSummary();
  items.push(
    health.status === "ok"
      ? item(
          "health",
          "Healthcheck OK",
          "/api/health работает",
          "ok",
        )
      : item(
          "health",
          "Healthcheck OK",
          "/api/health работает",
          health.status === "error" ? "required" : "warning",
          health.status === "error"
            ? "База данных недоступна."
            : "Деградация (ожидается Redis для режима очереди redis).",
          "/admin/settings",
        ),
  );

  let ok = 0;
  let warning = 0;
  let required = 0;
  for (const it of items) {
    if (it.severity === "ok") ok += 1;
    else if (it.severity === "warning") warning += 1;
    else required += 1;
  }

  return { items, summary: { ok, warning, required } };
}
