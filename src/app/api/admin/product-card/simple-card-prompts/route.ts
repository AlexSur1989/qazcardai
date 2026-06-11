import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { z } from "zod";

import { SIMPLE_PRODUCT_CARD_PROMPTS_DEFAULTS } from "@/config/simple-product-card-prompts-defaults";
import { PRODUCT_CARD_SIMPLE_CARD_SETTING_KEYS } from "@/config/simple-product-card-prompts-defaults";
import {
  mergeSimpleProductCardPromptsWithDefaults,
  validateSimpleProductCardPromptsForSave,
} from "@/lib/validations/simple-product-card-prompts-setting";
import { buildSimpleProductCardPrompt } from "@/server/services/simpleProductCardPromptBuilder";
import { requireAdminApiPermission } from "@/server/guards/admin-api-permission";
import { getAppSetting, setAppSettingFromRegistry } from "@/server/services/appSettings";
import { clearSimpleProductCardSettingsCache } from "@/server/services/simpleProductCardSettings";
import { normalizeSimpleCardPayload } from "@/lib/validations/simple-product-card";

export const dynamic = "force-dynamic";

const previewBodySchema = z.object({
  styleMode: z.enum(["classic", "reference", "premium"]).default("classic"),
  useReference: z.boolean().optional().default(false),
  referenceCreativity: z.number().int().min(0).max(100).nullable().optional(),
  userText: z.string().default("Лёгкий и удобный. Подходит для ежедневного использования."),
  aspectRatio: z.enum(["9:16", "3:4", "1:1", "4:3", "16:9"]).default("1:1"),
  promptsOverride: z.record(z.string(), z.unknown()).optional(),
});

export async function GET() {
  const gate = await requireAdminApiPermission("models.product_card.manage");
  if (!gate.ok) return gate.response;

  const raw = await getAppSetting(PRODUCT_CARD_SIMPLE_CARD_SETTING_KEYS.prompts);
  const merged = mergeSimpleProductCardPromptsWithDefaults(raw);

  return NextResponse.json({
    ok: true,
    raw: raw ?? null,
    effective: merged.prompts,
    source: merged.source,
    warnings: merged.warnings,
    defaults: SIMPLE_PRODUCT_CARD_PROMPTS_DEFAULTS,
  });
}

export async function PATCH(req: Request) {
  const gate = await requireAdminApiPermission("settings.manage");
  if (!gate.ok) return gate.response;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  if (!body || typeof body !== "object" || !("value" in body)) {
    return NextResponse.json({ error: "value_required" }, { status: 400 });
  }

  const res = await setAppSettingFromRegistry({
    key: PRODUCT_CARD_SIMPLE_CARD_SETTING_KEYS.prompts,
    value: (body as { value: unknown }).value,
    adminUserId: gate.user.id,
  });

  if (!res.ok) {
    return NextResponse.json({ error: res.error }, { status: 400 });
  }

  clearSimpleProductCardSettingsCache();
  revalidatePath("/admin/product-card");
  revalidatePath("/admin/settings");
  return NextResponse.json({ ok: true, value: res.newValue });
}

export async function POST(req: Request) {
  const gate = await requireAdminApiPermission("models.product_card.manage");
  if (!gate.ok) return gate.response;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const mode =
    body && typeof body === "object" && "mode" in body
      ? String((body as { mode: unknown }).mode)
      : "validate";

  if (mode === "validate") {
    const value =
      body && typeof body === "object" && "value" in body
        ? (body as { value: unknown }).value
        : null;
    const valid = validateSimpleProductCardPromptsForSave(value);
    if (!valid.ok) {
      return NextResponse.json({ ok: false, errors: valid.errors }, { status: 400 });
    }
    return NextResponse.json({ ok: true, warnings: valid.warnings, value: valid.value });
  }

  if (mode === "preview") {
    const parsed = previewBodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues.map((i) => i.message).join("; ") },
        { status: 400 },
      );
    }
    const p = parsed.data;
    let promptsBundle = mergeSimpleProductCardPromptsWithDefaults(null);
    if (p.promptsOverride) {
      promptsBundle = mergeSimpleProductCardPromptsWithDefaults(p.promptsOverride);
    }

    const payload = normalizeSimpleCardPayload({
      productPhotoId: "preview",
      userText: p.userText,
      styleMode: p.styleMode,
      useReference: p.useReference,
      referenceImageId: p.useReference || p.styleMode === "reference" ? "preview-ref" : null,
      referenceCreativity: p.referenceCreativity ?? 50,
      aspectRatio: p.aspectRatio,
      resolution: "1K",
    });

    const built = buildSimpleProductCardPrompt({
      payload,
      prompts: promptsBundle.prompts,
      aspectRatio: p.aspectRatio,
    });

    return NextResponse.json({
      ok: true,
      prompt: built.prompt,
      negativePrompt: built.negativePrompt,
      exactTextPhrases: built.exactTextPhrases,
      usesReference: built.usesReference,
      styleMode: built.styleMode,
      warnings: promptsBundle.warnings,
    });
  }

  return NextResponse.json({ error: "unknown_mode" }, { status: 400 });
}
