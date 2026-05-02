
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
          ? "QUEUE_MODE=inline РЅРµ РїСЂРµРґРЅР°Р·РЅР°С‡РµРЅ РґР»СЏ production вЂ” РЅСѓР¶РµРЅ redis Рё РѕС‚РґРµР»СЊРЅС‹Р№ worker."
          : null,
      fixHref: process.env.NODE_ENV === "production" ? "/admin/settings" : null,
    };
  }
  const url = process.env.REDIS_URL?.trim();
  if (!url) {
    return {
      severity: "required",
      detail: "Р—Р°РґР°Р№С‚Рµ REDIS_URL Рё РїСЂРѕС†РµСЃСЃ npm run worker.",
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
          "РќРµС‚ Р·Р°СЂРµРіРёСЃС‚СЂРёСЂРѕРІР°РЅРЅС‹С… worker РґР»СЏ РѕС‡РµСЂРµРґРё РіРµРЅРµСЂР°С†РёР№. Р—Р°РїСѓСЃС‚РёС‚Рµ РїСЂРѕС†РµСЃСЃ worker.",
        fixHref: "/admin/settings",
      };
    }
    return { severity: "ok", detail: null, fixHref: null };
  } catch {
    return {
      severity: "warning",
      detail:
        "РќРµ СѓРґР°Р»РѕСЃСЊ РѕРїСЂРµРґРµР»РёС‚СЊ С‡РёСЃР»Рѕ worker (РЅР° С‡Р°СЃС‚Рё RedisвЂ‘РѕРєСЂСѓР¶РµРЅРёР№ РєРѕРјР°РЅРґР° РЅРµРґРѕСЃС‚СѓРїРЅР°). РџСЂРѕРІРµСЂСЊС‚Рµ worker РІСЂСѓС‡РЅСѓСЋ.",
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
        "Р‘Р°Р·Р° РґР°РЅРЅС‹С… РЅР°СЃС‚СЂРѕРµРЅР°",
        "required",
        "РџРµСЂРµРјРµРЅРЅР°СЏ DATABASE_URL РЅРµ Р·Р°РґР°РЅР°.",
        "/admin/settings",
      ),
    );
  } else if (!dbReachable) {
    items.push(
      item(
        "database_url",
        "DATABASE_URL configured",
        "Р‘Р°Р·Р° РґР°РЅРЅС‹С… РЅР°СЃС‚СЂРѕРµРЅР°",
        "required",
        "РџРѕРґРєР»СЋС‡РµРЅРёРµ Рє Р‘Р” РЅРµ СѓРґР°Р»РѕСЃСЊ (РїСЂРѕРІРµСЂСЊС‚Рµ СЃС‚СЂРѕРєСѓ Рё РґРѕСЃС‚СѓРїРЅРѕСЃС‚СЊ СЃРµСЂРІРµСЂР°).",
        "/admin/settings",
      ),
    );
  } else {
    items.push(
      item(
        "database_url",
        "DATABASE_URL configured",
        "Р‘Р°Р·Р° РґР°РЅРЅС‹С… РЅР°СЃС‚СЂРѕРµРЅР°",
        "ok",
      ),
    );
  }

  items.push(
    hasAuthSecret()
      ? item(
          "auth_secret",
          "AUTH_SECRET configured",
          "Auth secret РЅР°СЃС‚СЂРѕРµРЅ",
          "ok",
        )
      : item(
          "auth_secret",
          "AUTH_SECRET configured",
          "Auth secret РЅР°СЃС‚СЂРѕРµРЅ",
          "required",
          "Р—Р°РґР°Р№С‚Рµ AUTH_SECRET РёР»Рё NEXTAUTH_SECRET.",
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
          "Super admin СЃРѕР·РґР°РЅ",
          "ok",
        )
      : item(
          "super_admin",
          "SUPER_ADMIN exists",
          "Super admin СЃРѕР·РґР°РЅ",
          "required",
          "РќРµС‚ Р°РєС‚РёРІРЅРѕРіРѕ РїРѕР»СЊР·РѕРІР°С‚РµР»СЏ СЃ СЂРѕР»СЊСЋ SUPER_ADMIN.",
          "/admin/users",
        ),
  );

  items.push(
    envTrim("KIE_API_KEY")
      ? item(
          "kie_api_key",
          "KIE_API_KEY configured",
          "Kie API key РЅР°СЃС‚СЂРѕРµРЅ",
          "ok",
        )
      : item(
          "kie_api_key",
          "KIE_API_KEY configured",
          "Kie API key РЅР°СЃС‚СЂРѕРµРЅ",
          "required",
          "Р—Р°РґР°Р№С‚Рµ KIE_API_KEY.",
          "/admin/providers",
        ),
  );

  items.push(
    envTrim("KIE_BASE_URL")
      ? item(
          "kie_base_url",
          "KIE_BASE_URL configured",
          "Kie base URL РЅР°СЃС‚СЂРѕРµРЅ",
          "ok",
        )
      : item(
          "kie_base_url",
          "KIE_BASE_URL configured",
          "Kie base URL РЅР°СЃС‚СЂРѕРµРЅ",
          "required",
          "Р—Р°РґР°Р№С‚Рµ KIE_BASE_URL.",
          "/admin/providers",
        ),
  );

  if (process.env.NODE_ENV === "production" && isMockKieEnabled()) {
    items.push(
      item(
        "mock_kie_prod",
        "MOCK_KIE disabled in production",
        "MOCK_KIE РІС‹РєР»СЋС‡РµРЅ РІ production",
        "required",
        "Р’ production MOCK_KIE РґРѕР»Р¶РµРЅ Р±С‹С‚СЊ false.",
        "/admin/providers",
      ),
    );
  } else {
    items.push(
      item(
        "mock_kie_prod",
        "MOCK_KIE disabled in production",
        "MOCK_KIE РІС‹РєР»СЋС‡РµРЅ РІ production",
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
        "S3 С…СЂР°РЅРёР»РёС‰Рµ РЅР°СЃС‚СЂРѕРµРЅРѕ",
        "required",
        "UPLOAD_STORAGE=local РЅРµРґРѕРїСѓСЃС‚РёРј РІ production.",
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
            "S3 С…СЂР°РЅРёР»РёС‰Рµ РЅР°СЃС‚СЂРѕРµРЅРѕ",
            "ok",
          )
        : item(
            "s3_storage",
            "S3 storage configured",
            "S3 С…СЂР°РЅРёР»РёС‰Рµ РЅР°СЃС‚СЂРѕРµРЅРѕ",
            "required",
            "Р—Р°РґР°Р№С‚Рµ S3_ENDPOINT, S3_REGION, S3_BUCKET, РєР»СЋС‡Рё Рё СЂРµРіРёРѕРЅ.",
            "/admin/storage",
          ),
    );
  } else {
    items.push(
      item(
        "s3_storage",
        "S3 storage configured",
        "S3 С…СЂР°РЅРёР»РёС‰Рµ РЅР°СЃС‚СЂРѕРµРЅРѕ",
        isProd ? "warning" : "ok",
        isProd
          ? "РСЃРїРѕР»СЊР·СѓРµС‚СЃСЏ Р»РѕРєР°Р»СЊРЅРѕРµ С…СЂР°РЅРёР»РёС‰Рµ вЂ” РґР»СЏ production РЅСѓР¶РµРЅ S3."
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
            "РџСѓР±Р»РёС‡РЅС‹Р№ URL С…СЂР°РЅРёР»РёС‰Р° РЅР°СЃС‚СЂРѕРµРЅ",
            "ok",
          )
        : item(
            "s3_public_url",
            "S3_PUBLIC_URL configured",
            "РџСѓР±Р»РёС‡РЅС‹Р№ URL С…СЂР°РЅРёР»РёС‰Р° РЅР°СЃС‚СЂРѕРµРЅ",
            "required",
            "Р‘РµР· S3_PUBLIC_URL РїСЂРѕРІР°Р№РґРµСЂ РјРѕР¶РµС‚ РЅРµ РїРѕР»СѓС‡РёС‚СЊ URL Р·Р°РіСЂСѓР·РѕРє.",
            "/admin/storage",
          ),
    );
  } else {
    items.push(
      item(
        "s3_public_url",
        "S3_PUBLIC_URL configured",
        "РџСѓР±Р»РёС‡РЅС‹Р№ URL С…СЂР°РЅРёР»РёС‰Р° РЅР°СЃС‚СЂРѕРµРЅ",
        isProd ? "warning" : "ok",
        isProd
          ? "Р”Р»СЏ production Р·Р°РґР°Р№С‚Рµ object storage Рё S3_PUBLIC_URL."
          : "РџСЂРё Р»РѕРєР°Р»СЊРЅРѕРј С…СЂР°РЅРёР»РёС‰Рµ S3_PUBLIC_URL РЅРµ РёСЃРїРѕР»СЊР·СѓРµС‚СЃСЏ.",
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
        "Redis РЅР°СЃС‚СЂРѕРµРЅ",
        "warning",
        "РџСЂРё QUEUE_MODE=inline Redis РЅРµ РѕР±СЏР·Р°С‚РµР»РµРЅ РґР»СЏ РѕС‡РµСЂРµРґРё.",
        "/admin/settings",
      ),
    );
  } else if (redisPing === "ok") {
    items.push(
      item(
        "redis",
        "Redis configured",
        "Redis РЅР°СЃС‚СЂРѕРµРЅ",
        "ok",
      ),
    );
  } else if (redisPing === "missing") {
    items.push(
      item(
        "redis",
        "Redis configured",
        "Redis РЅР°СЃС‚СЂРѕРµРЅ",
        "required",
        "Р—Р°РґР°Р№С‚Рµ REDIS_URL РґР»СЏ BullMQ.",
        "/admin/settings",
      ),
    );
  } else {
    items.push(
      item(
        "redis",
        "Redis configured",
        "Redis РЅР°СЃС‚СЂРѕРµРЅ",
        "required",
        "REDIS_URL Р·Р°РґР°РЅ, РЅРѕ СЃРѕРµРґРёРЅРµРЅРёРµ РЅРµ СѓРґР°Р»РѕСЃСЊ.",
        "/admin/settings",
      ),
    );
  }

  if (isProd && isQueueInline()) {
    items.push(
      item(
        "queue_mode",
        "Queue mode production-ready",
        "РћС‡РµСЂРµРґСЊ РіРѕС‚РѕРІР° Рє production",
        "required",
        "Р’ production РёСЃРїРѕР»СЊР·СѓР№С‚Рµ QUEUE_MODE=redis (РёР»Рё РЅРµ Р·Р°РґР°РІР°Р№С‚Рµ inline).",
        "/admin/settings",
      ),
    );
  } else if (!isQueueInline() && redisPing !== "ok") {
    items.push(
      item(
        "queue_mode",
        "Queue mode production-ready",
        "РћС‡РµСЂРµРґСЊ РіРѕС‚РѕРІР° Рє production",
        "required",
        "Р РµР¶РёРј redis С‚СЂРµР±СѓРµС‚ СЂР°Р±РѕС‡РёР№ REDIS_URL.",
        "/admin/settings",
      ),
    );
  } else {
    items.push(
      item(
        "queue_mode",
        "Queue mode production-ready",
        "РћС‡РµСЂРµРґСЊ РіРѕС‚РѕРІР° Рє production",
        "ok",
      ),
    );
  }

  const workerCheck = await checkWorkersCount();
  items.push(
    item(
      "worker",
      "Worker status checked",
      "Worker РїСЂРѕРІРµСЂРµРЅ",
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
          "Р•СЃС‚СЊ Р°РєС‚РёРІРЅР°СЏ IMAGE РјРѕРґРµР»СЊ",
          "ok",
        )
      : item(
          "image_model",
          "Active IMAGE model exists",
          "Р•СЃС‚СЊ Р°РєС‚РёРІРЅР°СЏ IMAGE РјРѕРґРµР»СЊ",
          "required",
          "РЎРѕР·РґР°Р№С‚Рµ Рё Р°РєС‚РёРІРёСЂСѓР№С‚Рµ С…РѕС‚СЏ Р±С‹ РѕРґРЅСѓ РјРѕРґРµР»СЊ IMAGE.",
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
          "Р•СЃС‚СЊ Р°РєС‚РёРІРЅР°СЏ VIDEO РјРѕРґРµР»СЊ",
          "ok",
        )
      : item(
          "video_model",
          "Active VIDEO model exists",
          "Р•СЃС‚СЊ Р°РєС‚РёРІРЅР°СЏ VIDEO РјРѕРґРµР»СЊ",
          "required",
          "РЎРѕР·РґР°Р№С‚Рµ Рё Р°РєС‚РёРІРёСЂСѓР№С‚Рµ С…РѕС‚СЏ Р±С‹ РѕРґРЅСѓ РјРѕРґРµР»СЊ VIDEO.",
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
          "Seedance 2.0 Р°РєС‚РёРІРЅР°",
          "ok",
        )
      : item(
          "seedance",
          "Seedance 2.0 active",
          "Seedance 2.0 Р°РєС‚РёРІРЅР°",
          "required",
          "РќСѓР¶РЅР° Р°РєС‚РёРІРЅР°СЏ РјРѕРґРµР»СЊ СЃ apiModelId bytedance/seedance-2 РёР»Рё bytedance/seedance-2-fast.",
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
          "РЎС…РµРјС‹ С†РµРЅ РІР°Р»РёРґРЅС‹",
          "ok",
        )
      : item(
          "pricing_schemas",
          "Pricing schemas valid",
          "РЎС…РµРјС‹ С†РµРЅ РІР°Р»РёРґРЅС‹",
          "required",
          pricingErrors.slice(0, 5).join(" В· "),
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
          "РњРѕРґРµР»Рё Product Card РЅР°СЃС‚СЂРѕРµРЅС‹",
          "ok",
        )
      : item(
          "product_card_models",
          "Product Card models configured",
          "РњРѕРґРµР»Рё Product Card РЅР°СЃС‚СЂРѕРµРЅС‹",
          "required",
          `РќРµ С…РІР°С‚Р°РµС‚ СЂРѕР»РµР№: ${missingPcRoles.join(", ")}.`,
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
          "Product Card pricing РЅР°СЃС‚СЂРѕРµРЅ",
          "ok",
        )
      : item(
          "product_card_pricing",
          "Product Card pricing configured",
          "Product Card pricing РЅР°СЃС‚СЂРѕРµРЅ",
          "required",
          `РќСѓР¶РµРЅ pricingScope=PRODUCT_CARD/type=product_card_matrix: ${productCardPricingErrors.join(", ")}.`,
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
          "Product Card presets РЅР°СЃС‚СЂРѕРµРЅС‹",
          "ok",
        )
      : item(
          "product_card_presets",
          "Product Card presets configured",
          "Product Card presets РЅР°СЃС‚СЂРѕРµРЅС‹",
          "warning",
          "РџСЂРѕРІРµСЂСЊС‚Рµ presets СЂР°Р·РјРµСЂРѕРІ Рё РІРёРґРµРѕ РґР»СЏ Product Card.",
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
          "Р•СЃС‚СЊ Р°РєС‚РёРІРЅС‹Рµ РїР°РєРµС‚С‹ С‚РѕРєРµРЅРѕРІ",
          "ok",
        )
      : item(
          "token_packages",
          "Token packages active",
          "Р•СЃС‚СЊ Р°РєС‚РёРІРЅС‹Рµ РїР°РєРµС‚С‹ С‚РѕРєРµРЅРѕРІ",
          "required",
          "РЎРѕР·РґР°Р№С‚Рµ С…РѕС‚СЏ Р±С‹ РѕРґРёРЅ Р°РєС‚РёРІРЅС‹Р№ РїР°РєРµС‚ С‚РѕРєРµРЅРѕРІ.",
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
          "Р®СЂРёРґРёС‡РµСЃРєРёРµ СЃС‚СЂР°РЅРёС†С‹ РѕРїСѓР±Р»РёРєРѕРІР°РЅС‹",
          "ok",
        )
      : item(
          "legal_pages",
          "Legal pages published",
          "Р®СЂРёРґРёС‡РµСЃРєРёРµ СЃС‚СЂР°РЅРёС†С‹ РѕРїСѓР±Р»РёРєРѕРІР°РЅС‹",
          "required",
          `РќРµ РѕРїСѓР±Р»РёРєРѕРІР°РЅС‹: ${missingLegal.join(", ")}.`,
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
          "robots.txt РґРѕСЃС‚СѓРїРµРЅ",
          "ok",
        )
      : item(
          "robots",
          "robots.txt available",
          "robots.txt РґРѕСЃС‚СѓРїРµРЅ",
          "required",
          "РќРµ СѓРґР°Р»РѕСЃСЊ СЃРіРµРЅРµСЂРёСЂРѕРІР°С‚СЊ robots.txt (РїСЂРѕРІРµСЂСЊС‚Рµ SEOвЂ‘РЅР°СЃС‚СЂРѕР№РєРё).",
          "/admin/seo",
        ),
  );

  items.push(
    sitemapOk
      ? item(
          "sitemap",
          "sitemap.xml available",
          "sitemap.xml РґРѕСЃС‚СѓРїРµРЅ",
          "ok",
        )
      : item(
          "sitemap",
          "sitemap.xml available",
          "sitemap.xml РґРѕСЃС‚СѓРїРµРЅ",
          "required",
          "РќРµ СѓРґР°Р»РѕСЃСЊ СЃРіРµРЅРµСЂРёСЂРѕРІР°С‚СЊ sitemap (РїСЂРѕРІРµСЂСЊС‚Рµ SEOвЂ‘РЅР°СЃС‚СЂРѕР№РєРё Рё СЃС‚СЂР°РЅРёС†С‹).",
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
    emailPwdDetail = "Р’РєР»СЋС‡РёС‚Рµ EMAIL_ENABLED.";
  } else if (
    emailStatus.emailProvider === "none" ||
    emailStatus.emailProvider === ""
  ) {
    emailPwdSeverity = "required";
    emailPwdDetail = "Р—Р°РґР°Р№С‚Рµ EMAIL_PROVIDER (smtp, resend РёР»Рё sendgrid).";
  } else if (emailStatus.emailProvider === "smtp" && !emailStatus.smtpConfigured) {
    emailPwdSeverity = "required";
    emailPwdDetail = "Р”Р»СЏ SMTP Р·Р°РґР°Р№С‚Рµ SMTP_HOST, SMTP_USER, SMTP_PASSWORD.";
  } else if (
    emailStatus.emailProvider === "resend" &&
    !emailStatus.resendApiConfigured
  ) {
    emailPwdSeverity = "required";
    emailPwdDetail = "Р—Р°РґР°Р№С‚Рµ RESEND_API_KEY.";
  } else if (
    emailStatus.emailProvider === "sendgrid" &&
    !emailStatus.sendgridApiConfigured
  ) {
    emailPwdSeverity = "required";
    emailPwdDetail = "Р—Р°РґР°Р№С‚Рµ SENDGRID_API_KEY.";
  } else if (!pwdTpl?.isActive) {
    emailPwdSeverity = "warning";
    emailPwdDetail =
      "РЁР°Р±Р»РѕРЅ PASSWORD_RESET РѕС‚СЃСѓС‚СЃС‚РІСѓРµС‚ РёР»Рё РѕС‚РєР»СЋС‡С‘РЅ вЂ” РїСЂРѕРІРµСЂСЊС‚Рµ С‚Р°Р±Р»РёС†Сѓ email_templates.";
  }
  items.push(
    item(
      "email_password_reset",
      "Email password reset configured",
      "Email РґР»СЏ РІРѕСЃСЃС‚Р°РЅРѕРІР»РµРЅРёСЏ РїР°СЂРѕР»СЏ РЅР°СЃС‚СЂРѕРµРЅ",
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
          "Upload endpoint СЂР°Р±РѕС‚Р°РµС‚",
          "ok",
        )
      : item(
          "upload",
          "Upload endpoint works",
          "Upload endpoint СЂР°Р±РѕС‚Р°РµС‚",
          "required",
          "РҐСЂР°РЅРёР»РёС‰Рµ РЅРµ СЃРєРѕРЅС„РёРіСѓСЂРёСЂРѕРІР°РЅРѕ РґР»СЏ Р·Р°РіСЂСѓР·РѕРє.",
          "/admin/storage",
        ),
  );

  const moderationEnabled = (await getAppSetting("MODERATION_ENABLED")) === true;
  items.push(
    moderationEnabled
      ? item(
          "moderation",
          "Moderation enabled",
          "РњРѕРґРµСЂР°С†РёСЏ РІРєР»СЋС‡РµРЅР°",
          "ok",
        )
      : item(
          "moderation",
          "Moderation enabled",
          "РњРѕРґРµСЂР°С†РёСЏ РІРєР»СЋС‡РµРЅР°",
          "warning",
          "MODERATION_ENABLED РІС‹РєР»СЋС‡РµРЅ.",
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
      "Rate limits РЅР°СЃС‚СЂРѕРµРЅС‹",
      rlSeverity,
      rlSeverity === "warning"
        ? "Р‘РµР· Redis РѕРіСЂР°РЅРёС‡РµРЅРёСЏ С‚РѕР»СЊРєРѕ РІ РїР°РјСЏС‚Рё РїСЂРѕС†РµСЃСЃР° вЂ” РґР»СЏ РЅРµСЃРєРѕР»СЊРєРёС… РёРЅСЃС‚Р°РЅСЃРѕРІ РЅСѓР¶РµРЅ REDIS_URL."
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
          "/api/health СЂР°Р±РѕС‚Р°РµС‚",
          "ok",
        )
      : item(
          "health",
          "Healthcheck OK",
          "/api/health СЂР°Р±РѕС‚Р°РµС‚",
          health.status === "error" ? "required" : "warning",
          health.status === "error"
            ? "Р‘Р°Р·Р° РґР°РЅРЅС‹С… РЅРµРґРѕСЃС‚СѓРїРЅР°."
            : "Р”РµРіСЂР°РґР°С†РёСЏ (РѕР¶РёРґР°РµС‚СЃСЏ Redis РґР»СЏ СЂРµР¶РёРјР° РѕС‡РµСЂРµРґРё redis).",
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
