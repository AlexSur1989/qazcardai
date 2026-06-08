"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { Prisma } from "@/generated/prisma/client";
import { writeAdminAuditLog } from "@/lib/admin-audit";
import {
  buildFixedPricingSchema,
  buildImportMetadata,
  detectFieldsFromKieInput,
  getImportDetectWarnings,
  parseKiePayloadJson,
  resolveImportSupportsImageInput,
  type KieImportBasics,
} from "@/lib/kie-import-wizard";
import { prisma } from "@/lib/prisma";
import {
  defaultAdminLandingPath,
  hasPermission,
} from "@/lib/permissions";
import { getFreshAdminSessionUser } from "@/server/services/fresh-session-user";
import { getAdminRateLimitError } from "@/server/services/rateLimitService";

export type KieImportActionState = {
  error?: string;
  fieldErrors?: Record<string, string>;
} | null;

async function getAdminContext(): Promise<{ userId: string }> {
  const current = await getFreshAdminSessionUser();
  if (!current.ok) {
    if (current.reason === "forbidden") {
      redirect("/dashboard");
    }
    redirect("/login?next=/admin/models/import-kie");
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

function isPrismaUnique(e: unknown): boolean {
  return (
    typeof e === "object" &&
    e !== null &&
    "code" in e &&
    (e as { code: string }).code === "P2002"
  );
}

export async function createKieImportModelAction(
  _prev: KieImportActionState,
  formData: FormData,
): Promise<KieImportActionState> {
  const { userId } = await getAdminContext();
  const rateErr = await getAdminRateLimitError(userId);
  if (rateErr) return { error: rateErr };

  const basics: KieImportBasics = {
    name: String(formData.get("name") ?? "").trim(),
    slug: String(formData.get("slug") ?? "").trim(),
    scope: (String(formData.get("scope") ?? "PRODUCT_CARD") as KieImportBasics["scope"]),
    type: (String(formData.get("type") ?? "IMAGE") as KieImportBasics["type"]),
    productCardModelType:
      formData.get("productCardModelType") &&
      String(formData.get("productCardModelType")) !== ""
        ? (String(formData.get("productCardModelType")) as NonNullable<
            KieImportBasics["productCardModelType"]
          >)
        : null,
    apiModelId: String(formData.get("apiModelId") ?? "").trim(),
    endpoint: String(formData.get("endpoint") ?? "").trim(),
    statusEndpoint: String(formData.get("statusEndpoint") ?? "").trim(),
  };

  const fieldErrors: Record<string, string> = {};
  if (!basics.name) fieldErrors.name = "Укажите название";
  if (!basics.slug) fieldErrors.slug = "Укажите slug";
  if (!basics.apiModelId) fieldErrors.apiModelId = "Укажите Kie Model ID";
  if (basics.scope === "PRODUCT_CARD" && !basics.productCardModelType) {
    fieldErrors.productCardModelType = "Укажите роль Product Card";
  }
  if (Object.keys(fieldErrors).length > 0) {
    return { error: "Заполните обязательные поля", fieldErrors };
  }

  const payloadRaw = String(formData.get("payloadJson") ?? "");
  const parsedPayload = parseKiePayloadJson(payloadRaw);
  if (!parsedPayload.ok) {
    return { error: parsedPayload.error, fieldErrors: { payloadJson: parsedPayload.error } };
  }

  const fixedCredits = Math.max(
    0,
    Math.floor(Number(formData.get("fixedCredits") ?? 0)),
  );

  const detected = detectFieldsFromKieInput(parsedPayload.input);
  const importWarnings = getImportDetectWarnings(
    parsedPayload.input,
    detected,
    basics.productCardModelType,
  );
  const metadata = buildImportMetadata({
    rawPayloadExample: parsedPayload.parsed,
    detectedFields: detected.detectedFields,
    docsUrl: String(formData.get("docsUrl") ?? ""),
    productCardModelType: basics.productCardModelType,
    importWarnings: importWarnings.length > 0 ? importWarnings : undefined,
  });

  const supportsImageInput = resolveImportSupportsImageInput(
    detected,
    basics.productCardModelType,
  );

  try {
    const created = await prisma.aiModel.create({
      data: {
        name: basics.name,
        slug: basics.slug,
        provider: "KIE_AI",
        type: basics.type,
        scope: basics.scope,
        productCardModelType: basics.scope === "PRODUCT_CARD" ? basics.productCardModelType : null,
        apiModelId: basics.apiModelId,
        endpoint: basics.endpoint || null,
        statusEndpoint: basics.statusEndpoint || null,
        costCredits: fixedCredits,
        isActive: false,
        isPublic: false,
        supportsImageInput,
        supportsVideoInput: detected.supportsVideoInput,
        supportsNegativePrompt: detected.supportsNegativePrompt,
        supportsSeed: detected.supportsSeed,
        settingsSchema: jsonIn(detected.settingsSchema),
        payloadMapping: jsonIn(detected.payloadMapping),
        pricingSchema: jsonIn(buildFixedPricingSchema(fixedCredits)),
        metadata: jsonIn(metadata),
      },
    });
    await writeAdminAuditLog({
      adminUserId: userId,
      action: "model.created",
      targetType: "AiModel",
      targetId: created.id,
      newValue: { slug: created.slug, source: "kie-import-wizard" },
    });
  } catch (e) {
    if (isPrismaUnique(e)) {
      return { error: "Модель с таким slug уже есть" };
    }
    console.error(e);
    return { error: "Не удалось создать модель" };
  }

  revalidatePath("/admin/models");
  revalidatePath("/admin/product-card");
  redirect("/admin/models");
}
