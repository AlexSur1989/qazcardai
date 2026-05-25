import Link from "next/link";

import {
  MARKETPLACE_CARD_STYLES,
  PRODUCT_CATEGORY_GROUPS,
  PRODUCT_VIDEO_MOTION_STYLES,
} from "@/config/product-card-categories";
import {
  BASE_PRODUCT_PHOTO_PROMPT,
  MARKETPLACE_CARD_BASE_PROMPT,
} from "@/config/product-card-prompts";
import { UNIVERSAL_CARD_BUILDER_PROFILE } from "@/config/universal-card-builder-profile";
import { ProductCardScenariosForm } from "@/components/admin/product-card-scenarios-form";
import { ProductCardCardBuilderPromptsPanel } from "@/components/admin/product-card-card-builder-prompts-panel";
import { hasPermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { getAppSettingsByGroup } from "@/server/services/appSettings";
import { requireAdminPagePermission } from "@/server/guards/admin-page-guard";
import {
  buildCardBuilderPriceBreakdown,
  calculateProductCardConceptImageCredits,
  calculateProductCardMarketplaceCardCredits,
  calculateProductCardVideoCredits,
  estimateCardBuilderCharge,
  type ProductCardPriceBreakdown,
} from "@/server/services/productCardPricing";
import { resolveCardBuilderImageModel } from "@/server/services/productCardModelResolver";
import { buildCardBuilderSuperPromptWithAppSettings } from "@/server/services/cardBuilderPromptBuilder";
import { PRODUCT_CARD_CARD_BUILDER_PROMPTS_KEY } from "@/server/services/cardBuilderPromptsSettings";
import { getProductCardSettings } from "@/server/services/productCardSettings";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ProductCardScenariosPanel } from "@/components/admin/product-card-scenarios-panel";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { cn } from "@/lib/utils";

export const metadata = {
  title: "AI-карточки товара — админка",
};

type Props = {
  searchParams?: Promise<{ tab?: string }>;
};

const TABS = [
  ["overview", "Обзор"],
  ["scenarios", "Сценарии"],
  ["settings", "Настройки"],
  ["models", "Модели"],
  ["pricing", "Цены"],
  ["categories", "Категории"],
  ["concepts", "Концепции"],
  ["prompts", "Промпты (legacy)"],
  ["card-builder-prompts", "Промпты «Создать карточку»"],
  ["video", "Видео товара"],
  ["calculator", "Калькулятор цен"],
] as const;

function jsonPreview(value: unknown): string {
  if (typeof value === "string") return value;
  return JSON.stringify(value, null, 2);
}

export default async function AdminProductCardPage({ searchParams }: Props) {
  const adminUser = await requireAdminPagePermission("models.product_card.manage");

  const params = await searchParams;
  const active = TABS.some(([id]) => id === params?.tab) ? params?.tab ?? "overview" : "overview";
  const [settingsRows, productSettings, models] = await Promise.all([
    getAppSettingsByGroup("productCard"),
    getProductCardSettings(),
    prisma.aiModel.findMany({
      where: { scope: "PRODUCT_CARD" },
      orderBy: [{ productCardModelType: "asc" }, { name: "asc" }],
    }),
  ]);

  const activeModels = models.filter((m) => m.isActive);
  const conceptModel = activeModels.find((m) => m.productCardModelType === "PRODUCT_CONCEPT_IMAGE");
  const marketplaceModel = activeModels.find((m) => m.productCardModelType === "PRODUCT_MARKETPLACE_CARD");
  const videoModel = activeModels.find((m) => m.productCardModelType === "PRODUCT_VIDEO");
  type CalculatorRow = { label: string; breakdown: ProductCardPriceBreakdown };

  const calculatorPromises: Promise<CalculatorRow>[] = [];
  if (conceptModel) {
    calculatorPromises.push(
      calculateProductCardConceptImageCredits(conceptModel, { size: "1x1" }).then((breakdown) => ({
        label: "Concept image · базовый пресет",
        breakdown,
      })),
    );
  }
  if (marketplaceModel) {
    calculatorPromises.push(
      calculateProductCardMarketplaceCardCredits(marketplaceModel, { cardSize: "square" }).then(
        (breakdown) => ({
          label: "Marketplace card · квадрат",
          breakdown,
        }),
      ),
    );
  }
  if (videoModel) {
    calculatorPromises.push(
      calculateProductCardVideoCredits(videoModel, { duration: 5, resolution: "720p" }).then(
        (breakdown) => ({
          label: "Video · 5s 720p",
          breakdown,
        }),
      ),
    );
  }

  const resolvedCb = await resolveCardBuilderImageModel();
  const cbModel = resolvedCb?.model ?? null;
  if (cbModel) {
    const pricing = productSettings.cardBuilderPricing;
    calculatorPromises.push(
      buildCardBuilderPriceBreakdown({
        model: cbModel,
        finalCredits: pricing.cardBuilderPlanCredits,
        slideRole: "plan",
      }).then((breakdown) => ({
        label: "Создать карточку · план структуры (cardBuilderPlanCredits)",
        breakdown,
      })),
    );
    calculatorPromises.push(
      estimateCardBuilderCharge(
        "slide",
        cbModel,
        pricing,
        "light_marketplace",
        "medium",
        "main_photo",
        null,
      ).then((breakdown) => ({
        label: "Создать карточку · один слайд (без премиум-множителей)",
        breakdown,
      })),
    );
    calculatorPromises.push(
      estimateCardBuilderCharge(
        "slide",
        cbModel,
        pricing,
        "premium",
        "infographic",
        "benefits_infographic",
        null,
      ).then((breakdown) => ({
        label: "Создать карточку · один слайд (премиум + тяжёлый текст)",
        breakdown,
      })),
    );
    calculatorPromises.push(
      estimateCardBuilderCharge(
        "gallery6",
        cbModel,
        pricing,
        "light_marketplace",
        "medium",
        "gallery_bundle",
        6,
      ).then((breakdown) => ({
        label: "Создать карточку · галерея 6",
        breakdown,
      })),
    );
    calculatorPromises.push(
      estimateCardBuilderCharge(
        "gallery8",
        cbModel,
        pricing,
        "light_marketplace",
        "medium",
        "gallery_bundle",
        8,
      ).then((breakdown) => ({
        label: "Создать карточку · галерея 8",
        breakdown,
      })),
    );
  }

  const calculatorRows = await Promise.all(calculatorPromises);

  const cardBuilderSuperPromptSample = await buildCardBuilderSuperPromptWithAppSettings({
    productTitle: "Қысқы балақлава",
    selectedCategory: "apparel",
    marketplace: "other",
    targetPlatform: "universal",
    marketplaceProfile: UNIVERSAL_CARD_BUILDER_PROFILE,
    slideRole: "benefits_infographic",
    templateId: "benefits_grid",
    layoutPreset: "product_right_text_left",
    cardBuilderCategoryKey: "food_grocery",
    visualStyle: "clean_minimal",
    productNameGuess: "Балақлава",
    productFacts: [
      {
        id: "fact_1",
        label: "Состав",
        value: "Миндаль, мёд",
        type: "ingredient",
        source: "vision_ai",
        lockedText: true,
        visibleOnCard: true,
      },
    ],
    audience: "mass_market",
    priceSegment: "middle",
    salesStyle: "infographic",
    textDensity: "medium",
    preserveProduct: true,
    preserveAspects: ["shape", "color"],
    allowCreativeStylization: false,
    languageMode: "auto",
  });

  const scenariosSetting = settingsRows.find((row) => row.key === "PRODUCT_CARD_SCENARIOS")?.value;
  const cardBuilderPromptsSetting = settingsRows.find(
    (row) => row.key === PRODUCT_CARD_CARD_BUILDER_PROMPTS_KEY,
  )?.value;
  const canPatchSettings = hasPermission(adminUser.role, "settings.manage");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">AI-карточки товара</h1>
        <p className="text-muted-foreground text-sm">
          Раздел для сценариев AI-карточек товара: модели, промпты и диагностика.
        </p>
      </div>

      <Alert>
        <AlertTitle>Цены и тарифы</AlertTitle>
        <AlertDescription>
          Цены для клиентов редактируются в{" "}
          <Link href="/admin/pricing" className="underline">
            Цены и тарифы
          </Link>
          , а не в этом разделе.
        </AlertDescription>
      </Alert>

      <div className="flex flex-wrap gap-2">
        {TABS.map(([id, label]) => (
          <Link
            key={id}
            href={`/admin/product-card?tab=${id}`}
            className={cn(
              "rounded-full border px-3 py-1 text-xs",
              active === id
                ? "bg-primary text-primary-foreground border-primary"
                : "border-border bg-background text-foreground",
            )}
          >
            {label}
          </Link>
        ))}
      </div>

      {active === "scenarios" ? (
        canPatchSettings ? (
          <ProductCardScenariosForm initialJson={scenariosSetting} canPatch={canPatchSettings} />
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>Сценарии AI-карточек</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-muted-foreground text-sm">
                Редактирование подписей вкладок доступно с правом «Настройки — изменение». Ниже можно
                включать и выключать сценарии без этого права.
              </p>
              <ProductCardScenariosPanel initial={productSettings.scenarios} />
            </CardContent>
          </Card>
        )
      ) : null}

      {active === "overview" ? (
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader><CardTitle className="text-sm">Settings</CardTitle></CardHeader>
            <CardContent className="text-sm">
              {productSettings.enabled ? "Включено" : "Выключено"} · max source images:{" "}
              {productSettings.maxSourceImages}
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="text-sm">Models</CardTitle></CardHeader>
            <CardContent className="text-sm">
              {activeModels.length} active / {models.length} total Product Card models
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="text-sm">Pricing</CardTitle></CardHeader>
            <CardContent className="text-sm">
              token {productSettings.tokenValueKzt} KZT · USD/KZT {productSettings.usdToKzt}
            </CardContent>
          </Card>
        </div>
      ) : null}

      {active === "settings" ? (
        <Card>
          <CardHeader><CardTitle>Product Card Settings</CardTitle></CardHeader>
          <CardContent className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow><TableHead>Key</TableHead><TableHead>Value</TableHead><TableHead>Description</TableHead></TableRow>
              </TableHeader>
              <TableBody>
                {settingsRows.map((s) => (
                  <TableRow key={s.key}>
                    <TableCell className="font-mono text-xs">{s.key}</TableCell>
                    <TableCell className="max-w-md whitespace-pre-wrap font-mono text-xs">{jsonPreview(s.value)}</TableCell>
                    <TableCell className="text-xs">{s.description}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ) : null}

      {active === "models" ? (
        <Card>
          <CardHeader><CardTitle>Product Card Models</CardTitle></CardHeader>
          <CardContent className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead><TableHead>Slug</TableHead><TableHead>Role</TableHead><TableHead>Type</TableHead><TableHead>Status</TableHead><TableHead>Pricing</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {models.map((m) => (
                  <TableRow key={m.id}>
                    <TableCell>{m.name}</TableCell>
                    <TableCell className="font-mono text-xs">{m.slug}</TableCell>
                    <TableCell className="font-mono text-xs">{m.productCardModelType}</TableCell>
                    <TableCell>{m.type}</TableCell>
                    <TableCell><Badge variant={m.isActive ? "default" : "secondary"}>{m.isActive ? "active" : "off"}</Badge></TableCell>
                    <TableCell className="font-mono text-xs">
                      {m.pricingSchema && typeof m.pricingSchema === "object"
                        ? (m.pricingSchema as { type?: unknown }).type?.toString() ?? "json"
                        : "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ) : null}

      {active === "pricing" || active === "calculator" ? (
        <Card>
          <CardHeader><CardTitle>Product Card Pricing Studio</CardTitle></CardHeader>
          <CardContent className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Сценарий / пресет</TableHead>
                  <TableHead>scenario</TableHead>
                  <TableHead>Model</TableHead>
                  <TableHead>Tokens</TableHead>
                  <TableHead>Revenue</TableHead>
                  <TableHead>Cost</TableHead>
                  <TableHead>Margin</TableHead>
                  <TableHead>Source</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {calculatorRows.map(({ label, breakdown }) => (
                  <TableRow key={`${label}-${breakdown.modelSlug}`}>
                    <TableCell className="max-w-[min(28rem,55vw)] whitespace-normal text-sm">{label}</TableCell>
                    <TableCell className="font-mono text-xs">{breakdown.scenario}</TableCell>
                    <TableCell className="font-mono text-xs">{breakdown.modelSlug}</TableCell>
                    <TableCell>{breakdown.tokens}</TableCell>
                    <TableCell>{breakdown.revenueKzt.toFixed(0)} KZT</TableCell>
                    <TableCell>{breakdown.providerCostKzt.toFixed(0)} KZT</TableCell>
                    <TableCell>{breakdown.marginKzt.toFixed(0)} KZT</TableCell>
                    <TableCell>{breakdown.priceSource}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ) : null}

      {active === "categories" || active === "concepts" ? (
        <Card>
          <CardHeader><CardTitle>Categories And Concepts</CardTitle></CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-2">
            {PRODUCT_CATEGORY_GROUPS.map((category) => (
              <div key={category.id} className="rounded-lg border p-3">
                <div className="font-medium">{category.label}</div>
                <div className="text-muted-foreground text-xs">{category.id}</div>
                <div className="mt-2 flex flex-wrap gap-1">
                  {category.concepts.map((concept) => (
                    <Badge key={concept.id} variant="secondary">{concept.label}</Badge>
                  ))}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}

      {active === "card-builder-prompts" ? (
        <ProductCardCardBuilderPromptsPanel
          initialValue={cardBuilderPromptsSetting ?? null}
          canPatch={canPatchSettings}
        />
      ) : null}

      {active === "prompts" ? (
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Server-Only Prompts</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <pre className="bg-muted overflow-x-auto rounded-lg p-3 text-xs">{BASE_PRODUCT_PHOTO_PROMPT}</pre>
              <pre className="bg-muted overflow-x-auto rounded-lg p-3 text-xs">{MARKETPLACE_CARD_BASE_PROMPT}</pre>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Создать карточку — супер-промпт (отладка)</CardTitle>
              <p className="text-muted-foreground text-sm">
                Пример сборки для Kie; на дашборде пользователю не показывается.
              </p>
            </CardHeader>
            <CardContent className="space-y-2">
              {cardBuilderSuperPromptSample.ok ? (
                <>
                  <div className="text-muted-foreground text-xs">
                    {cardBuilderSuperPromptSample.data.promptVersion} ·{" "}
                    {cardBuilderSuperPromptSample.data.promptMeta.promptSource} ·{" "}
                    {cardBuilderSuperPromptSample.data.textLockLevel} · фразы:{" "}
                    {cardBuilderSuperPromptSample.data.exactTextPhrases.join(" | ")}
                  </div>
                  <pre className="bg-muted max-h-[28rem] overflow-auto rounded-lg p-3 text-xs whitespace-pre-wrap">
                    {cardBuilderSuperPromptSample.data.prompt}
                  </pre>
                </>
              ) : (
                <pre className="bg-destructive/10 rounded-lg p-3 text-xs">
                  {cardBuilderSuperPromptSample.validationErrors.join("\n")}
                </pre>
              )}
            </CardContent>
          </Card>
        </div>
      ) : null}

      {active === "video" ? (
        <Card>
          <CardHeader><CardTitle>Video Presets</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap gap-2">
              {productSettings.videoPresets.map((preset) => (
                <Badge key={`${preset.duration}-${preset.resolution}-${preset.aspectRatio}`} variant="secondary">
                  {preset.duration}s · {preset.resolution} · {preset.aspectRatio}
                </Badge>
              ))}
            </div>
            <div className="flex flex-wrap gap-2">
              {PRODUCT_VIDEO_MOTION_STYLES.map((style) => (
                <Badge key={style.id}>{style.label}</Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      ) : null}

      {active === "categories" ? null : active === "concepts" ? null : active === "video" ? null : null}
      {active === "pricing" ? (
        <p className="text-muted-foreground text-xs">
          Manual overrides редактируются в JSON `pricingSchema` моделей Product Card. Negative margin блокируется backend pricing engine.
        </p>
      ) : null}
      {active === "overview" ? (
        <div className="flex flex-wrap gap-2">
          {MARKETPLACE_CARD_STYLES.map((style) => (
            <Badge key={style.id} variant="outline">{style.label}</Badge>
          ))}
        </div>
      ) : null}
    </div>
  );
}
