import { revalidatePath } from "next/cache";

import { writeAdminAuditLog } from "@/lib/admin-audit";
import { isRecord } from "@/lib/model-pricing-shared";
import {
  CARD_BUILDER_PRICING_SETTING_KEY,
  cardBuilderPricingApiToStorage,
  cardBuilderPricingPatchSchema,
  storageToCardBuilderPricingApi,
  type CardBuilderPricingApi,
} from "@/lib/pricing-admin/card-builder";
import {
  KASPI_MANUAL_SETTING_KEY,
  kaspiManualApiToStorage,
  kaspiManualPricingPatchSchema,
  type KaspiManualPricingApi,
} from "@/lib/pricing-admin/kaspi-manual";
import { prisma } from "@/lib/prisma";
import { tokenPackageFormSchema } from "@/lib/validations/token-package";
import { getAppSetting, setAppSettingFromRegistry } from "@/server/services/appSettings";
import { mergeKaspiManualSettings } from "@/server/services/kaspiManualSettings";
import {
  getProductCardSettings,
  type ProductCardCardBuilderPricing,
} from "@/server/services/productCardSettings";

import type { AppSettingMeta } from "@/lib/pricing-admin/types";

export type { AppSettingMeta };

export async function getAppSettingMeta(key: string): Promise<AppSettingMeta | null> {
  const row = await prisma.appSetting.findUnique({
    where: { key },
    select: {
      updatedAt: true,
      editor: { select: { email: true } },
    },
  });
  if (!row) return null;
  return {
    updatedAt: row.updatedAt.toISOString(),
    updatedByEmail: row.editor?.email ?? null,
  };
}

export async function loadCardBuilderPricingForAdmin(): Promise<{
  pricing: CardBuilderPricingApi;
  meta: AppSettingMeta | null;
}> {
  const settings = await getProductCardSettings();
  const meta = await getAppSettingMeta(CARD_BUILDER_PRICING_SETTING_KEY);
  return {
    pricing: storageToCardBuilderPricingApi(settings.cardBuilderPricing),
    meta,
  };
}

export async function saveCardBuilderPricing(args: {
  input: unknown;
  adminUserId: string;
}): Promise<
  | { ok: true; pricing: CardBuilderPricingApi; normalized: ProductCardCardBuilderPricing }
  | { ok: false; error: string; status: number }
> {
  const parsed = cardBuilderPricingPatchSchema.safeParse(args.input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Некорректные данные",
      status: 400,
    };
  }

  const currentRaw = await getAppSetting(CARD_BUILDER_PRICING_SETTING_KEY);
  const preserve = isRecord(currentRaw) ? currentRaw : {};
  const storageValue = cardBuilderPricingApiToStorage(parsed.data, preserve);

  const res = await setAppSettingFromRegistry({
    key: CARD_BUILDER_PRICING_SETTING_KEY,
    value: storageValue,
    adminUserId: args.adminUserId,
  });

  if (!res.ok) {
    return { ok: false, error: res.error, status: 400 };
  }

  const settings = await getProductCardSettings();
  revalidatePath("/admin/pricing");
  revalidatePath("/dashboard/billing");
  revalidatePath("/admin/product-card");

  return {
    ok: true,
    pricing: storageToCardBuilderPricingApi(settings.cardBuilderPricing),
    normalized: settings.cardBuilderPricing,
  };
}

export async function resetCardBuilderPricingToDefault(args: {
  adminUserId: string;
}): Promise<
  | { ok: true; pricing: CardBuilderPricingApi }
  | { ok: false; error: string; status: number }
> {
  const { getRegistryEntry } = await import("@/config/app-settings-registry");
  const def = getRegistryEntry(CARD_BUILDER_PRICING_SETTING_KEY);
  if (!def) {
    return { ok: false, error: "unknown_key", status: 500 };
  }

  const res = await setAppSettingFromRegistry({
    key: CARD_BUILDER_PRICING_SETTING_KEY,
    value: def.defaultValue,
    adminUserId: args.adminUserId,
  });

  if (!res.ok) {
    return { ok: false, error: res.error, status: 400 };
  }

  const settings = await getProductCardSettings();
  revalidatePath("/admin/pricing");
  return { ok: true, pricing: storageToCardBuilderPricingApi(settings.cardBuilderPricing) };
}

export async function loadKaspiManualForAdmin(): Promise<{
  settings: KaspiManualPricingApi;
  meta: AppSettingMeta | null;
}> {
  const merged = await mergeKaspiManualSettings(await getAppSetting(KASPI_MANUAL_SETTING_KEY));
  const meta = await getAppSettingMeta(KASPI_MANUAL_SETTING_KEY);
  return {
    settings: {
      kaspiManualEnabled: merged.kaspiManualEnabled,
      recipientName: merged.recipientName,
      recipientPhone: merged.recipientPhone,
      instructionText: merged.instructionText,
      whatsappEnabled: merged.whatsappEnabled,
      whatsappPhone: merged.whatsappPhone,
      whatsappMessageTemplate: merged.whatsappMessageTemplate,
      requireReceiptUpload: merged.requireReceiptUpload,
      paymentCodePrefix: merged.paymentCodePrefix,
      expiresMinutes: merged.expiresMinutes,
    },
    meta,
  };
}

export async function saveKaspiManualPricing(args: {
  input: unknown;
  adminUserId: string;
}): Promise<
  | { ok: true; settings: KaspiManualPricingApi }
  | { ok: false; error: string; status: number }
> {
  const parsed = kaspiManualPricingPatchSchema.safeParse(args.input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Некорректные данные",
      status: 400,
    };
  }

  const currentRaw = await getAppSetting(KASPI_MANUAL_SETTING_KEY);
  const preserve = isRecord(currentRaw) ? currentRaw : {};
  const storageValue = kaspiManualApiToStorage(parsed.data, preserve);

  const res = await setAppSettingFromRegistry({
    key: KASPI_MANUAL_SETTING_KEY,
    value: storageValue,
    adminUserId: args.adminUserId,
  });

  if (!res.ok) {
    return { ok: false, error: res.error, status: 400 };
  }

  const loaded = await loadKaspiManualForAdmin();
  revalidatePath("/admin/pricing");
  revalidatePath("/dashboard/billing");
  revalidatePath("/admin/settings");

  return { ok: true, settings: loaded.settings };
}

export async function listTokenPackagesForPricingAdmin() {
  return prisma.tokenPackage.findMany({
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      slug: true,
      priceKzt: true,
      baseTokens: true,
      bonusTokens: true,
      totalTokens: true,
      description: true,
      sortOrder: true,
      isActive: true,
      updatedAt: true,
    },
  });
}

export async function createTokenPackageFromApi(args: {
  input: unknown;
  adminUserId: string;
}): Promise<
  | { ok: true; package: { id: string } }
  | { ok: false; error: string; status: number }
> {
  const parsed = tokenPackageFormSchema.safeParse(args.input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Проверьте поля",
      status: 400,
    };
  }
  const d = parsed.data;

  if (d.isActive) {
    const dup = await prisma.tokenPackage.findFirst({
      where: { slug: d.slug, isActive: true },
    });
    if (dup) {
      return { ok: false, error: "Активный пакет с таким slug уже существует", status: 409 };
    }
  }

  try {
    const created = await prisma.tokenPackage.create({
      data: {
        name: d.name,
        slug: d.slug,
        priceKzt: d.priceKzt,
        baseTokens: d.baseTokens,
        bonusTokens: d.bonusTokens,
        totalTokens: d.totalTokens,
        description: d.description ?? null,
        isActive: d.isActive,
        sortOrder: d.sortOrder,
      },
    });
    await writeAdminAuditLog({
      adminUserId: args.adminUserId,
      action: "token_package.created",
      targetType: "TokenPackage",
      targetId: created.id,
      newValue: { slug: d.slug, name: d.name, priceKzt: d.priceKzt },
    });
    revalidatePath("/admin/pricing");
    revalidatePath("/admin/token-packages");
    revalidatePath("/dashboard/billing");
    return { ok: true, package: { id: created.id } };
  } catch (e) {
    if (
      typeof e === "object" &&
      e !== null &&
      "code" in e &&
      (e as { code: string }).code === "P2002"
    ) {
      return { ok: false, error: "Пакет с таким slug уже существует", status: 409 };
    }
    return { ok: false, error: "Не удалось создать пакет", status: 500 };
  }
}

export async function updateTokenPackageFromApi(args: {
  id: string;
  input: unknown;
  adminUserId: string;
}): Promise<{ ok: true } | { ok: false; error: string; status: number }> {
  const parsed = tokenPackageFormSchema.safeParse(args.input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Проверьте поля",
      status: 400,
    };
  }
  const d = parsed.data;

  const before = await prisma.tokenPackage.findUnique({ where: { id: args.id } });
  if (!before) {
    return { ok: false, error: "Пакет не найден", status: 404 };
  }

  if (d.isActive) {
    const dup = await prisma.tokenPackage.findFirst({
      where: { slug: d.slug, isActive: true, NOT: { id: args.id } },
    });
    if (dup) {
      return { ok: false, error: "Активный пакет с таким slug уже существует", status: 409 };
    }
  }

  try {
    await prisma.tokenPackage.update({
      where: { id: args.id },
      data: {
        name: d.name,
        slug: d.slug,
        priceKzt: d.priceKzt,
        baseTokens: d.baseTokens,
        bonusTokens: d.bonusTokens,
        totalTokens: d.totalTokens,
        description: d.description ?? null,
        isActive: d.isActive,
        sortOrder: d.sortOrder,
      },
    });
  } catch (e) {
    if (
      typeof e === "object" &&
      e !== null &&
      "code" in e &&
      (e as { code: string }).code === "P2002"
    ) {
      return { ok: false, error: "Пакет с таким slug уже существует", status: 409 };
    }
    return { ok: false, error: "Не удалось сохранить", status: 500 };
  }

  await writeAdminAuditLog({
    adminUserId: args.adminUserId,
    action: "token_package.updated",
    targetType: "TokenPackage",
    targetId: args.id,
    newValue: {
      name: d.name,
      slug: d.slug,
      priceKzt: d.priceKzt,
      baseTokens: d.baseTokens,
      bonusTokens: d.bonusTokens,
      totalTokens: d.totalTokens,
      isActive: d.isActive,
    },
  });

  revalidatePath("/admin/pricing");
  revalidatePath("/admin/token-packages");
  revalidatePath("/dashboard/billing");
  return { ok: true };
}
