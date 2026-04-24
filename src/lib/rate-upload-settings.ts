import "server-only";

import { prisma } from "@/lib/prisma";

export const RATE_UPLOAD_APP_SETTING_KEY = "rate_upload_limits" as const;

type RateUploadLimitsJson = {
  maxImageUploadMb?: number;
  maxVideoUploadMb?: number;
  /** В минуту, на IP (вход) */
  loginPerMinute?: number;
  /** В минуту, на IP (регистрация) */
  registrationPerMinute?: number;
  /** В минуту, на userId (генерации) */
  generationPerMinute?: number;
  /** В минуту, на userId (загрузки) */
  uploadPerMinute?: number;
  /** В минуту, на userId (админские действия) */
  adminPerMinute?: number;
};

function numEnv(name: string, fallback: number): number {
  const n = parseInt(process.env[name] ?? "", 10);
  if (Number.isFinite(n) && n > 0) return n;
  return fallback;
}

function pickPositive(n: unknown, fallback: number): number {
  if (typeof n === "number" && Number.isFinite(n) && n > 0) return n;
  return fallback;
}

export type RateUploadSettings = {
  maxImageUploadMb: number;
  maxVideoUploadMb: number;
  loginPerMinute: number;
  registrationPerMinute: number;
  generationPerMinute: number;
  uploadPerMinute: number;
  adminPerMinute: number;
};

const defaultFromEnv = (): RateUploadSettings => ({
  maxImageUploadMb: numEnv("MAX_IMAGE_UPLOAD_MB", 10),
  maxVideoUploadMb: numEnv("MAX_VIDEO_UPLOAD_MB", 100),
  loginPerMinute: numEnv("RATE_LIMIT_LOGIN_PER_MINUTE", 5),
  registrationPerMinute: numEnv("RATE_LIMIT_REGISTRATION_PER_MINUTE", 5),
  generationPerMinute: numEnv("RATE_LIMIT_GENERATION_PER_MINUTE", 10),
  uploadPerMinute: numEnv("RATE_LIMIT_UPLOAD_PER_MINUTE", 10),
  adminPerMinute: numEnv("RATE_LIMIT_ADMIN_PER_MINUTE", 30),
});

let cache: { at: number; value: RateUploadSettings } | null = null;
const TTL_MS = 15_000;

/**
 * Ограничения из AppSetting (JSON) с fallback на env-переменные.
 */
export async function getRateUploadSettings(): Promise<RateUploadSettings> {
  const now = Date.now();
  if (cache && now - cache.at < TTL_MS) {
    return cache.value;
  }
  const base = defaultFromEnv();
  let merged: RateUploadSettings = { ...base };
  try {
    const row = await prisma.appSetting.findUnique({
      where: { key: RATE_UPLOAD_APP_SETTING_KEY },
      select: { value: true },
    });
    if (row?.value && typeof row.value === "object" && !Array.isArray(row.value)) {
      const v = row.value as RateUploadLimitsJson;
      merged = {
        maxImageUploadMb: pickPositive(v.maxImageUploadMb, base.maxImageUploadMb),
        maxVideoUploadMb: pickPositive(v.maxVideoUploadMb, base.maxVideoUploadMb),
        loginPerMinute: pickPositive(v.loginPerMinute, base.loginPerMinute),
        registrationPerMinute: pickPositive(
          v.registrationPerMinute,
          base.registrationPerMinute,
        ),
        generationPerMinute: pickPositive(v.generationPerMinute, base.generationPerMinute),
        uploadPerMinute: pickPositive(v.uploadPerMinute, base.uploadPerMinute),
        adminPerMinute: pickPositive(v.adminPerMinute, base.adminPerMinute),
      };
    }
  } catch {
    // БД может быть недоступна при старте
  }
  cache = { at: now, value: merged };
  return merged;
}

export function clearRateUploadSettingsCache() {
  cache = null;
}
