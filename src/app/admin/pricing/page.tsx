import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import { isAdminPricingPinned } from "@/lib/admin-pricing-pinned";
import { prisma } from "@/lib/prisma";
import { requireAdminPagePermission } from "@/server/guards/admin-page-guard";
import { toggleAiModelActiveAction } from "@/server/actions/ai-model";
import { getCreditsUiFloor } from "@/server/services/pricing";
import { buildGeneralPriceBreakdownV2 } from "@/server/services/unifiedModelPricing";
import { cn } from "@/lib/utils";

export const metadata = { title: "Цены моделей — Админка" };

export default async function AdminPricingPage() {
  await requireAdminPagePermission("models.pricing.manage");

  const models = await prisma.aiModel.findMany({
    orderBy: [{ updatedAt: "desc" }],
    select: {
      id: true,
      name: true,
      slug: true,
      provider: true,
      type: true,
      scope: true,
      isActive: true,
      costCredits: true,
      pricingSchema: true,
      updatedAt: true,
    },
  });

  const rows = models.map((m) => {
    const floor = getCreditsUiFloor({
      costCredits: m.costCredits,
      pricingSchema: m.pricingSchema,
    });
    const pinned = isAdminPricingPinned(m.pricingSchema);

    const generalEconomy =
      m.scope === "GENERAL" &&
      (m.type === "IMAGE" || m.type === "VIDEO")
        ? buildGeneralPriceBreakdownV2(
            {
              id: m.id,
              slug: m.slug,
              name: m.name,
              type: m.type,
              apiModelId: "",
              costCredits: m.costCredits,
              pricingSchema: m.pricingSchema,
            },
            {},
          )
        : null;

    const sampleCredits = generalEconomy?.tokens ?? m.costCredits;

    return {
      id: m.id,
      name: m.name,
      slug: m.slug,
      provider: m.provider,
      type: m.type,
      scope: m.scope,
      isActive: m.isActive,
      floor,
      sampleCredits,
      pinned,
      updatedAt: m.updatedAt.toISOString(),
      providerUsd: generalEconomy?.providerCostUsd ?? null,
      providerKzt: generalEconomy?.providerCostKzt ?? null,
      revenueKzt: generalEconomy?.revenueKzt ?? null,
      marginKzt: generalEconomy?.marginKzt ?? null,
      marginPct: generalEconomy?.marginPercent ?? null,
    };
  });

  function fmtUsd(n: number | null): string {
    if (n == null || !Number.isFinite(n)) return "—";
    return n.toFixed(4);
  }
  function fmtKzt(n: number | null): string {
    if (n == null || !Number.isFinite(n)) return "—";
    return n.toFixed(2);
  }
  function fmtPct(n: number | null): string {
    if (n == null || !Number.isFinite(n)) return "—";
    return `${n.toFixed(1)}%`;
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Цены моделей</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Сводка по БД и пример расчёта для GENERAL (пустые настройки). Детально — вкладка
          модели Pricing Studio или{" "}
          <code className="text-xs">POST /api/admin/models/[id]/pricing/live-preview</code>.
        </p>
      </div>

      <div className="bg-card overflow-x-auto rounded-lg border shadow-sm">
        <table className="w-full min-w-[980px] text-left text-xs">
          <thead className="bg-muted/50 font-medium">
            <tr>
              <th className="p-2">Название</th>
              <th className="p-2">Slug</th>
              <th className="p-2">Провайдер</th>
              <th className="p-2">Тип</th>
              <th className="p-2">Scope</th>
              <th className="p-2">Active</th>
              <th className="p-2 tabular-nums">Min/Floor tok.</th>
              <th className="p-2 tabular-nums">Пример tok.</th>
              <th className="p-2 tabular-nums">$/провайдер*</th>
              <th className="p-2 tabular-nums">Выруч ₸*</th>
              <th className="p-2 tabular-nums">Маржа ₸*</th>
              <th className="p-2 tabular-nums">Маржа %*</th>
              <th className="p-2">Pinned</th>
              <th className="p-2">Обновлено</th>
              <th className="p-2">Действия</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {rows.map((r) => (
              <tr key={r.id} className={cn(!r.isActive && "bg-muted/20 text-muted-foreground")}>
                <td className="p-2 font-medium">{r.name}</td>
                <td className="p-2 font-mono">{r.slug}</td>
                <td className="p-2">{r.provider}</td>
                <td className="p-2">{r.type}</td>
                <td className="p-2">{r.scope}</td>
                <td className="p-2">{r.isActive ? "да" : "нет"}</td>
                <td className="p-2 tabular-nums">{r.floor}</td>
                <td className="p-2 tabular-nums">{r.sampleCredits}</td>
                <td className="p-2 tabular-nums">{fmtUsd(r.providerUsd)}</td>
                <td className="p-2 tabular-nums">{fmtKzt(r.revenueKzt)}</td>
                <td className="p-2 tabular-nums">{fmtKzt(r.marginKzt)}</td>
                <td className="p-2 tabular-nums">{fmtPct(r.marginPct)}</td>
                <td className="p-2">{r.pinned ? "да" : "нет"}</td>
                <td className="p-2 whitespace-nowrap text-[10px]">
                  {r.updatedAt.slice(0, 19).replace("T", " ")}
                </td>
                <td className="p-2">
                  <div className="flex flex-wrap gap-1">
                    <form action={toggleAiModelActiveAction} className="inline">
                      <input type="hidden" name="id" value={r.id} />
                      <input type="hidden" name="nextActive" value={String(!r.isActive)} />
                      <button
                        type="submit"
                        className={cn(
                          buttonVariants({ size: "xs", variant: r.isActive ? "outline" : "secondary" }),
                        )}
                      >
                        {r.isActive ? "Выкл" : "Вкл"}
                      </button>
                    </form>
                    <Link
                      href={`/admin/models/${r.id}/edit`}
                      className={cn(buttonVariants({ size: "xs", variant: "secondary" }), "no-underline")}
                    >
                      Формула / Studio
                    </Link>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-muted-foreground text-[11px]">
        *Колонки USD/₸ маржи считаются для GENERAL только (пример: пустой settings-снимок для
        оценки). Product Card см. финальный estimate и вкладку карточки товара.
      </p>
    </div>
  );
}
