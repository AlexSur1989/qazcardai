"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { Prisma } from "@/generated/prisma/client";
import {
  ADMIN_PRICING_PINNED_KEY,
  withAdminPricingPinned,
} from "@/lib/admin-pricing-pinned";
import { writeAdminAuditLog } from "@/lib/admin-audit";
import { isRecord } from "@/lib/model-pricing-shared";
import { prisma } from "@/lib/prisma";
import type { AiModelFormPayload } from "@/lib/validations/ai-model";
import { parseAiModelFormData } from "@/lib/validations/ai-model";
import {
  defaultAdminLandingPath,
  hasPermission,
} from "@/lib/permissions";
import { getFreshAdminSessionUser } from "@/server/services/fresh-session-user";
import { getAdminRateLimitError } from "@/server/services/rateLimitService";

function isPrismaUnique(e: unknown): boolean {
  return (
    typeof e === "object" &&
    e !== null &&
    "code" in e &&
    (e as { code: string }).code === "P2002"
  );
}

export type AiModelActionState = {
  error?: string;
  fieldErrors?: Record<string, string>;
} | null;

async function getAdminContext(): Promise<{ userId: string }> {
  const current = await getFreshAdminSessionUser();
  if (!current.ok) {
    if (current.reason === "forbidden") {
      redirect("/dashboard");
    }
    redirect("/login?next=/admin/models");
  }
  if (!hasPermission(current.user.role, "models.manage")) {
    redirect(defaultAdminLandingPath(current.user.role));
  }
  return { userId: current.user.id };
}

function jsonIn(v: unknown): Prisma.InputJsonValue | typeof Prisma.JsonNull {
  if (v === null) return Prisma.JsonNull;
  return v as Prisma.InputJsonValue;
}

function toCreateInput(
  d: AiModelFormPayload,
): Prisma.AiModelUncheckedCreateInput {
  return {
    name: d.name,
    slug: d.slug,
    provider: d.provider,
    type: d.type,
    scope: d.scope,
    productCardModelType: d.productCardModelType,
    apiModelId: d.apiModelId,
    endpoint: d.endpoint,
    costCredits: d.costCredits,
    realCost: d.realCost,
    isActive: d.isActive,
    settingsSchema: jsonIn(d.settingsSchema),
    description: d.description,
    supportsImageInput: d.supportsImageInput,
    supportsVideoInput: d.supportsVideoInput,
    supportsNegativePrompt: d.supportsNegativePrompt,
    supportsSeed: d.supportsSeed,
    maxDuration: d.maxDuration,
    availableAspectRatios: jsonIn(d.availableAspectRatios),
    availableResolutions: jsonIn(d.availableResolutions),
  };
}

function toUpdateInput(
  d: AiModelFormPayload,
): Prisma.AiModelUncheckedUpdateInput {
  return {
    name: d.name,
    slug: d.slug,
    provider: d.provider,
    type: d.type,
    scope: d.scope,
    productCardModelType: d.productCardModelType,
    apiModelId: d.apiModelId,
    endpoint: d.endpoint,
    costCredits: d.costCredits,
    realCost: d.realCost,
    isActive: d.isActive,
    settingsSchema: jsonIn(d.settingsSchema),
    description: d.description,
    supportsImageInput: d.supportsImageInput,
    supportsVideoInput: d.supportsVideoInput,
    supportsNegativePrompt: d.supportsNegativePrompt,
    supportsSeed: d.supportsSeed,
    maxDuration: d.maxDuration,
    availableAspectRatios: jsonIn(d.availableAspectRatios),
    availableResolutions: jsonIn(d.availableResolutions),
  };
}

function modelSnapshot(
  m: {
    name: string;
    slug: string;
    provider: string;
    type: string;
    scope: string;
    productCardModelType: string | null;
    apiModelId: string;
    endpoint: string | null;
    costCredits: number;
    realCost: unknown;
    isActive: boolean;
    settingsSchema: unknown;
    description: string | null;
    supportsImageInput: boolean;
    supportsVideoInput: boolean;
    supportsNegativePrompt: boolean;
    supportsSeed: boolean;
    maxDuration: number | null;
    availableAspectRatios: unknown;
    availableResolutions: unknown;
  },
) {
  return {
    name: m.name,
    slug: m.slug,
    provider: m.provider,
    type: m.type,
    scope: m.scope,
    productCardModelType: m.productCardModelType,
    apiModelId: m.apiModelId,
    endpoint: m.endpoint,
    costCredits: m.costCredits,
    realCost:
      m.realCost != null && typeof m.realCost === "object" && "toString" in m.realCost
        ? (m.realCost as { toString: () => string }).toString()
        : m.realCost,
    isActive: m.isActive,
    settingsSchema: m.settingsSchema,
    description: m.description,
    supportsImageInput: m.supportsImageInput,
    supportsVideoInput: m.supportsVideoInput,
    supportsNegativePrompt: m.supportsNegativePrompt,
    supportsSeed: m.supportsSeed,
    maxDuration: m.maxDuration,
    availableAspectRatios: m.availableAspectRatios,
    availableResolutions: m.availableResolutions,
  };
}

export async function createAiModelAction(
  _prev: AiModelActionState,
  formData: FormData,
): Promise<AiModelActionState> {
  const { userId } = await getAdminContext();
  const rateErr = await getAdminRateLimitError(userId);
  if (rateErr) {
    return { error: rateErr };
  }
  const parsed = parseAiModelFormData(formData, "create");
  if (!parsed.ok) {
    return { error: parsed.message, fieldErrors: parsed.fieldErrors };
  }
  try {
    const created = await prisma.aiModel.create({
      data: toCreateInput(parsed.data),
    });
    await writeAdminAuditLog({
      adminUserId: userId,
      action: "model.created",
      targetType: "AiModel",
      targetId: created.id,
      newValue: modelSnapshot(created),
    });
  } catch (e) {
    if (isPrismaUnique(e)) {
      return { error: "Модель с таким slug уже есть" };
    }
    console.error(e);
    return { error: "Не удалось создать запись" };
  }
  revalidatePath("/admin/models");
  revalidatePath("/admin/pricing");
  redirect("/admin/models");
}

export async function updateAiModelAction(
  _prev: AiModelActionState,
  formData: FormData,
): Promise<AiModelActionState> {
  const { userId } = await getAdminContext();
  const rateErr = await getAdminRateLimitError(userId);
  if (rateErr) {
    return { error: rateErr };
  }
  const parsed = parseAiModelFormData(formData, "update");
  if (!parsed.ok) {
    return { error: parsed.message, fieldErrors: parsed.fieldErrors };
  }
  const id = String(formData.get("id") ?? "");
  if (!id) {
    return { error: "Не указан id" };
  }
  const existing = await prisma.aiModel.findUnique({ where: { id } });
  if (!existing) {
    return { error: "Модель не найдена" };
  }
  const oldSnapshot = modelSnapshot(existing);

  function realMoneyString(v: unknown): string {
    if (v == null) return "";
    if (
      typeof v === "object" &&
      v !== null &&
      "toString" in v &&
      typeof (v as { toString: () => string }).toString === "function"
    ) {
      return (v as { toString: () => string }).toString();
    }
    return String(v);
  }

  const creditsChanged = parsed.data.costCredits !== existing.costCredits;
  const realCostChanged =
    realMoneyString(parsed.data.realCost) !== realMoneyString(existing.realCost);
  let pricingPinJson: Prisma.InputJsonValue | undefined;
  if (creditsChanged || realCostChanged) {
    if (existing.pricingSchema != null && isRecord(existing.pricingSchema)) {
      pricingPinJson = withAdminPricingPinned(
        existing.pricingSchema as Record<string, unknown>,
      ) as unknown as Prisma.InputJsonValue;
    } else {
      pricingPinJson = {
        [ADMIN_PRICING_PINNED_KEY]: true,
      } as unknown as Prisma.InputJsonValue;
    }
  }

  try {
    const updated = await prisma.aiModel.update({
      where: { id },
      data: {
        ...toUpdateInput(parsed.data),
        ...(pricingPinJson != null ? { pricingSchema: pricingPinJson } : {}),
      },
    });
    const newSnapshot = modelSnapshot(updated);
    await writeAdminAuditLog({
      adminUserId: userId,
      action: "model.updated",
      targetType: "AiModel",
      targetId: id,
      oldValue: oldSnapshot,
      newValue: newSnapshot,
    });
    const costOld = String(oldSnapshot.costCredits);
    const costNew = String(newSnapshot.costCredits);
    const realOld = String(oldSnapshot.realCost);
    const realNew = String(newSnapshot.realCost);
    if (costOld !== costNew || realOld !== realNew) {
      await writeAdminAuditLog({
        adminUserId: userId,
        action: "model_cost_changed",
        targetType: "AiModel",
        targetId: id,
        oldValue: { costCredits: oldSnapshot.costCredits, realCost: oldSnapshot.realCost },
        newValue: { costCredits: newSnapshot.costCredits, realCost: newSnapshot.realCost },
      });
    }
  } catch (e) {
    if (isPrismaUnique(e)) {
      return { error: "Модель с таким slug уже есть" };
    }
    console.error(e);
    return { error: "Не удалось сохранить" };
  }
  revalidatePath("/admin/models");
  revalidatePath("/admin/pricing");
  revalidatePath(`/admin/models/${id}/edit`);
  return null;
}

export async function deleteAiModelAction(
  _prev: AiModelActionState,
  formData: FormData,
): Promise<AiModelActionState> {
  const { userId } = await getAdminContext();
  const rateErr = await getAdminRateLimitError(userId);
  if (rateErr) {
    return { error: rateErr };
  }
  const id = String(formData.get("id") ?? "");
  if (!id) {
    return { error: "Не указан id" };
  }
  const existing = await prisma.aiModel.findUnique({ where: { id } });
  if (!existing) {
    return { error: "Модель не найдена" };
  }
  const n = await prisma.generation.count({ where: { modelId: id } });
  if (n > 0) {
    return {
      error: `Нельзя удалить: связано ${n} генераций`,
    };
  }
  const snap = modelSnapshot(existing);
  await prisma.aiModel.delete({ where: { id } });
  await writeAdminAuditLog({
    adminUserId: userId,
    action: "model.deleted",
    targetType: "AiModel",
    targetId: id,
    oldValue: snap,
  });
  revalidatePath("/admin/models");
  revalidatePath("/admin/pricing");
  redirect("/admin/models");
}

export async function toggleAiModelActiveAction(formData: FormData): Promise<void> {
  const { userId } = await getAdminContext();
  const rateErr = await getAdminRateLimitError(userId);
  if (rateErr) {
    revalidatePath("/admin/models");
    revalidatePath("/admin/pricing");
    return;
  }
  const id = String(formData.get("id") ?? "");
  const next = String(formData.get("nextActive") ?? "") === "true";
  if (!id) {
    return;
  }
  const existing = await prisma.aiModel.findUnique({ where: { id } });
  if (!existing) {
    return;
  }
  if (existing.isActive === next) {
    revalidatePath("/admin/models");
    revalidatePath("/admin/pricing");
    return;
  }
  const oldSnapshot = modelSnapshot(existing);
  const updated = await prisma.aiModel.update({
    where: { id },
    data: { isActive: next },
  });
  await writeAdminAuditLog({
    adminUserId: userId,
    action: next ? "model_enabled" : "model_disabled",
    targetType: "AiModel",
    targetId: id,
    oldValue: { isActive: oldSnapshot.isActive },
    newValue: { isActive: updated.isActive },
  });
  revalidatePath("/admin/models");
  revalidatePath("/admin/pricing");
}
