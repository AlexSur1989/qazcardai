import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { z } from "zod";

import { setAppSettingFromRegistry } from "@/server/services/appSettings";
import { requireAdminApiPermission } from "@/server/guards/admin-api-permission";

export const dynamic = "force-dynamic";

const bindingsBodySchema = z.object({
  classifierModelSlug: z.string().trim(),
  conceptImageModelSlug: z.string().trim(),
  marketplaceCardModelSlug: z.string().trim(),
  videoModelSlug: z.string().trim(),
});

const BINDING_KEYS = [
  ["PRODUCT_CARD_DEFAULT_CLASSIFIER_MODEL_SLUG", "classifierModelSlug"],
  ["PRODUCT_CARD_DEFAULT_CONCEPT_IMAGE_MODEL_SLUG", "conceptImageModelSlug"],
  ["PRODUCT_CARD_DEFAULT_MARKETPLACE_CARD_MODEL_SLUG", "marketplaceCardModelSlug"],
  ["PRODUCT_CARD_DEFAULT_VIDEO_MODEL_SLUG", "videoModelSlug"],
] as const;

export async function PATCH(req: Request) {
  const base = await requireAdminApiPermission("models.product_card.manage");
  if (!base.ok) {
    return base.response;
  }

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const parsed = bindingsBodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "invalid_body" },
      { status: 400 },
    );
  }

  for (const [settingKey, bodyKey] of BINDING_KEYS) {
    const res = await setAppSettingFromRegistry({
      key: settingKey,
      value: parsed.data[bodyKey],
      adminUserId: base.user.id,
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
