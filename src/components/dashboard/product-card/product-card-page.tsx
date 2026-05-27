"use client";

import { useMemo, useState } from "react";
import { AlertTriangle } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getPublicProductCategories } from "@/config/product-card-categories";
import type {
  ProductCardScenarioKey,
  ProductCardScenarioToggles,
} from "@/server/services/productCardSettings";

import { SimpleProductCardTab } from "./simple-product-card-tab";
import { CategorySelector } from "./category-selector";
import { ConceptPhotoTab } from "./concept-photo-tab";
import { MarketplaceCardTab } from "./marketplace-card-tab";
import { ProductVideoTab } from "./product-video-tab";
import { SourceImagesUpload, type UploadFlowState } from "./source-images-upload";
import { useProductCardProject } from "./use-product-card-project";

const SCENARIO_TAB: Array<{
  id: "concepts" | "card" | "cardBuilder" | "video";
  scenario: ProductCardScenarioKey;
}> = [
  { id: "concepts", scenario: "conceptPhoto" },
  { id: "card", scenario: "marketplaceCard" },
  { id: "cardBuilder", scenario: "cardBuilder" },
  { id: "video", scenario: "productVideo" },
];

/** Подписи по умолчанию, если в настройках пустая строка */
const FALLBACK_LABELS: Record<ProductCardScenarioKey, string> = {
  conceptPhoto: "Фото с концепциями",
  marketplaceCard: "Карточка товара",
  cardBuilder: "Создать карточку",
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

type Props = {
  balanceCredits: number;
  scenarios: ProductCardScenarioToggles;
  conceptImageSizes: SizePreset[];
  marketplaceCardSizes: SizePreset[];
  videoPresets: VideoPreset[];
  /** Показать режим разметки оверлея (админ) */
  canMarketplaceLayoutDebug?: boolean;
};

export function ProductCardPage({
  balanceCredits,
  scenarios,
  conceptImageSizes,
  marketplaceCardSizes,
  videoPresets,
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
    ensureProjectId,
    classifyLoading,
    runClassify,
    setManualCategory,
  } = useProductCardProject();

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

  const balanceDisplay = Number.isFinite(Number(balanceCredits)) ? Math.round(Number(balanceCredits)) : 0;

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
        onSelectCategory={setManualCategory}
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
            if (hasImage || next === "cardBuilder") setTab(next);
          }}
          className="gap-4"
        >
          <TabsList
            variant="line"
            className="h-auto w-full max-w-3xl flex-wrap justify-start gap-1.5 rounded-xl border border-border bg-white p-1.5"
          >
            {visibleTabs.map((t) => (
              <TabsTrigger
                key={t.id}
                value={t.id}
                disabled={t.id !== "cardBuilder" && !hasImage}
                className="rounded-lg border border-transparent px-4 py-2.5 text-sm data-active:border-primary data-active:bg-primary/10 data-active:shadow-sm"
              >
                {tabLabel(t.scenario)}
              </TabsTrigger>
            ))}
          </TabsList>

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
          <TabsContent value="cardBuilder" className="mt-4">
            <SimpleProductCardTab
              initDone={initDone}
              ensureProjectId={ensureProjectId}
              projectId={projectId}
              sourceImages={sourceImages}
              balanceCredits={balanceDisplay}
            />
          </TabsContent>
          <TabsContent value="video" className="mt-4">
            <ProductVideoTab
              hasImage={hasImage}
              canUseBackend={canUseBackend}
              projectId={projectId}
              balanceCredits={balanceDisplay}
              videoPresets={videoPresets}
            />
          </TabsContent>
        </Tabs>
      </section>
    </div>
  );
}
