import { NextResponse } from "next/server";
import { z } from "zod";

import {
  getMaxJsonBodyBytes,
  rejectOversizedBody,
} from "@/lib/request-body-limits";
import { getFreshSessionUser } from "@/server/services/fresh-session-user";
import { assertCardBuilderScenarioEnabled } from "@/server/services/productCardCardBuilderGeneration";
import { getOwnedProjectOrNull } from "@/server/services/productCardProjectAccess";
import {
  listCardBuilderStyleReferenceAssets,
  saveCardBuilderStyleReference,
} from "@/server/services/cardBuilderStyleReferenceSettings";

type Ctx = { params: Promise<{ id: string }> };

const bodySchema = z
  .object({
    enabled: z.boolean().optional().default(false),
    referenceAssetIds: z.array(z.string().trim().min(1).max(96)).max(3).optional().default([]),
    strength: z.enum(["low", "medium", "high"]).optional().default("medium"),
    useComposition: z.boolean().optional().default(true),
    useBackground: z.boolean().optional().default(true),
    useColors: z.boolean().optional().default(true),
    useTypography: z.boolean().optional().default(true),
    useBadges: z.boolean().optional().default(true),
    useIcons: z.boolean().optional().default(true),
    useMood: z.boolean().optional().default(true),
    useOverallPresentation: z.boolean().optional().default(true),
  })
  .strict();

export const dynamic = "force-dynamic";

export async function GET(_req: Request, ctx: Ctx) {
  const current = await getFreshSessionUser();
  if (!current.ok) {
    if (current.reason === "inactive") {
      return NextResponse.json({ error: "Аккаунт недоступен" }, { status: 403 });
    }
    return NextResponse.json({ error: "Требуется вход" }, { status: 401 });
  }

  const gate = await assertCardBuilderScenarioEnabled();
  if (!gate.ok) {
    return NextResponse.json({ error: gate.error, code: gate.code }, { status: gate.status });
  }

  const { id } = await ctx.params;
  const project = await getOwnedProjectOrNull(current.user.id, id);
  if (!project) {
    return NextResponse.json({ error: "Проект не найден" }, { status: 404 });
  }

  const sp = new URL(_req.url).searchParams;
  const ids = sp.getAll("id").flatMap((x) => x.split(",")).map((x) => x.trim()).filter(Boolean);
  const assets = await listCardBuilderStyleReferenceAssets(current.user.id, ids.slice(0, 3));
  return NextResponse.json({ assets });
}

export async function POST(req: Request, ctx: Ctx) {
  const current = await getFreshSessionUser();
  if (!current.ok) {
    if (current.reason === "inactive") {
      return NextResponse.json({ error: "Аккаунт недоступен" }, { status: 403 });
    }
    return NextResponse.json({ error: "Требуется вход" }, { status: 401 });
  }

  const gate = await assertCardBuilderScenarioEnabled();
  if (!gate.ok) {
    return NextResponse.json({ error: gate.error, code: gate.code }, { status: gate.status });
  }

  const tooLarge = rejectOversizedBody(req, getMaxJsonBodyBytes());
  if (tooLarge) return tooLarge;

  const { id } = await ctx.params;
  const project = await getOwnedProjectOrNull(current.user.id, id);
  if (!project) {
    return NextResponse.json({ error: "Проект не найден" }, { status: 404 });
  }

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "Некорректный JSON" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Некорректные данные" },
      { status: 400 },
    );
  }

  const data = parsed.data;
  const hasRefs = data.enabled && data.referenceAssetIds.length > 0;
  await saveCardBuilderStyleReference(
    id,
    hasRefs
      ? {
          enabled: true,
          referenceAssetIds: data.referenceAssetIds,
          strength: data.strength,
          useComposition: data.useComposition,
          useBackground: data.useBackground,
          useColors: data.useColors,
          useTypography: data.useTypography,
          useBadges: data.useBadges,
          useIcons: data.useIcons,
          useMood: data.useMood,
          useOverallPresentation: data.useOverallPresentation,
        }
      : null,
  );

  return NextResponse.json({ ok: true });
}
