
import {
  DEFAULT_MODERATION_BANNED_SUBSTRINGS,
  MODERATION_APP_SETTING_KEY,
} from "@/lib/moderation-defaults";
import { getAppSetting } from "@/server/services/appSettings";
import { prisma } from "@/lib/prisma";

export type LoadedModerationConfig = {
  enabled: boolean;
  /** Уже нормализованные (lower) подстроки (совместимость) */
  bannedSubstrings: string[];
};

type ModerationSettingsJson = {
  enabled?: boolean;
  bannedSubstrings?: string[];
};

export type FullModerationConfig = {
  enabled: boolean;
  maxPromptLength: number;
  bannedWords: string[];
  blockedPatterns: string[];
  blockNsfw: boolean;
  blockDeepfake: boolean;
  blockMinors: boolean;
  blockIllegal: boolean;
  reviewMode: boolean;
};

const CACHE_TTL_MS = 15_000;
let cache: { at: number; value: FullModerationConfig } | null = null;

function mergeLists(base: string[], extra: string[] | undefined): string[] {
  const set = new Set<string>([
    ...base,
    ...(extra ?? []),
  ]
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean));
  return [...set];
}

function asStringArray(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v
    .filter((x): x is string => typeof x === "string")
    .map((s) => s.trim())
    .filter(Boolean);
}

function asNumber(v: unknown, fallback: number): number {
  if (typeof v === "number" && Number.isFinite(v) && v > 0) return Math.floor(v);
  if (typeof v === "string" && v.trim() !== "") {
    const n = Number(v);
    if (Number.isFinite(n) && n > 0) return Math.floor(n);
  }
  return fallback;
}

/**
 * Настройки из реестра + legacy `moderation_settings` (только список и enabled, пока нет ключа в БД).
 */
export async function getFullModerationConfig(): Promise<FullModerationConfig> {
  const now = Date.now();
  if (cache && now - cache.at < CACHE_TTL_MS) {
    return cache.value;
  }
  const [
    explicitEnabledRow,
    legacyRow,
  ] = await Promise.all([
    prisma.appSetting.findUnique({
      where: { key: "MODERATION_ENABLED" },
      select: { value: true },
    }),
    prisma.appSetting.findUnique({
      where: { key: MODERATION_APP_SETTING_KEY },
      select: { value: true },
    }),
  ]);

  const [
    modBannedWords,
    modPatterns,
    modMaxLen,
    blockNsfw,
    blockDeepfake,
    blockMinors,
    blockIllegal,
    reviewMode,
  ] = await Promise.all([
    getAppSetting("MODERATION_BANNED_WORDS"),
    getAppSetting("MODERATION_BLOCKED_PATTERNS"),
    getAppSetting("MODERATION_MAX_PROMPT_LENGTH"),
    getAppSetting("MODERATION_BLOCK_NSFW"),
    getAppSetting("MODERATION_BLOCK_DEEPFAKE"),
    getAppSetting("MODERATION_BLOCK_MINORS"),
    getAppSetting("MODERATION_BLOCK_ILLEGAL"),
    getAppSetting("MODERATION_REVIEW_MODE"),
  ]);

  const registryBanned = asStringArray(modBannedWords);
  const fromLegacy =
    legacyRow?.value && typeof legacyRow.value === "object" && !Array.isArray(legacyRow.value)
      ? (legacyRow.value as ModerationSettingsJson)
      : null;
  const legacyBanned = asStringArray(fromLegacy?.bannedSubstrings);
  const bannedWords = mergeLists(
    mergeLists(DEFAULT_MODERATION_BANNED_SUBSTRINGS, registryBanned),
    legacyBanned,
  );

  let enabled: boolean;
  if (explicitEnabledRow) {
    enabled = explicitEnabledRow.value === true;
  } else if (fromLegacy) {
    enabled = fromLegacy.enabled !== false;
  } else {
    const v = await getAppSetting("MODERATION_ENABLED");
    enabled = v === true;
  }

  const blockedPatterns = asStringArray(modPatterns);
  const maxPromptLength = asNumber(modMaxLen, 2000);
  const patternsOk = {
    blockNsfw: blockNsfw !== false,
    blockDeepfake: blockDeepfake !== false,
    blockMinors: blockMinors !== false,
    blockIllegal: blockIllegal !== false,
    reviewMode: reviewMode === true,
  };

  const value: FullModerationConfig = {
    enabled,
    maxPromptLength,
    bannedWords,
    blockedPatterns,
    blockNsfw: patternsOk.blockNsfw,
    blockDeepfake: patternsOk.blockDeepfake,
    blockMinors: patternsOk.blockMinors,
    blockIllegal: patternsOk.blockIllegal,
    reviewMode: patternsOk.reviewMode,
  };
  cache = { at: now, value };
  return value;
}

export async function getModerationConfig(): Promise<LoadedModerationConfig> {
  const f = await getFullModerationConfig();
  return {
    enabled: f.enabled,
    bannedSubstrings: f.bannedWords,
  };
}

export function clearModerationConfigCache() {
  cache = null;
}
