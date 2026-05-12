"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getPublicProductCategories } from "@/config/product-card-categories";

import { CardBuilderTab } from "./card-builder-tab";
import { CategorySelector } from "./category-selector";
import { ConceptPhotoTab } from "./concept-photo-tab";
import { MarketplaceCardTab } from "./marketplace-card-tab";
import { ProductVideoTab } from "./product-video-tab";
import { SourceImagesUpload, type UploadFlowState } from "./source-images-upload";
import { useProductCardProject } from "./use-product-card-project";

const TAB_DEFS = [
  { id: "concepts" as const, scenarioKey: "conceptPhoto" as const, defaultLabel: "Фото с концепциями" },
  { id: "card" as const, scenarioKey: "marketplaceCard" as const, defaultLabel: "Карточка товара" },
  {
    id: "card_builder" as const,
    scenarioKey: "cardBuilder" as const,
    defaultLabel: "Создать карточку",
  },
  { id: "video" as const, scenarioKey: "productVideo" as const, defaultLabel: "Видео" },
];

const CATEGORIES = [...getPublicProductCategories()];

export type ScenarioTogglesUi = Record<
  (typeof TAB_DEFS)[number]["scenarioKey"],
  { enabled: boolean; label: string }
>;

type TabId = (typeof TAB_DEFS)[number]["id"];

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

type Props = {
  balanceCredits: number;
  conceptImageSizes: SizePreset[];
  marketplaceCardSizes: SizePreset[];
  videoPresets: VideoPreset[];
  scenarios: ScenarioTogglesUi;
  /** Показать режим разметки оверлея (админ) */
  canMarketplaceLayoutDebug?: boolean;
};

export function ProductCardPage({
  balanceCredits,
  conceptImageSizes,
  marketplaceCardSizes,
  videoPresets,
  scenarios,
  canMarketplaceLayoutDebug = false,
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
    classifyInfo,
    classifyFlow,
    classifyError,
    canUseBackend,
    classifyLoading,
    runClassify,
    runMockCategory,
    setManualCategory,
    reloadProject,
  } = useProductCardProject();

  const [tab, setTab] = useState<TabId>("concepts");

  const visibleTabs = useMemo(() => {
    return TAB_DEFS.filter((def) => scenarios[def.scenarioKey].enabled).map((def) => ({
      id: def.id,
      label: scenarios[def.scenarioKey].label?.trim() || def.defaultLabel,
    }));
  }, [scenarios]);

  useEffect(() => {
    if (!visibleTabs.some((x) => x.id === tab)) {
      const first = visibleTabs[0]?.id;
      if (first) setTab(first);
    }
  }, [visibleTabs, tab]);

  const [uploadFlow, setUploadFlow] = useState<UploadFlowState>("idle");
  const hasImage = Boolean(source?.url);

  if (!initDone) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-48 w-full rounded-2xl" />
        <Skeleton className="h-32 w-full max-w-md" />
      </div>
    );
  }

  const balanceDisplay = Number.isFinite(Number(balanceCredits)) ? Math.round(Number(balanceCredits)) : 0;

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
        <SourceImagesUpload
          value={sourceImages}
          onChange={onSourceImagesChange}
          onUploadFlowChange={setUploadFlow}
        />
      </div>

      <CategorySelector
        hasImage={hasImage}
        canPersist={canUseBackend}
        categories={CATEGORIES}
        selectedCategory={selectedCategory}
        categorySource={categorySource}
        classifyLoading={classifyLoading}
        classifyFlow={classifyFlow}
        classifyError={classifyError}
        classifyInfo={classifyInfo}
        onClassify={runClassify}
        onMockTest={runMockCategory}
        onSelectCategory={setManualCategory}
      />

      <section className="space-y-3" aria-label="Сценарии">
        <h3 className="text-foreground text-base font-semibold">Сценарии</h3>
        {!hasImage && (
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Нет исходного фото</AlertTitle>
            <AlertDescription>
              Загрузите фото товара — тогда станут доступны выбранные сценарии (настраиваются в админке).
            </AlertDescription>
          </Alert>
        )}

        {visibleTabs.length === 0 ? (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Нет доступных сценариев</AlertTitle>
            <AlertDescription>
              Включите хотя бы один сценарий в админке: Product Card → вкладка «Сценарии».
            </AlertDescription>
          </Alert>
        ) : (
        <Tabs
          value={tab}
          onValueChange={(v) => {
            if (hasImage) setTab(v as TabId);
          }}
          className="gap-4"
        >
          <TabsList
            variant="line"
            className="h-auto w-full max-w-4xl flex-wrap justify-start gap-1.5 rounded-xl border border-border bg-white p-1.5"
          >
            {visibleTabs.map((t) => (
              <TabsTrigger
                key={t.id}
                value={t.id}
                disabled={!hasImage}
                className="rounded-lg border border-transparent px-4 py-2.5 text-sm data-active:border-primary data-active:bg-primary/10 data-active:shadow-sm"
              >
                {t.label}
              </TabsTrigger>
            ))}
          </TabsList>

          {scenarios.conceptPhoto.enabled ? (
          <TabsContent value="concepts" className="mt-4">
            <ConceptPhotoTab
              selectedCategory={selectedCategory}
              hasImage={hasImage}
              canUseBackend={canUseBackend}
              projectId={projectId}
              balanceCredits={balanceDisplay}
              sizePresets={conceptImageSizes}
            />
          </TabsContent>
          ) : null}
          {scenarios.marketplaceCard.enabled ? (
          <TabsContent value="card" className="mt-4">
            <MarketplaceCardTab
              hasImage={hasImage}
              canUseBackend={canUseBackend}
              projectId={projectId}
              balanceCredits={balanceDisplay}
              cardSizePresets={marketplaceCardSizes}
              canLayoutDebug={canMarketplaceLayoutDebug}
            />
          </TabsContent>
          ) : null}
          {scenarios.cardBuilder.enabled ? (
          <TabsContent value="card_builder" className="mt-4">
            <CardBuilderTab
              selectedCategory={selectedCategory}
              hasImage={hasImage}
              canUseBackend={canUseBackend}
              projectId={projectId}
              balanceCredits={balanceDisplay}
              reloadProject={reloadProject}
            />
          </TabsContent>
          ) : null}
          {scenarios.productVideo.enabled ? (
          <TabsContent value="video" className="mt-4">
            <ProductVideoTab
              hasImage={hasImage}
              canUseBackend={canUseBackend}
              projectId={projectId}
              balanceCredits={balanceDisplay}
              videoPresets={videoPresets}
            />
          </TabsContent>
          ) : null}
        </Tabs>
        )}
      </section>
    </div>
  );
}
