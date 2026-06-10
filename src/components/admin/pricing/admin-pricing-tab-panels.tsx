import Link from "next/link";

import { ManualTopUpPricingEditor } from "@/components/admin/pricing/manual-topup-pricing-editor";
import { AdminPricingModelsTable } from "@/components/admin/pricing/admin-pricing-models-table";
import { TokenPackagesPricingEditor } from "@/components/admin/pricing/token-packages-pricing-editor";
import { ProductCardVideoPricingEditor } from "@/components/admin/pricing/product-card-video-pricing-editor";
import { AdminVideoPricingCalculator } from "@/components/admin/pricing/video-calculator";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type {
  AdminPricingOverviewData,
  AdminPricingTabId,
  AdminPricingWarning,
} from "@/server/services/adminPricingOverview";
import type { KaspiManualPricingApi } from "@/lib/pricing-admin/kaspi-manual";
import type { ProductCardVideoPricingApi } from "@/lib/pricing-admin/product-card-video";
import type { ProductCardVideoMatrixCellPreview } from "@/lib/pricing-admin/product-card-video";
import type { AppSettingMeta } from "@/lib/pricing-admin/types";
import { InfoTooltip, LabelWithInfoTooltip } from "@/components/ui/info-tooltip";
import { cn } from "@/lib/utils";

function statusBadge(status: string) {
  const map: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
    active: "default",
    disabled: "secondary",
    partial: "outline",
    missing: "destructive",
  };
  const labels: Record<string, string> = {
    active: "Активен",
    disabled: "Выключен",
    partial: "Частично",
    missing: "Не настроен",
  };
  return (
    <Badge variant={map[status] ?? "outline"}>{labels[status] ?? status}</Badge>
  );
}

function warningSeverityVariant(s: AdminPricingWarning["severity"]) {
  if (s === "error") return "destructive" as const;
  return "default" as const;
}

type PricingEditPermissions = {
  tokenPackages: boolean;
  manualTopUp: boolean;
  productCardVideo: boolean;
};

type PricingEditorProps = {
  kaspi: { settings: KaspiManualPricingApi; meta: AppSettingMeta | null };
  productCardVideo: {
    pricing: ProductCardVideoPricingApi | null;
    formula: string;
    cellPreviews: ProductCardVideoMatrixCellPreview[];
  };
};

type Props = {
  tab: AdminPricingTabId;
  data: AdminPricingOverviewData;
  editPermissions?: PricingEditPermissions;
  editor?: PricingEditorProps;
};

export function AdminPricingTabPanels({
  tab,
  data,
  editPermissions,
  editor,
}: Props) {
  const perms = editPermissions ?? {
    tokenPackages: false,
    manualTopUp: false,
    productCardVideo: false,
  };

  if (tab === "overview") {
    return (
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Экономика токена</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
            <p>
              GLOBAL token value:{" "}
              <strong>{data.economics.globalTokenValueKzt ?? "—"} ₸</strong>
            </p>
            <p>
              Product Card token value:{" "}
              <strong>{data.economics.productCardTokenValueKzt} ₸</strong>
            </p>
            <p>
              USD/KZT (global / PC):{" "}
              <strong>
                {data.economics.usdToKzt} / {data.economics.productCardUsdToKzt}
              </strong>
            </p>
            <p>
              Markup (global / PC):{" "}
              <strong>
                {data.economics.defaultMarkupPercent ?? "—"}% /{" "}
                {data.economics.productCardMarkupPercent}%
              </strong>
            </p>
            <p className="inline-flex flex-wrap items-center gap-1">
              <span>1 credit ≈ $0.005 USD</span>
              <InfoTooltip content="Внутренний курс токена для расчёта себестоимости." />
            </p>
          </CardContent>
        </Card>
        {data.economics.tokenValuesDiffer ? (
          <Alert variant="destructive">
            <AlertTitle>Разные стоимости токена</AlertTitle>
            <AlertDescription>
              GLOBAL TOKEN_VALUE_KZT и Product Card token value не совпадают — маржа в разных
              разделах считается по-разному.
            </AlertDescription>
          </Alert>
        ) : null}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {data.scenarioCards.map((c) => (
            <Card key={c.id}>
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="text-base">{c.label}</CardTitle>
                  {statusBadge(c.status)}
                </div>
                <CardDescription className="text-xs">{c.priceSource}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <p>
                  Мин.:{" "}
                  <strong>{c.minCredits != null ? `${c.minCredits} ток.` : "—"}</strong>
                </p>
                <p>
                  Пример:{" "}
                  <strong>{c.sampleCredits != null ? `${c.sampleCredits} ток.` : "—"}</strong>
                </p>
                {c.warningCount > 0 ? (
                  <p className="text-amber-600 text-xs">⚠ {c.warningCount} warning(s)</p>
                ) : null}
                <Link
                  href={`/admin/pricing?tab=${c.tab}`}
                  className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
                >
                  Открыть
                </Link>
              </CardContent>
            </Card>
          ))}
        </div>
        <p className="text-muted-foreground text-xs">
          Обзор read-only. Редактирование пакетов и Kaspi/WhatsApp — на вкладке «Пополнение» (при
          наличии прав).
        </p>
      </div>
    );
  }

  if (tab === "models") {
    return (
      <div className="space-y-4">
        <p className="text-muted-foreground text-sm">
          Сводка по моделям. Редактирование — в Pricing Studio на странице модели.
        </p>
        <AdminPricingModelsTable models={data.models} />
      </div>
    );
  }

  if (tab === "marketplace") {
    return (
      <div className="space-y-6">
        {data.marketplaceModel ? (
          <p className="text-sm">
            Модель: <strong>{data.marketplaceModel.name}</strong> (
            <code className="text-xs">{data.marketplaceModel.slug}</code>)
          </p>
        ) : (
          <Alert variant="destructive">
            <AlertDescription>Модель marketplace не настроена.</AlertDescription>
          </Alert>
        )}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Формула</CardTitle>
            <CardDescription>
              max(minTokens, ceil(entryTokens × multipliers)); bundle по variantsBundleByCount или
              linear × N
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Вариантов</TableHead>
                  <TableHead>Токены</TableHead>
                  <TableHead>Формула</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.marketplaceSamples.map((s) => (
                  <TableRow key={s.variantCount}>
                    <TableCell>{s.variantCount}</TableCell>
                    <TableCell className="font-medium tabular-nums">{s.credits}</TableCell>
                    <TableCell className="font-mono text-xs">{s.formula}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
        {data.marketplaceModel ? (
          <Link
            href={`/admin/models/${data.marketplaceModel.id}/edit`}
            className={cn(buttonVariants({ variant: "default", size: "sm" }))}
          >
            Редактировать pricing модели
          </Link>
        ) : null}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Не влияет на цену</CardTitle>
          </CardHeader>
          <CardContent className="text-muted-foreground text-sm">
            {data.notAffectingPrice.find((x) => x.scenario === "Карточка товара")?.items.join(", ")}
          </CardContent>
        </Card>
      </div>
    );
  }

  if (tab === "video") {
    const generalVideoModels = data.models
      .filter((m) => m.scope === "GENERAL" && m.type === "VIDEO" && m.isActive)
      .map((m) => ({ id: m.id, name: m.name, slug: m.slug, scenario: "general" as const }));
    const productVideoModels = data.productVideoModel
      ? [
          {
            id: data.productVideoModel.id,
            name: data.productVideoModel.name,
            slug: data.productVideoModel.slug,
            scenario: "product" as const,
          },
        ]
      : [];

    return (
      <div className="space-y-6">
        <h2 className="text-lg font-medium">A. AI-видео (GENERAL)</h2>
        {data.generalVideoMatrices.length === 0 ? (
          <p className="text-muted-foreground text-sm">Нет активных GENERAL VIDEO моделей с matrix.</p>
        ) : (
          data.generalVideoMatrices.map((m) => (
            <Card key={m.modelId}>
              <CardHeader>
                <CardTitle className="text-base">{m.modelName}</CardTitle>
                <CardDescription>
                  {m.pricingSchemaType}
                  {m.matrixKeyStrategy ? ` · ${m.matrixKeyStrategy}` : ""}
                </CardDescription>
              </CardHeader>
              <CardContent className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Label</TableHead>
                      <TableHead>Resolution</TableHead>
                      <TableHead>Duration</TableHead>
                      <TableHead className="text-right">
                        <LabelWithInfoTooltip
                          label="Credits"
                          tooltip="Сколько токенов списывается за одну генерацию."
                          align="end"
                        />
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {m.cells.map((c, i) => (
                      <TableRow key={i}>
                        <TableCell>{c.label}</TableCell>
                        <TableCell>{c.resolution}</TableCell>
                        <TableCell>{String(c.duration)}</TableCell>
                        <TableCell className="text-right tabular-nums">{c.credits}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          ))
        )}

        <h2 className="text-lg font-medium">B. Видео товара (Product Card)</h2>
        <ProductCardVideoPricingEditor
          initialPricing={editor?.productCardVideo?.pricing ?? null}
          initialFormula={editor?.productCardVideo?.formula ?? ""}
          initialCellPreviews={editor?.productCardVideo?.cellPreviews ?? []}
          canEdit={perms.productCardVideo}
        />

        <AdminVideoPricingCalculator
          generalModels={generalVideoModels}
          productModels={productVideoModels}
        />
      </div>
    );
  }

  if (tab === "concepts") {
    return (
      <div className="space-y-6">
        {data.conceptModel ? (
          <p className="text-sm">
            Модель: <strong>{data.conceptModel.name}</strong>
          </p>
        ) : (
          <Alert variant="destructive">
            <AlertDescription>Модель concept photo не настроена.</AlertDescription>
          </Alert>
        )}
        {data.conceptSample ? (
          <Card>
            <CardContent className="pt-6 text-sm space-y-2">
              <p>
                Базовая цена (1x1): <strong>{data.conceptSample.credits} ток.</strong>
              </p>
              <p>Минимум: {data.conceptSample.minCredits} ток.</p>
              <p className="font-mono text-xs">{data.conceptSample.formula}</p>
            </CardContent>
          </Card>
        ) : null}
        <p className="text-muted-foreground text-sm">
          Size presets:{" "}
          {data.productCardSettings.conceptImageSizes.map((s) => s.id).join(", ")}
        </p>
        {data.conceptModel ? (
          <Link
            href={`/admin/models/${data.conceptModel.id}/edit`}
            className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
          >
            Редактировать pricing модели
          </Link>
        ) : null}
      </div>
    );
  }

  if (tab === "topup") {
    const kaspi = editor?.kaspi ?? {
      settings: {
        kaspiManualEnabled: false,
        recipientName: data.manualTopUp.recipientName,
        recipientPhone: "",
        instructionText: "",
        whatsappEnabled: data.manualTopUp.whatsappEnabled,
        whatsappPhone: "",
        whatsappMessageTemplate: "",
      },
      meta: null,
    };

    return (
      <div className="space-y-6">
        <TokenPackagesPricingEditor
          key={data.tokenPackages.map((p) => `${p.id}:${p.priceKzt}:${p.isActive}`).join(",")}
          initialPackages={data.tokenPackages}
          canEdit={perms.tokenPackages}
          priceWarnings={data.tokenPackagePriceWarnings}
        />
        <ManualTopUpPricingEditor
          key={kaspi.meta?.updatedAt ?? kaspi.settings.recipientPhone}
          initialSettings={kaspi.settings}
          meta={kaspi.meta}
          canEdit={perms.manualTopUp}
        />
        <div className="flex flex-wrap gap-2">
          <Link href="/admin/payments/manual" className={cn(buttonVariants({ size: "sm" }))}>
            Ручные заявки
          </Link>
          <Link
            href="/admin/token-packages"
            className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
          >
            Полный UI пакетов
          </Link>
        </div>
      </div>
    );
  }

  if (tab === "warnings") {
    return (
      <div className="space-y-3">
        {data.warnings.length === 0 ? (
          <p className="text-muted-foreground text-sm">Критичных предупреждений не найдено.</p>
        ) : (
          data.warnings.map((w) => (
            <Alert key={w.id} variant={warningSeverityVariant(w.severity)}>
              <AlertTitle className="flex items-center gap-2">
                {w.title}
                <Badge variant="outline">{w.severity}</Badge>
              </AlertTitle>
              <AlertDescription>{w.detail}</AlertDescription>
              {w.tab ? (
                <Link
                  href={`/admin/pricing?tab=${w.tab}`}
                  className={cn(buttonVariants({ variant: "link", size: "sm" }), "mt-2 px-0")}
                >
                  Перейти к разделу
                </Link>
              ) : null}
            </Alert>
          ))
        )}
        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="text-base">Справка</CardTitle>
          </CardHeader>
          <CardContent className="text-muted-foreground space-y-2 text-sm">
            <p>Product Card pricing редактируется на вкладках сценариев и в Pricing Studio моделей.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return null;
}
