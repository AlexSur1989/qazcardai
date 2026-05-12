import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { z } from "zod";

import { setAppSettingFromRegistry } from "@/server/services/appSettings";
import { requireAdminApiPermission } from "@/server/guards/admin-api-permission";

export const dynamic = "force-dynamic";

const toggleSchema = z.object({
  enabled: z.boolean(),
  label: z.string().trim().min(1).max(128),
});

const scenariosBodySchema = z.object({
  scenarios: z.object({
    conceptPhoto: toggleSchema,
    marketplaceCard: toggleSchema,
    cardBuilder: toggleSchema,
    productVideo: toggleSchema,
  }),
});

/** Сохранение PRODUCT_CARD_SCENARIOS без обязательного settings.manage — только доступ к карточке товара. */
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

  const parsed = scenariosBodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "invalid_body" },
      { status: 400 },
    );
  }

  const res = await setAppSettingFromRegistry({
    key: "PRODUCT_CARD_SCENARIOS",
    value: parsed.data.scenarios,
    adminUserId: base.user.id,
  });

  if (!res.ok) {
    const status =
      res.error === "unknown_key"
        ? 404
        : res.error === "read_only" || res.error === "sensitive"
          ? 403
          : 400;
    return NextResponse.json({ error: res.error }, { status });
  }

  revalidatePath("/admin/product-card");
  revalidatePath("/dashboard/create/product-card");
  return NextResponse.json({ ok: true, value: res.newValue });
}
