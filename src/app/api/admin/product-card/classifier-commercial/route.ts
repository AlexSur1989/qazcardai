import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { z } from "zod";

import { isProductClassifierAccessMode } from "@/lib/product-classifier-access-mode";
import { setAppSettingFromRegistry } from "@/server/services/appSettings";
import { requireAdminApiPermission } from "@/server/guards/admin-api-permission";
import { isClassifierRuntimeEnabled } from "@/lib/product-classifier-runtime-gate";
import {
  getProductClassifierCommercialSettings,
  validateClassifierCommercialPatch,
} from "@/server/services/productClassifierCommercialSettings";

export const dynamic = "force-dynamic";

const patchSchema = z.object({
  accessMode: z.string().trim().optional(),
  costCredits: z.number().int().optional(),
  dailyLimit: z.number().int().optional(),
  cooldownSeconds: z.number().int().optional(),
});

const COMMERCIAL_KEYS = [
  ["PRODUCT_CLASSIFIER_ACCESS_MODE", "accessMode"],
  ["PRODUCT_CLASSIFIER_COST_CREDITS", "costCredits"],
  ["PRODUCT_CLASSIFIER_DAILY_LIMIT", "dailyLimit"],
  ["PRODUCT_CLASSIFIER_COOLDOWN_SECONDS", "cooldownSeconds"],
] as const;

export async function GET() {
  const gate = await requireAdminApiPermission("models.product_card.manage");
  if (!gate.ok) return gate.response;

  const commercial = await getProductClassifierCommercialSettings();
  return NextResponse.json({
    ok: true,
    runtimeGateEnabled: isClassifierRuntimeEnabled(),
    ...commercial,
  });
}

export async function PATCH(req: Request) {
  const gate = await requireAdminApiPermission("models.product_card.manage");
  if (!gate.ok) return gate.response;

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const parsed = patchSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "invalid_body" },
      { status: 400 },
    );
  }

  if (parsed.data.accessMode !== undefined && !isProductClassifierAccessMode(parsed.data.accessMode)) {
    return NextResponse.json(
      { error: "accessMode: disabled | admin_only | beta_users | all_users" },
      { status: 400 },
    );
  }

  const valid = validateClassifierCommercialPatch(parsed.data);
  if (!valid.ok) {
    return NextResponse.json({ error: valid.error }, { status: 400 });
  }

  for (const [settingKey, bodyKey] of COMMERCIAL_KEYS) {
    const value = parsed.data[bodyKey];
    if (value === undefined) continue;
    const res = await setAppSettingFromRegistry({
      key: settingKey,
      value,
      adminUserId: gate.user.id,
    });
    if (!res.ok) {
      const status =
        res.error === "unknown_key"
          ? 404
          : res.error === "read_only" || res.error === "sensitive"
            ? 403
            : 400;
      return NextResponse.json({ error: res.error, key: settingKey }, { status });
    }
  }

  revalidatePath("/admin/product-card");
  revalidatePath("/dashboard/create/product-card");
  return NextResponse.json({ ok: true });
}
