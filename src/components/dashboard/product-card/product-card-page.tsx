"use client";

import { useMemo, useState } from "react";
import { AlertTriangle } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getPublicProductCategories } from "@/config/product-card-categories";
import { getManualProductCategoryLabel } from "@/config/product-card-manual-categories";
import type {
  ProductCardScenarioKey,
  ProductCardScenarioToggles,
} from "@/server/services/productCardSettings";
import type { ProductCardModelSlotDiagnostics } from "@/server/services/productCardModelSetup";
import type { ClassifierAccessForUser } from "@/server/services/productClassifierCommercialSettings";

import { ScenarioSetupNotice } from "./scenario-setup-notice";

import { SimpleProductCardTab } from "./simple-product-card-tab";
import { ProductDataSection } from "./product-data-section";
import { ConceptPhotoTab } from "./concept-photo-tab";
import { ProductVideoTab } from "./product-video-tab";
import { SourceImagesUpload, type UploadFlowState } from "./source-images-upload";
import { useProductCardProject } from "./use-product-card-project";

const SCENARIO_TAB: Array<{
  id: "concepts" | "card" | "video";
  scenario: ProductCardScenarioKey;
}> = [
  { id: "concepts", scenario: "conceptPhoto" },
  { id: "card", scenario: "marketplaceCard" },
  { id: "video", scenario: "productVideo" },
];

/** Подписи по умолчанию, если в настройках пустая строка */
const FALLBACK_LABELS: Record<ProductCardScenarioKey, string> = {
  conceptPhoto: "Фото с концепциями",
  marketplaceCard: "Карточка товара",
  productVideo: "Видео",
};

type TabId = (typeof SCENARIO_TAB)[number]["id"];

const CATEGORIES = [...getPublicProductCategories()];

type SizePreset = {
  id: string;
  label: string;
  width: number;
  height: number;
  aspectRatio: string;
};

type VideoPreset = {
  duration: number;
  resolution: string;
  aspectRatio: string;
};

type ProductVideoModelOption = {
  slug: string;
  name: string;
};

type Props = {
  balanceCredits: number;
  scenarios: ProductCardScenarioToggles;
  conceptImageSizes: SizePreset[];
  marketplaceCardSizes: SizePreset[];
  videoPresets: VideoPreset[];
  productVideoModels: ProductVideoModelOption[];
  defaultProductVideoModelSlug: string;
  /** Показать режим разметки оверлея (админ) */
  canMarketplaceLayoutDebug?: boolean;
  modelSetupByScenario: Partial<
    Record<ProductCardScenarioKey, ProductCardModelSlotDiagnostics>
  >;
  classifierAccess: ClassifierAccessForUser;
  classifierAdminHint: string;
  showAdminHints: boolean;
  classifierDevMock?: string | null;
};

export function ProductCardPage({
  balanceCredits,
  scenarios,
  conceptImageSizes,
  marketplaceCardSizes,
  videoPresets,
  productVideoModels,
  defaultProductVideoModelSlug,
  canMarketplaceLayoutDebug = false,
  modelSetupByScenario,
  classifierAccess,
  classifierAdminHint,
  showAdminHints,
  classifierDevMock = null,
}: Props) {
  const {
    initDone,
    projectId,
    source,
    sourceImages,
    onSourceImagesChange,
    loadError,
    setLoadError,
    selectedCategory,
    categorySource,
    classifyError,
    canUseBackend,
    ensureProjectId,
    classifyLoading,
    setManualCategory,
    productTitle,
    productDescription,
    productBenefitsText,
    setProductTitleManual,
    setProductDescriptionManual,
    setProductBenefitsTextManual,
    aiAnalysisStatus,
    retryProductAnalysis,
  } = useProductCardProject({
    classifierDevMock,
    classifierAutoEnabled: classifierAccess.canClassify || Boolean(classifierDevMock),
  });

  const classifierDevMockActive = Boolean(classifierDevMock);
  const classifierEnabled = classifierAccess.uiEnabled || classifierDevMockActive;

  const visibleTabs = useMemo(
    () =>
      SCENARIO_TAB.filter((t) => {
        const row = scenarios[t.scenario];
        return row?.enabled !== false;
      }),
    [scenarios],
  );

  const defaultTab = visibleTabs[0]?.id ?? "concepts";

  const [tab, setTab] = useState<TabId>(defaultTab);
  const [uploadFlow, setUploadFlow] = useState<UploadFlowState>("idle");
  const hasImage = Boolean(source?.url);

  const resolvedTab = useMemo((): TabId => {
    if (visibleTabs.length === 0) return tab;
    return visibleTabs.some((t) => t.id === tab) ? tab : visibleTabs[0]!.id;
  }, [visibleTabs, tab]);

  if (!initDone) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-48 w-full rounded-2xl" />
        <Skeleton className="h-32 w-full max-w-md" />
      </div>
    );
  }

  const scenarioReady = (scenario: ProductCardScenarioKey): boolean =>
    modelSetupByScenario[scenario]?.generationReady ?? false;

  const tabReady = (id: TabId): boolean => {
    const row = SCENARIO_TAB.find((t) => t.id === id);
    if (!row) return false;
    return scenarioReady(row.scenario);
  };

  const balanceDisplay = Number.isFinite(Number(balanceCredits)) ? Math.round(Number(balanceCredits)) : 0;

  const adminHintForTab = (id: TabId): string | null => {
    const row = SCENARIO_TAB.find((t) => t.id === id);
    if (!row || !showAdminHints) return null;
    return modelSetupByScenario[row.scenario]?.adminHint ?? null;
  };

  const tabLabel = (scenario: ProductCardScenarioKey): string => {
    const lbl = scenarios[scenario]?.label?.trim();
    return lbl ? lbl : FALLBACK_LABELS[scenario];
  };

  return (
    <div className="space-y-10">
      <p className="text-muted-foreground text-sm">
        Баланс (токены):{" "}
        <span className="text-foreground font-medium tabular-nums">{balanceDisplay}</span>
      </p>

      {loadError && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Ошибка</AlertTitle>
          <AlertDescription className="flex flex-wrap items-center gap-2">
            {loadError}
            <button
              type="button"
              className="text-primary underline"
              onClick={() => {
                setLoadError(null);
                sessionStorage.removeItem("productCardProjectId");
                window.location.reload();
              }}
            >
              Сбросить
            </button>
          </AlertDescription>
        </Alert>
      )}

      <div className="space-y-2">
        {uploadFlow !== "idle" && (
          <p className="text-muted-foreground text-xs" aria-live="polite">
            Загрузка:{" "}
            {uploadFlow === "uploading" && "идёт…"}
            {uploadFlow === "uploaded" && "файл на сервере"}
            {uploadFlow === "error" && "ошибка (см. ниже)"}
          </p>
        )}
        {aiAnalysisStatus === "analyzing" && hasImage ? (
          <p className="text-muted-foreground flex items-center gap-2 text-xs" aria-live="polite">
            ИИ анализирует фото товара…
          </p>
        ) : null}
        <SourceImagesUpload
          value={sourceImages}
          onChange={onSourceImagesChange}
          onUploadFlowChange={setUploadFlow}
        />
      </div>

      <ProductDataSection
        hasImage={hasImage}
        canPersist={canUseBackend}
        categories={CATEGORIES}
        selectedCategory={selectedCategory}
        categorySource={categorySource}
        classifierEnabled={classifierEnabled}
        aiAnalysisStatus={aiAnalysisStatus}
        classifyError={classifyError}
        productTitle={productTitle}
        productDescription={productDescription}
        productBenefitsText={productBenefitsText}
        onProductTitleChange={setProductTitleManual}
        onProductDescriptionChange={setProductDescriptionManual}
        onProductBenefitsTextChange={setProductBenefitsTextManual}
        onSelectCategory={setManualCategory}
        onRetryAnalysis={classifierEnabled ? retryProductAnalysis : undefined}
        retryDisabled={classifyLoading}
        classifierAdminHint={showAdminHints ? classifierAdminHint : null}
      />

      <section className="space-y-3" aria-label="Сценарии">
        <h3 className="text-foreground text-base font-semibold">Сценарии</h3>
        {!hasImage && (
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Нет исходного фото</AlertTitle>
            <AlertDescription>
              Загрузите фото товара — тогда откроются сценарии генерации для витрин и промо.
            </AlertDescription>
          </Alert>
        )}

        {visibleTabs.length === 0 && hasImage ? (
          <Alert>
            <AlertTitle>Нет доступных сценариев</AlertTitle>
            <AlertDescription>
              Все сценарии отключены администратором. Обратитесь в поддержку.
            </AlertDescription>
          </Alert>
        ) : null}

        <Tabs
          value={resolvedTab}
          onValueChange={(v) => {
            const next = v as TabId;
            if (hasImage) setTab(next);
          }}
          className="gap-4"
        >
          <TabsList
            variant="line"
            className="h-auto w-full max-w-3xl flex-wrap justify-start gap-1.5 rounded-xl border border-border bg-white p-1.5"
          >
            {visibleTabs.map((t) => {
              const ready = tabReady(t.id);
              return (
                <TabsTrigger
                  key={t.id}
                  value={t.id}
                  disabled={!hasImage}
                  className="rounded-lg border border-transparent px-4 py-2.5 text-sm data-active:border-primary data-active:bg-primary/10 data-active:shadow-sm"
                >
                  {tabLabel(t.scenario)}
                  {hasImage && !ready ? (
                    <span className="text-muted-foreground ml-1 text-[10px]">· настройка</span>
                  ) : null}
                </TabsTrigger>
              );
            })}
          </TabsList>

          <TabsContent value="concepts" className="mt-4">
            {!tabReady("concepts") ? (
              <ScenarioSetupNotice adminHint={adminHintForTab("concepts")} showAdminLink={showAdminHints} />
            ) : (
              <ConceptPhotoTab
                selectedCategory={selectedCategory}
                productTitle={productTitle}
                productBenefitsText={productBenefitsText}
                hasImage={hasImage}
                canUseBackend={canUseBackend}
                projectId={projectId}
                balanceCredits={balanceDisplay}
                sizePresets={conceptImageSizes}
              />
            )}
          </TabsContent>
          <TabsContent value="card" className="mt-4">
            {!tabReady("card") ? (
              <ScenarioSetupNotice adminHint={adminHintForTab("card")} showAdminLink={showAdminHints} />
            ) : (
              <SimpleProductCardTab
                initDone={initDone}
                ensureProjectId={ensureProjectId}
                projectId={projectId}
                sourceImages={sourceImages}
                balanceCredits={balanceDisplay}
                productLabel={productTitle}
                userText={productBenefitsText}
                onProductLabelChange={setProductTitleManual}
                onUserTextChange={setProductBenefitsTextManual}
                selectedCategoryLabel={
                  selectedCategory
                    ? getManualProductCategoryLabel(selectedCategory) ??
                      CATEGORIES.find((c) => c.id === selectedCategory)?.label ??
                      selectedCategory
                    : null
                }
                showAdminHints={showAdminHints}
              />
            )}
          </TabsContent>
          <TabsContent value="video" className="mt-4">
            {!tabReady("video") ? (
              <ScenarioSetupNotice
                title="Видео для товаров скоро"
                body="Мы подключаем AI-модель для видео. Попробуйте позже или обратитесь в поддержку."
                adminHint={adminHintForTab("video")}
                showAdminLink={showAdminHints}
              />
            ) : (
              <ProductVideoTab
                hasImage={hasImage}
                canUseBackend={canUseBackend}
                projectId={projectId}
                balanceCredits={balanceDisplay}
                videoPresets={videoPresets}
                productVideoModels={productVideoModels}
                defaultProductVideoModelSlug={defaultProductVideoModelSlug}
              />
            )}
          </TabsContent>
        </Tabs>
      </section>
    </div>
  );
}
