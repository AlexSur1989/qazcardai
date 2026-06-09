import type { UserRole } from "@/generated/prisma/enums";
import {
  parseProductClassifierAccessMode,
  type ProductClassifierAccessMode,
} from "@/lib/product-classifier-access-mode";
import { isClassifierRuntimeEnabled } from "@/lib/product-classifier-runtime-gate";
import { canAccessAdminPanel } from "@/lib/auth";
import { getAppSetting } from "@/server/services/appSettings";
import type { ProductCardModelSlotDiagnostics } from "@/server/services/productCardModelSetup";

export type ProductClassifierCommercialSettings = {
  accessMode: ProductClassifierAccessMode;
  costCredits: number;
  dailyLimit: number;
  cooldownSeconds: number;
};

function clampNonNegativeInt(raw: unknown, fallback: number): number {
  const n = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isFinite(n) || n < 0) return fallback;
  return Math.floor(n);
}

export async function getProductClassifierCommercialSettings(): Promise<ProductClassifierCommercialSettings> {
  const [accessRaw, costRaw, dailyRaw, cooldownRaw] = await Promise.all([
    getAppSetting("PRODUCT_CLASSIFIER_ACCESS_MODE"),
    getAppSetting("PRODUCT_CLASSIFIER_COST_CREDITS"),
    getAppSetting("PRODUCT_CLASSIFIER_DAILY_LIMIT"),
    getAppSetting("PRODUCT_CLASSIFIER_COOLDOWN_SECONDS"),
  ]);

  return {
    accessMode: parseProductClassifierAccessMode(accessRaw),
    costCredits: clampNonNegativeInt(costRaw, 1),
    dailyLimit: Math.max(1, clampNonNegativeInt(dailyRaw, 10)),
    cooldownSeconds: Math.max(1, clampNonNegativeInt(cooldownRaw, 10)),
  };
}

export function isClassifierAccessModeAllowedForRole(
  accessMode: ProductClassifierAccessMode,
  role: UserRole,
): boolean {
  if (accessMode === "disabled") return false;
  if (accessMode === "all_users") return true;
  if (accessMode === "admin_only") return canAccessAdminPanel(role);
  // beta_users: отдельный флаг пользователя пока не реализован — TODO
  return false;
}

export type ClassifierAccessForUser = {
  /** Показывать блок classifier (не fallback «скоро будет доступно»). */
  uiEnabled: boolean;
  /** Можно нажать «Распознать» (модель + gate + access + баланс). */
  canClassify: boolean;
  insufficientCredits: boolean;
  costCredits: number;
  dailyLimit: number;
  cooldownSeconds: number;
  accessMode: ProductClassifierAccessMode;
  runtimeGateEnabled: boolean;
};

export function resolveClassifierAccessForUser(args: {
  role: UserRole;
  balanceCredits: number;
  commercial: ProductClassifierCommercialSettings;
  modelSlot: ProductCardModelSlotDiagnostics | undefined;
}): ClassifierAccessForUser {
  const runtimeGateEnabled = isClassifierRuntimeEnabled();
  const modelReady = args.modelSlot?.readinessStatus === "Ready";
  const accessAllowed = isClassifierAccessModeAllowedForRole(
    args.commercial.accessMode,
    args.role,
  );
  const uiEnabled =
    runtimeGateEnabled &&
    modelReady &&
    accessAllowed &&
    args.commercial.accessMode !== "disabled";
  const insufficientCredits =
    args.commercial.costCredits > 0 &&
    args.balanceCredits < args.commercial.costCredits;
  const canClassify = uiEnabled && !insufficientCredits;

  return {
    uiEnabled,
    canClassify,
    insufficientCredits,
    costCredits: args.commercial.costCredits,
    dailyLimit: args.commercial.dailyLimit,
    cooldownSeconds: args.commercial.cooldownSeconds,
    accessMode: args.commercial.accessMode,
    runtimeGateEnabled,
  };
}

export function isClassifierUserTrafficReady(args: {
  commercial: ProductClassifierCommercialSettings;
  modelSlot: ProductCardModelSlotDiagnostics | undefined;
}): boolean {
  return (
    isClassifierRuntimeEnabled() &&
    args.modelSlot?.readinessStatus === "Ready" &&
    args.commercial.accessMode === "all_users"
  );
}

export function validateClassifierCommercialPatch(input: {
  accessMode?: string;
  costCredits?: number;
  dailyLimit?: number;
  cooldownSeconds?: number;
}): { ok: true } | { ok: false; error: string } {
  if (input.accessMode !== undefined) {
    const mode = parseProductClassifierAccessMode(input.accessMode);
    if (mode !== input.accessMode.trim().toLowerCase()) {
      return {
        ok: false,
        error: "accessMode: disabled | admin_only | beta_users | all_users",
      };
    }
  }
  if (input.costCredits !== undefined) {
    if (!Number.isInteger(input.costCredits) || input.costCredits < 0) {
      return { ok: false, error: "costCredits: целое число ≥ 0" };
    }
  }
  if (input.dailyLimit !== undefined) {
    if (!Number.isInteger(input.dailyLimit) || input.dailyLimit < 1) {
      return { ok: false, error: "dailyLimit: целое число ≥ 1" };
    }
  }
  if (input.cooldownSeconds !== undefined) {
    if (!Number.isInteger(input.cooldownSeconds) || input.cooldownSeconds < 1) {
      return { ok: false, error: "cooldownSeconds: целое число ≥ 1" };
    }
  }
  return { ok: true };
}
