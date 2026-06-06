import Link from "next/link";
import { Suspense } from "react";

import { ProductCardAdminAdvancedPanel } from "@/components/admin/product-card-admin-advanced-panel";
import { ProductCardAdminLayout } from "@/components/admin/product-card-admin-layout";
import { ProductCardAdminLinksTab } from "@/components/admin/product-card-admin-links-tab";
import { ProductCardAdminOverview } from "@/components/admin/product-card-admin-overview";
import { ProductCardAdminTextsTab } from "@/components/admin/product-card-admin-texts-tab";
import { ProductCardScenariosForm } from "@/components/admin/product-card-scenarios-form";
import { ProductCardScenariosPanel } from "@/components/admin/product-card-scenarios-panel";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  isProductCardAdvancedTab,
  resolveProductCardTab,
} from "@/lib/product-card-admin-meta";
import { hasPermission, isSuperAdmin } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { requireAdminPagePermission } from "@/server/guards/admin-page-guard";
import { PRODUCT_CARD_SIMPLE_CARD_SETTING_KEYS } from "@/config/simple-product-card-prompts-defaults";
import { getAppSettingsByGroup } from "@/server/services/appSettings";
import {
  calculateProductCardConceptImageCredits,
  calculateProductCardMarketplaceCardCredits,
  calculateProductCardVideoCredits,
  type ProductCardPriceBreakdown,
} from "@/server/services/productCardPricing";
import { getProductCardSettings } from "@/server/services/productCardSettings";

export const metadata = {
  title: "AI-карточки товара — админка",
};

type Props = {
  searchParams?: Promise<{ tab?: string; advanced?: string }>;
};

export default async function AdminProductCardPage({ searchParams }: Props) {
  const adminUser = await requireAdminPagePermission("models.product_card.manage");

  const params = await searchParams;
  const { tab: activeTab, showAdvanced } = resolveProductCardTab({
    tab: params?.tab,
    advanced: params?.advanced,
  });

  const canToggleAdvanced =
    isSuperAdmin(adminUser.role) || adminUser.role === "ADMIN";
  const showAdvancedSection = showAdvanced && canToggleAdvanced;

  const [settingsRows, productSettings, models] = await Promise.all([
    getAppSettingsByGroup("productCard"),
    getProductCardSettings(),
    prisma.aiModel.findMany({
      where: { scope: "PRODUCT_CARD" },
      orderBy: [{ productCardModelType: "asc" }, { name: "asc" }],
    }),
  ]);

  const scenariosSetting = settingsRows.find((row) => row.key === "PRODUCT_CARD_SCENARIOS")?.value;
  const simpleCardPromptsSetting = settingsRows.find(
    (row) => row.key === PRODUCT_CARD_SIMPLE_CARD_SETTING_KEYS.prompts,
  )?.value;
  const canPatchSettings = hasPermission(adminUser.role, "settings.manage");

  const needsTechnicalData = showAdvancedSection && isProductCardAdvancedTab(activeTab);

  let calculatorRows: { label: string; breakdown: ProductCardPriceBreakdown }[] = [];

  if (needsTechnicalData) {
    const activeModels = models.filter((m) => m.isActive);
    const conceptModel = activeModels.find(
      (m) => m.productCardModelType === "PRODUCT_CONCEPT_IMAGE",
    );
    const marketplaceModel = activeModels.find(
      (m) => m.productCardModelType === "PRODUCT_MARKETPLACE_CARD",
    );
    const videoModel = activeModels.find((m) => m.productCardModelType === "PRODUCT_VIDEO");

    const calculatorPromises: Promise<{ label: string; breakdown: ProductCardPriceBreakdown }>[] =
      [];

    if (conceptModel) {
      calculatorPromises.push(
        calculateProductCardConceptImageCredits(conceptModel, { size: "1x1" }).then(
          (breakdown) => ({
            label: "Фото с концепциями · базовый пресет",
            breakdown,
          }),
        ),
      );
    }
    if (marketplaceModel) {
      calculatorPromises.push(
        calculateProductCardMarketplaceCardCredits(marketplaceModel, { cardSize: "square" }).then(
          (breakdown) => ({
            label: "Карточка для маркетплейса · квадрат",
            breakdown,
          }),
        ),
      );
    }
    if (videoModel) {
      calculatorPromises.push(
        calculateProductCardVideoCredits(videoModel, { duration: 5, resolution: "720p" }).then(
          (breakdown) => ({
            label: "Видео товара · 5s 720p",
            breakdown,
          }),
        ),
      );
    }

    calculatorRows = await Promise.all(calculatorPromises);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">AI-карточки товара</h1>
        <p className="text-muted-foreground text-sm">
          Сценарии для клиентов: что включено, как называется и где смотреть цены и генерации.
        </p>
      </div>

      <Alert>
        <AlertTitle>Цены и тарифы</AlertTitle>
        <AlertDescription>
          Этот раздел управляет сценариями AI-карточек товара. Цены редактируются отдельно в{" "}
          <Link href="/admin/pricing" className="underline">
            Цены и тарифы
          </Link>
          .
        </AlertDescription>
      </Alert>

      <Suspense fallback={null}>
        <ProductCardAdminLayout
          activeTab={activeTab}
          showAdvanced={showAdvancedSection}
          canToggleAdvanced={canToggleAdvanced}
        />
      </Suspense>

      {!showAdvancedSection && activeTab === "overview" ? (
        <ProductCardAdminOverview
          scenarios={productSettings.scenarios}
          productCardEnabled={productSettings.enabled}
        />
      ) : null}

      {!showAdvancedSection && activeTab === "scenarios" ? (
        canPatchSettings ? (
          <ProductCardScenariosForm initialJson={scenariosSetting} canPatch={canPatchSettings} />
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>Сценарии AI-карточек товара</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-muted-foreground text-sm">
                Включение и выключение сценариев доступно ниже. Изменение названий для клиента —
                с правом settings.manage.
              </p>
              <ProductCardScenariosPanel
                initial={productSettings.scenarios}
                hideTechnicalIds
              />
            </CardContent>
          </Card>
        )
      ) : null}

      {!showAdvancedSection && activeTab === "texts" ? (
        <ProductCardAdminTextsTab scenarios={productSettings.scenarios} />
      ) : null}

      {!showAdvancedSection && activeTab === "links" ? <ProductCardAdminLinksTab /> : null}

      {showAdvancedSection && isProductCardAdvancedTab(activeTab) ? (
        <ProductCardAdminAdvancedPanel
          tab={activeTab}
          settingsRows={settingsRows}
          productSettings={productSettings}
          models={models}
          calculatorRows={calculatorRows}
          simpleCardPromptsSetting={simpleCardPromptsSetting}
          canPatchSettings={canPatchSettings}
        />
      ) : null}

      {showAdvanced && !canToggleAdvanced ? (
        <Alert>
          <AlertTitle>Расширенные настройки</AlertTitle>
          <AlertDescription>
            Доступ к техническим вкладкам ограничен. Обратитесь к SUPER_ADMIN.
          </AlertDescription>
        </Alert>
      ) : null}
    </div>
  );
}
