import { NextResponse } from "next/server";
import { z } from "zod";

import { MARKETPLACE_CARD_STYLES } from "@/config/product-card-categories";
import {
  getMaxJsonBodyBytes,
  rejectOversizedBody,
} from "@/lib/request-body-limits";
import { getFreshSessionUser } from "@/server/services/fresh-session-user";
import { resolveMarketplaceCardSize } from "@/server/services/marketplaceCardSizing";
import {
  buildMarketplaceCardOverlaySpec,
  renderMarketplaceCardOverlaySvg,
} from "@/server/services/productCardOverlayRenderer";
import { getOwnedProjectOrNull } from "@/server/services/productCardProjectAccess";
import { getProductCardSettings } from "@/server/services/productCardSettings";

const styleSet = new Set(MARKETPLACE_CARD_STYLES.map((s) => s.id));

const bodySchema = z.object({
  productTitle: z.string().max(120).optional().default(""),
  benefits: z
    .union([z.array(z.string().max(80)).max(8), z.string().max(2000)])
    .optional()
    .default(""),
  extraText: z.string().max(200).optional().default(""),
  style: z
    .string()
    .min(1)
    .refine((s) => styleSet.has(s as (typeof MARKETPLACE_CARD_STYLES)[number]["id"]), "Некорректный стиль"),
  cardSize: z.string().trim().min(1).max(64).optional().default("square"),
  overlayTemplate: z.string().trim().min(1).max(64).optional().default("bottom_panel"),
});

type Ctx = { params: Promise<{ id: string }> };

function normalizeBenefits(raw: string | string[] | undefined): string[] {
  if (raw == null) return [];
  if (Array.isArray(raw)) {
    return raw.map((x) => x.trim()).filter(Boolean).slice(0, 8).map((s) => s.slice(0, 80));
  }
  return raw
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .slice(0, 8)
    .map((s) => s.slice(0, 80));
}

export async function POST(req: Request, ctx: Ctx) {
  const current = await getFreshSessionUser();
  if (!current.ok) {
    return NextResponse.json({ error: "Требуется вход" }, { status: 401 });
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

  const settings = await getProductCardSettings();
  const resolvedSize = resolveMarketplaceCardSize(
    settings.marketplaceCardSizes,
    parsed.data.cardSize,
  );
  if (!resolvedSize.ok) {
    return NextResponse.json({ error: resolvedSize.error }, { status: 400 });
  }

  const size = resolvedSize.size;
  const input = {
    template: parsed.data.overlayTemplate,
    cardSize: size.id,
    outputWidth: size.width,
    outputHeight: size.height,
    aspectRatio: size.aspectRatio,
    productTitle: parsed.data.productTitle.trim(),
    benefits: normalizeBenefits(parsed.data.benefits),
    extraText: parsed.data.extraText.trim(),
    style: parsed.data.style,
  };

  return NextResponse.json({
    svg: renderMarketplaceCardOverlaySvg(input),
    overlay: buildMarketplaceCardOverlaySpec(input),
    size: {
      id: size.id,
      label: size.label,
      width: size.width,
      height: size.height,
      aspectRatio: size.aspectRatio,
      kieAspectRatio: size.kieAspectRatio,
      kieResolution: size.kieResolution,
    },
  });
}
