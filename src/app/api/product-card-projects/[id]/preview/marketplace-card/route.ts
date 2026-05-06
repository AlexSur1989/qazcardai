import { NextResponse } from "next/server";
import { z } from "zod";

import { MARKETPLACE_CARD_STYLES } from "@/config/product-card-categories";
import {
  isProductCardTemplatePresetId,
  isProductCardTypographyPresetId,
} from "@/config/product-card-overlay-presets";
import {
  getMaxJsonBodyBytes,
  rejectOversizedBody,
} from "@/lib/request-body-limits";
import { canAccessAdminPanel } from "@/lib/auth";
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
  subtitle: z.string().max(160).optional().default(""),
  benefits: z
    .union([z.array(z.string().max(80)).max(8), z.string().max(2000)])
    .optional()
    .default(""),
  extraText: z.string().max(200).optional().default(""),
  statsText: z.string().max(120).optional().default(""),
  sizeText: z.string().max(120).optional().default(""),
  style: z
    .string()
    .min(1)
    .refine((s) => styleSet.has(s as (typeof MARKETPLACE_CARD_STYLES)[number]["id"]), "Некорректный стиль"),
  cardSize: z.string().trim().min(1).max(64).optional().default("square"),
  overlayTemplate: z.string().trim().min(1).max(64).optional().default("bottom_panel"),
  templatePreset: z.string().trim().min(1).max(64).optional().default("light_marketplace")
    .refine((s) => isProductCardTemplatePresetId(s), "Некорректный шаблон карточки"),
  typographyPreset: z.string().trim().min(1).max(64).optional().default("classic")
    .refine((s) => isProductCardTypographyPresetId(s), "Некорректная типографика"),
  preserveProductLabel: z.boolean().optional().default(false),
  useIcons: z.boolean().optional().default(true),
  useArrows: z.boolean().optional().default(true),
  useShadows: z.boolean().optional().default(true),
  /** Только для админской сессии: подсветить forbidden/safe zones */
  layoutDebug: z.boolean().optional().default(false),
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

function previewText(value: string, fallback: string): string {
  const trimmed = value.trim();
  return trimmed || fallback;
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
  const benefits = normalizeBenefits(parsed.data.benefits);
  const previewBenefits =
    benefits.length > 0
      ? benefits
      : ["Удобная посадка", "Премиум качество", "Күннен қорғайды", "Жеңіл жақтау"];
  const layoutDebug = parsed.data.layoutDebug === true && canAccessAdminPanel(current.user.role);

  const input = {
    template: parsed.data.overlayTemplate,
    cardSize: size.id,
    outputWidth: size.width,
    outputHeight: size.height,
    aspectRatio: size.aspectRatio,
    productTitle: previewText(parsed.data.productTitle, "Стильные солнцезащитные очки"),
    subtitle: previewText(parsed.data.subtitle, "Классический черный цвет"),
    benefits: previewBenefits,
    extraText: previewText(parsed.data.extraText, "Хит продаж"),
    statsText: previewText(parsed.data.statsText, "UV400"),
    sizeText: previewText(parsed.data.sizeText, "Премиум сапа"),
    style: parsed.data.style,
    templatePreset: parsed.data.templatePreset,
    typographyPreset: parsed.data.typographyPreset,
    overlayVersion: "v2" as const,
    preserveProductLabel: false,
    useIcons: parsed.data.useIcons,
    useArrows: parsed.data.useArrows,
    useShadows: parsed.data.useShadows,
    overlayRenderMode: "preview" as const,
    layoutDebug,
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
