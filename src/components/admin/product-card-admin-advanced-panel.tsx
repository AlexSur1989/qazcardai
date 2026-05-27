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
import { ProductCardCardBuilderPromptsPanel } from "@/components/admin/product-card-card-builder-prompts-panel";
import { ProductCardSimpleCardPromptsPanel } from "@/components/admin/product-card-simple-card-prompts-panel";
import { ProductCardWebResearchAdminPanel } from "@/components/admin/product-card-web-research-admin-panel";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
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
import type { ProductCardAdvancedTabId } from "@/lib/product-card-admin-meta";
import type { ProductCardWebResearchSettings } from "@/lib/product-card-web-research-config";
import type { ProductCardPriceBreakdown } from "@/server/services/productCardPricing";
import type { ProductCardSettings } from "@/server/services/productCardSettings";
import type { Prisma } from "@/generated/prisma/client";

type AppSettingRow = {
  key: string;
  value: unknown;
  description: string | null;
};

type ModelRow = Prisma.AiModelGetPayload<{
  select: {
    id: true;
    name: true;
    slug: true;
    type: true;
    productCardModelType: true;
    isActive: true;
    pricingSchema: true;
  };
}>;

type CalculatorRow = { label: string; breakdown: ProductCardPriceBreakdown };

type CardBuilderPromptResult =
  | {
      ok: true;
      data: {
        prompt: string;
        promptVersion: string;
        promptMeta: { promptSource: string };
        textLockLevel: string;
        exactTextPhrases: string[];
      };
    }
  | { ok: false; validationErrors: string[] };

type Props = {
  tab: ProductCardAdvancedTabId;
  settingsRows: AppSettingRow[];
  productSettings: ProductCardSettings;
  models: ModelRow[];
  calculatorRows: CalculatorRow[];
  cardBuilderPromptsSetting: unknown;
  simpleCardPromptsSetting: unknown;
  cardBuilderSuperPromptSample: CardBuilderPromptResult;
  canPatchSettings: boolean;
  webResearchSettings: ProductCardWebResearchSettings;
};

function jsonPreview(value: unknown): string {
  if (typeof value === "string") return value;
  return JSON.stringify(value, null, 2);
}

export function ProductCardAdminAdvancedPanel({
  tab,
  settingsRows,
  productSettings,
  models,
  calculatorRows,
  cardBuilderPromptsSetting,
  simpleCardPromptsSetting,
  cardBuilderSuperPromptSample,
  canPatchSettings,
  webResearchSettings,
}: Props) {
  const isPromptTab =
    tab === "prompts" || tab === "card-builder-prompts" || tab === "simple-card-prompts";

  return (
    <div className="space-y-4">
      <Alert variant={isPromptTab ? "destructive" : "default"}>
        <AlertTitle>Расширенные настройки</AlertTitle>
        <AlertDescription>
          {isPromptTab
            ? "Эти настройки влияют на промпты AI. Ошибки могут ухудшить качество генераций."
            : "Расширенные настройки могут повлиять на генерации. Меняйте их только если понимаете последствия."}
        </AlertDescription>
      </Alert>

      {tab === "pricing" ? (
        <Alert>
          <AlertTitle>Цены редактируются в другом разделе</AlertTitle>
          <AlertDescription>
            Клиентские тарифы и matrix pricing — в{" "}
            <Link href="/admin/pricing" className="underline">
              Цены и тарифы
            </Link>
            . Здесь только технический калькулятор для диагностики.
          </AlertDescription>
        </Alert>
      ) : null}

      {tab === "settings" ? (
        <Card>
          <CardHeader>
            <CardTitle>AppSettings · productCard</CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Key</TableHead>
                  <TableHead>Value</TableHead>
                  <TableHead>Description</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {settingsRows.map((s) => (
                  <TableRow key={s.key}>
                    <TableCell className="font-mono text-xs">{s.key}</TableCell>
                    <TableCell className="max-w-md whitespace-pre-wrap font-mono text-xs">
                      {jsonPreview(s.value)}
                    </TableCell>
                    <TableCell className="text-xs">{s.description}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ) : null}

      {tab === "models" ? (
        <Card>
          <CardHeader>
            <CardTitle>Модели scope PRODUCT_CARD</CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Slug</TableHead>
                  <TableHead>productCardModelType</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>pricingSchema</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {models.map((m) => (
                  <TableRow key={m.id}>
                    <TableCell>{m.name}</TableCell>
                    <TableCell className="font-mono text-xs">{m.slug}</TableCell>
                    <TableCell className="font-mono text-xs">{m.productCardModelType}</TableCell>
                    <TableCell>{m.type}</TableCell>
                    <TableCell>
                      <Badge variant={m.isActive ? "default" : "secondary"}>
                        {m.isActive ? "active" : "off"}
                      </Badge>
                    </TableCell>
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

      {tab === "pricing" || tab === "calculator" ? (
        <Card>
          <CardHeader>
            <CardTitle>Технический калькулятор цен</CardTitle>
          </CardHeader>
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
                    <TableCell className="max-w-[min(28rem,55vw)] whitespace-normal text-sm">
                      {label}
                    </TableCell>
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

      {tab === "categories" || tab === "concepts" ? (
        <Card>
          <CardHeader>
            <CardTitle>Справочник категорий и концепций</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-2">
            {PRODUCT_CATEGORY_GROUPS.map((category) => (
              <div key={category.id} className="rounded-lg border p-3">
                <div className="font-medium">{category.label}</div>
                <div className="text-muted-foreground font-mono text-xs">{category.id}</div>
                <div className="mt-2 flex flex-wrap gap-1">
                  {category.concepts.map((concept) => (
                    <Badge key={concept.id} variant="secondary">
                      {concept.label}
                    </Badge>
                  ))}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}

      {tab === "card-builder-prompts" ? (
        <ProductCardCardBuilderPromptsPanel
          initialValue={cardBuilderPromptsSetting ?? null}
          canPatch={canPatchSettings}
        />
      ) : null}

      {tab === "simple-card-prompts" ? (
        <ProductCardSimpleCardPromptsPanel
          initialValue={simpleCardPromptsSetting ?? null}
          canPatch={canPatchSettings}
        />
      ) : null}

      {tab === "web-research" ? (
        <ProductCardWebResearchAdminPanel
          initialSettings={webResearchSettings}
          canEdit={canPatchSettings}
        />
      ) : null}

      {tab === "prompts" ? (
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Server-Only Prompts (legacy)</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <pre className="bg-muted overflow-x-auto rounded-lg p-3 text-xs">
                {BASE_PRODUCT_PHOTO_PROMPT}
              </pre>
              <pre className="bg-muted overflow-x-auto rounded-lg p-3 text-xs">
                {MARKETPLACE_CARD_BASE_PROMPT}
              </pre>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Создать карточку — супер-промпт (отладка)</CardTitle>
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

      {tab === "video" ? (
        <Card>
          <CardHeader>
            <CardTitle>Video presets (техн.)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap gap-2">
              {productSettings.videoPresets.map((preset) => (
                <Badge
                  key={`${preset.duration}-${preset.resolution}-${preset.aspectRatio}`}
                  variant="secondary"
                >
                  {preset.duration}s · {preset.resolution} · {preset.aspectRatio}
                </Badge>
              ))}
            </div>
            <div className="flex flex-wrap gap-2">
              {PRODUCT_VIDEO_MOTION_STYLES.map((style) => (
                <Badge key={style.id}>{style.label}</Badge>
              ))}
            </div>
            <p className="text-muted-foreground text-xs">
              Цены matrix:{" "}
              <Link href="/admin/pricing?tab=video" className="underline">
                /admin/pricing → Видео товара
              </Link>
            </p>
          </CardContent>
        </Card>
      ) : null}

      {tab === "settings" ? (
        <div className="flex flex-wrap gap-2">
          {MARKETPLACE_CARD_STYLES.map((style) => (
            <Badge key={style.id} variant="outline">
              {style.label}
            </Badge>
          ))}
        </div>
      ) : null}

      {tab === "pricing" ? (
        <p className="text-muted-foreground text-xs">
          Manual overrides — в JSON `pricingSchema` моделей. Negative margin блокируется pricing
          engine. Редактирование тарифов для клиента —{" "}
          <Link href="/admin/pricing" className="underline">
            /admin/pricing
          </Link>
          .
        </p>
      ) : null}
    </div>
  );
}
