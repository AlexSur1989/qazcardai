"use client";

import { useMemo, useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AlertTriangle } from "lucide-react";
import { toast } from "sonner";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { InfoTooltip } from "@/components/ui/info-tooltip";
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
import {
  ProductCardResultsPanel,
  type VideoSourcePick,
} from "./product-card-results-panel";
import { SourceImagesUpload, type SourceImagesValue, type UploadFlowState } from "./source-images-upload";
import { CurrentProductBar } from "./current-product-bar";
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
  /** @deprecated не показываем клиенту; оставлено для совместимости пропсов страницы */
  productVideoModels?: ProductVideoModelOption[];
  defaultProductVideoModelSlug?: string;
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
  canMarketplaceLayoutDebug = false,
  modelSetupByScenario,
  classifierAccess,
  classifierAdminHint,
  showAdminHints,
  classifierDevMock = null,
}: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryProjectId = searchParams.get("projectId");

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
    productBenefitsText,
    setProductTitleManual,
    setProductBenefitsTextManual,
    aiAnalysisStatus,
    retryProductAnalysis,
    startNewProduct,
    productDisplayName,
  } = useProductCardProject({
    classifierDevMock,
    classifierAutoEnabled: classifierAccess.canClassify || Boolean(classifierDevMock),
    queryProjectId,
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
  const [resultsRefreshKey, setResultsRefreshKey] = useState(0);
  const [pendingVideoSource, setPendingVideoSource] = useState<VideoSourcePick | null>(null);
  const [newProductBusy, setNewProductBusy] = useState(false);
  const hasImage = Boolean(source?.url);
  const projectScopeKey = projectId ?? "none";

  const handleNewProduct = async () => {
    setNewProductBusy(true);
    try {
      const id = await startNewProduct();
      if (!id) {
        toast.error("Не удалось создать новый товар");
        return;
      }
      setResultsRefreshKey(0);
      setPendingVideoSource(null);
      setTab(defaultTab);
      router.replace("/dashboard/create/product-card");
      toast.success("Создан новый товар");
    } finally {
      setNewProductBusy(false);
    }
  };

  const bumpResultsPanel = () => setResultsRefreshKey((k) => k + 1);

  useEffect(() => {
    setResultsRefreshKey(0);
    setPendingVideoSource(null);
  }, [projectScopeKey]);

  const handleUseForVideo = (pick: VideoSourcePick) => {
    setPendingVideoSource(pick);
    setTab("video");
  };

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
    <div className="min-w-0 max-w-full space-y-6 overflow-x-clip sm:space-y-8">
      <CurrentProductBar
        displayName={productDisplayName}
        hasProject={Boolean(projectId)}
        canRename={canUseBackend}
        onRename={setProductTitleManual}
        onNewProduct={() => void handleNewProduct()}
        newProductBusy={newProductBusy}
      />

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

      <div className="grid min-w-0 grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1.65fr)_minmax(0,1fr)] lg:items-start lg:gap-8">
        <div className="min-w-0 space-y-6 sm:space-y-8">
      <div className="min-w-0 space-y-2">
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

      <div className="flex min-w-0 flex-col gap-8">
        <div className="min-w-0">
          <ProductDataSection
            hasImage={hasImage}
            canPersist={canUseBackend}
            selectedCategory={selectedCategory}
            categorySource={categorySource}
            classifierEnabled={classifierEnabled}
            aiAnalysisStatus={aiAnalysisStatus}
            classifyError={classifyError}
            productTitle={productTitle}
            onProductTitleChange={setProductTitleManual}
            onSelectCategory={setManualCategory}
            onRetryAnalysis={classifierEnabled ? retryProductAnalysis : undefined}
            retryDisabled={classifyLoading}
            classifierAdminHint={showAdminHints ? classifierAdminHint : null}
          />
        </div>

      <section className="min-w-0 space-y-3" aria-label="Сценарии">
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
          className="flex min-w-0 max-w-full flex-col gap-5"
        >
          <TabsList className="grid h-auto w-full min-w-0 grid-cols-1 items-stretch gap-2 rounded-xl border border-border bg-[#f6fcfe]/70 p-2 sm:grid-cols-3 [&_[data-slot=tabs-trigger]]:after:hidden">
            {visibleTabs.map((t) => {
              const ready = tabReady(t.id);
              return (
                <TabsTrigger
                  key={t.id}
                  value={t.id}
                  disabled={!hasImage}
                  className="h-auto min-h-[3.25rem] w-full min-w-0 flex-none justify-center rounded-lg border border-border/80 bg-white px-3 py-2.5 text-sm font-medium whitespace-normal text-muted-foreground shadow-sm transition-colors hover:border-primary/35 hover:text-foreground data-active:border-primary data-active:bg-primary/10 data-active:text-foreground data-active:shadow-md"
                >
                  <span className="flex min-w-0 flex-col items-center gap-1 text-center">
                    <span className="inline-flex min-w-0 items-center justify-center gap-1">
                      <span className="leading-snug">{tabLabel(t.scenario)}</span>
                      {t.id === "concepts" ? (
                        <InfoTooltip content="AI создаст несколько вариантов визуальной подачи товара." />
                      ) : t.id === "card" ? (
                        <InfoTooltip content="Готовая карточка с текстом, преимуществами и инфографикой для маркетплейса." />
                      ) : t.id === "video" ? (
                        <InfoTooltip content="Короткий рекламный ролик из фото товара или готовой карточки." />
                      ) : null}
                    </span>
                    {hasImage && !ready ? (
                      <span className="text-muted-foreground text-[10px] leading-none">
                        настройка
                      </span>
                    ) : null}
                  </span>
                </TabsTrigger>
              );
            })}
          </TabsList>

          <TabsContent value="concepts" className="mt-0 min-w-0 max-w-full">
            {!tabReady("concepts") ? (
              <ScenarioSetupNotice adminHint={adminHintForTab("concepts")} showAdminLink={showAdminHints} />
            ) : (
              <ConceptPhotoTab
                key={projectScopeKey}
                selectedCategory={selectedCategory}
                productTitle={productTitle}
                productBenefitsText={productBenefitsText}
                hasImage={hasImage}
                canUseBackend={canUseBackend}
                projectId={projectId}
                balanceCredits={balanceDisplay}
                sizePresets={conceptImageSizes}
                onGenerationFinished={bumpResultsPanel}
              />
            )}
          </TabsContent>
          <TabsContent value="card" className="mt-0 min-w-0 max-w-full">
            {!tabReady("card") ? (
              <ScenarioSetupNotice adminHint={adminHintForTab("card")} showAdminLink={showAdminHints} />
            ) : (
              <SimpleProductCardTab
                key={projectScopeKey}
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
                onGenerationFinished={bumpResultsPanel}
              />
            )}
          </TabsContent>
          <TabsContent value="video" className="mt-0 min-w-0 max-w-full">
            {!tabReady("video") ? (
              <ScenarioSetupNotice
                title="Видео для товаров скоро"
                body="Мы подключаем AI-модель для видео. Попробуйте позже или обратитесь в поддержку."
                adminHint={adminHintForTab("video")}
                showAdminLink={showAdminHints}
              />
            ) : (
              <ProductVideoTab
                key={projectScopeKey}
                hasImage={hasImage}
                canUseBackend={canUseBackend}
                projectId={projectId}
                balanceCredits={balanceDisplay}
                videoPresets={videoPresets}
                sourceImages={sourceImages}
                pendingVideoSource={pendingVideoSource}
                onPendingVideoSourceApplied={() => setPendingVideoSource(null)}
                onGenerationFinished={bumpResultsPanel}
              />
            )}
          </TabsContent>
        </Tabs>
      </section>
      </div>
        </div>

        <aside className="min-w-0 lg:sticky lg:top-24 lg:max-h-[calc(100vh-6rem)] lg:overflow-y-auto">
          <ProductCardResultsPanel
            key={projectScopeKey}
            projectId={projectId}
            refreshKey={resultsRefreshKey}
            onUseForVideo={handleUseForVideo}
          />
        </aside>
      </div>
    </div>
  );
}
