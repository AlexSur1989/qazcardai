import "server-only";

import {
  DEFAULT_MODERATION_BANNED_SUBSTRINGS,
  MODERATION_APP_SETTING_KEY,
} from "@/lib/moderation-defaults";
import { prisma } from "@/lib/prisma";

export type LoadedModerationConfig = {
  enabled: boolean;
  /** Уже нормализованные (lower) подстроки */
  bannedSubstrings: string[];
};

type ModerationSettingsJson = {
  enabled?: boolean;
  /** Доп. запрещённые фрагменты (к дефолтному списку) */
  bannedSubstrings?: string[];
};

let cache: { at: number; value: LoadedModerationConfig } | null = null;
const TTL_MS = 15_000;

function mergeLists(base: string[], extra: string[] | undefined): string[] {
  const set = new Set<string>([...base, ...(extra ?? [])].map((s) => s.trim().toLowerCase()).filter(Boolean));
  return [...set];
}

export async function getModerationConfig(): Promise<LoadedModerationConfig> {
  const now = Date.now();
  if (cache && now - cache.at < TTL_MS) {
    return cache.value;
  }
  const defaults: LoadedModerationConfig = {
    enabled: true,
    bannedSubstrings: mergeLists(DEFAULT_MODERATION_BANNED_SUBSTRINGS, []),
  };
  let merged = defaults;
  try {
    const row = await prisma.appSetting.findUnique({
      where: { key: MODERATION_APP_SETTING_KEY },
      select: { value: true },
    });
    if (row?.value && typeof row.value === "object" && !Array.isArray(row.value)) {
      const v = row.value as ModerationSettingsJson;
      const enabled = v.enabled !== false;
      const banned = mergeLists(
        DEFAULT_MODERATION_BANNED_SUBSTRINGS,
        v.bannedSubstrings,
      );
      merged = { enabled, bannedSubstrings: banned };
    }
  } catch {
    // БД недоступна — дефолты
  }
  cache = { at: now, value: merged };
  return merged;
}

export function clearModerationConfigCache() {
  cache = null;
}
