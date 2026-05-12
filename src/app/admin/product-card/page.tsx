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
import { ProductCardScenariosForm } from "@/components/admin/product-card-scenarios-form";
import { hasPermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { getAppSettingsByGroup } from "@/server/services/appSettings";
import { requireAdminPagePermission } from "@/server/guards/admin-page-guard";
import {
  calculateProductCardConceptImageCredits,
  calculateProductCardMarketplaceCardCredits,
  calculateProductCardVideoCredits,
} from "@/server/services/productCardPricing";
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
import { cn } from "@/lib/utils";

export const metadata = {
  title: "Product Card — админка",
};

type Props = {
  searchParams?: Promise<{ tab?: string }>;
};

const TABS = [
  ["overview", "Overview"],
  ["settings", "Settings"],
  ["models", "Models"],
  ["pricing", "Pricing"],
  ["categories", "Categories"],
  ["concepts", "Concepts"],
  ["prompts", "Prompts"],
  ["scenarios", "Сценарии"],
  ["video", "Video"],
  ["calculator", "Price Calculator"],
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
  const calculatorPromises = [];
  if (conceptModel) {
    calculatorPromises.push(calculateProductCardConceptImageCredits(conceptModel, { size: "1x1" }));
  }
  if (marketplaceModel) {
    calculatorPromises.push(
      calculateProductCardMarketplaceCardCredits(marketplaceModel, { cardSize: "square" }),
    );
  }
  if (videoModel) {
    calculatorPromises.push(
      calculateProductCardVideoCredits(videoModel, { duration: 5, resolution: "720p" }),
    );
  }
  const calculatorRows = await Promise.all(calculatorPromises);

  const scenariosSetting = settingsRows.find((row) => row.key === "PRODUCT_CARD_SCENARIOS")?.value;
  const canPatchScenarios = hasPermission(adminUser.role, "settings.manage");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Product Card / Карточка товара</h1>
        <p className="text-muted-foreground text-sm">
          Отдельные модели, настройки, pricing и launch checks для Product Card flow.
        </p>
      </div>

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
                <TableRow><TableHead>Scenario</TableHead><TableHead>Model</TableHead><TableHead>Tokens</TableHead><TableHead>Revenue</TableHead><TableHead>Cost</TableHead><TableHead>Margin</TableHead><TableHead>Source</TableHead></TableRow>
              </TableHeader>
              <TableBody>
                {calculatorRows.map((row) => (
                  <TableRow key={`${row.scenario}-${row.modelSlug}`}>
                    <TableCell>{row.scenario}</TableCell>
                    <TableCell className="font-mono text-xs">{row.modelSlug}</TableCell>
                    <TableCell>{row.tokens}</TableCell>
                    <TableCell>{row.revenueKzt.toFixed(0)} KZT</TableCell>
                    <TableCell>{row.providerCostKzt.toFixed(0)} KZT</TableCell>
                    <TableCell>{row.marginKzt.toFixed(0)} KZT</TableCell>
                    <TableCell>{row.priceSource}</TableCell>
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

      {active === "prompts" ? (
        <Card>
          <CardHeader><CardTitle>Server-Only Prompts</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <pre className="bg-muted overflow-x-auto rounded-lg p-3 text-xs">{BASE_PRODUCT_PHOTO_PROMPT}</pre>
            <pre className="bg-muted overflow-x-auto rounded-lg p-3 text-xs">{MARKETPLACE_CARD_BASE_PROMPT}</pre>
          </CardContent>
        </Card>
      ) : null}

      {active === "scenarios" ? (
        <ProductCardScenariosForm initialJson={scenariosSetting} canPatch={canPatchScenarios} />
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
