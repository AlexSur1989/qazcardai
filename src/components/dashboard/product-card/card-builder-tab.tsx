"use client";

import Link from "next/link";
import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";

import {
  CARD_BUILDER_DEFAULT_MARKETPLACE_ID,
} from "@/config/card-builder-config";
import {
  CARD_BUILDER_DEFAULT_TARGET_PLATFORM,
  type CardBuilderCreationModeId,
  type CardBuilderSingleCardTypeId,
  type CardBuilderUniversalCategoryId,
  type CardBuilderVisualStyleId,
} from "@/config/card-builder-universal";
import { UNIVERSAL_CARD_BUILDER_PROFILE } from "@/config/universal-card-builder-profile";
import {
  normalizeProductFactsList,
  type CardBuilderProductFact,
} from "@/lib/card-builder-product-facts";
import { computeCardBuilderProductTitle } from "@/lib/card-builder-product-title";
import {
  derivePlanStyleFields,
  textDensityToToggle,
  type CardBuilderTextAmountToggle,
} from "@/lib/card-builder-style-choice";
import { mapUniversalCategoryToPlannerCategory } from "@/lib/card-builder-universal-planner";
import {
  CardBuilderUniversalPanel,
  type VisionSummary,
} from "@/components/dashboard/product-card/card-builder-universal-panel";
import { readJsonSafe } from "@/lib/fetch-json-safe";
import {
  DEFAULT_CARD_BUILDER_STYLE_REFERENCE,
  type CardBuilderStyleReferenceStrength,
} from "@/lib/card-builder-style-reference";
import {
  IMAGE_GENERATION_POLL_INTERVAL_MS,
  IMAGE_GENERATION_POLL_MAX_ITERATIONS,
} from "@/lib/generation-client-polling";
import { getFirstOutputUrlFromJson } from "@/lib/product-card-output";
import { toast } from "sonner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  getUserFacingGenerationStatusFromRaw,
  getUserFacingSlideLabel,
  mapGenerationErrorToUserMessage,
} from "@/lib/generation-display";
import {
  SourceImageUpload,
  type SourceImageValue,
} from "@/components/dashboard/product-card/source-image-upload";
import { CardBuilderGalleryPreview } from "@/components/dashboard/product-card/card-builder-gallery-preview";

const nativeFieldClass =
  "h-10 w-full min-w-0 rounded-xl border border-input bg-card px-2.5 text-sm text-foreground transition-colors outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-input/30";

/** Фиксированные значения плана (поля убраны из UI). */
const CARD_BUILDER_FIXED_PRESERVE_ASPECTS = ["shape", "color", "logo", "proportions"];

type StyleReferenceRow = {
  url: string;
  fileName: string;
  size: number;
  fileId?: string;
};

const STYLE_REF_ACCEPT = "image/png,image/jpeg,image/jpg,image/webp";
const STYLE_REF_MAX_MB = 10;
const STYLE_REF_MAX_BYTES = STYLE_REF_MAX_MB * 1024 * 1024;

function isValidStyleRefImage(file: File): boolean {
  const t = file.type.toLowerCase();
  if (
    t === "image/jpeg" ||
    t === "image/jpg" ||
    t === "image/png" ||
    t === "image/webp" ||
    t === "image/pjpeg"
  )
    return true;
  return /\.(jpe?g|png|webp)$/i.test(file.name);
}

function slideProgressLabel(statusRaw: string): string {
  const s = statusRaw.trim().toLowerCase();
  if (s === "queued") return "ожидает";
  if (s === "done" || s === "готово") return "готово";
  if (s === "error" || s === "ошибка") return "ошибка";
  if (s === "generating") return "генерация";
  if (!s || s === "не сгенерировано") return "не сгенерировано";
  return statusRaw;
}

type GallerySlide = {
  slideId: string;
  title: string;
  purpose?: string;
  imageRole: string;
  templateId?: string;
  templateLabel?: string;
  layoutPreset?: string;
  previewCaption?: string;
};

type CardBuilderGenHistoryRow = {
  generationId: string;
  slideId: string;
  imageRole?: string;
  createdAt?: string;
  status?: string;
  errorMessage?: string;
  finalUrl?: string;
};

type CardBuilderBlockPayload = {
  sourceImage?: {
    url?: string;
    fileId?: string;
    fileName?: string;
    size?: number;
  };
  galleryPlan?: GallerySlide[];
  generations?: unknown;
  settings?: Record<string, unknown>;
};

type Props = {
  initDone: boolean;
  ensureProjectId: () => Promise<string | null>;
  projectId: string | null;
  /** Общее фото проекта (блок выше) — используется, если отдельное фото card_builder ещё не задано. */
  projectSource?: SourceImageValue;
  balanceCredits: number;
};

export function CardBuilderTab({
  initDone,
  ensureProjectId,
  projectId,
  projectSource = null,
  balanceCredits,
}: Props) {
  const templateProfile = UNIVERSAL_CARD_BUILDER_PROFILE;
  const [categoryKey, setCategoryKey] = useState<CardBuilderUniversalCategoryId>("auto");
  const [categoryManuallyOverridden, setCategoryManuallyOverridden] = useState(false);
  const [productType, setProductType] = useState("");
  const [productNameGuess, setProductNameGuess] = useState("");
  const [projectTitle, setProjectTitle] = useState<string | null>(null);
  const [productFacts, setProductFacts] = useState<CardBuilderProductFact[]>([]);
  const [visionAnalysis, setVisionAnalysis] = useState<Record<string, unknown> | null>(null);
  const [visionSummary, setVisionSummary] = useState<VisionSummary | null>(null);
  const [visionLoading, setVisionLoading] = useState(false);
  const [creationMode, setCreationMode] = useState<CardBuilderCreationModeId>("full_gallery");
  const [singleCardType, setSingleCardType] = useState<CardBuilderSingleCardTypeId>("auto");
  const [visualStyle, setVisualStyle] = useState<CardBuilderVisualStyleId>("auto");
  const [textAmountToggle, setTextAmountToggle] = useState<CardBuilderTextAmountToggle>("more");
  const [gallerySlideCount, setGallerySlideCount] = useState<6 | 8>(6);

  const [slides, setSlides] = useState<GallerySlide[]>([]);
  const [activeSlideId, setActiveSlideId] = useState<string | null>(null);
  const [planError, setPlanError] = useState<string | null>(null);
  const [planLoading, setPlanLoading] = useState(false);

  const [estimateSingle, setEstimateSingle] = useState<number | null>(null);
  const [estimateGallery, setEstimateGallery] = useState<number | null>(null);
  const cbPricingSnapRef = useRef<{
    lastPlanHash: string | null;
    singleCredits: number | null;
    galleryCredits: number | null;
  }>({
    lastPlanHash: null,
    singleCredits: null,
    galleryCredits: null,
  });
  const [estimating, setEstimating] = useState(false);
  const [genBusy, setGenBusy] = useState(false);
  const [batchBusy, setBatchBusy] = useState(false);

  const [slideGen, setSlideGen] = useState<Record<string, { status: string; url: string | null }>>(
    {},
  );
  const [genHistory, setGenHistory] = useState<CardBuilderGenHistoryRow[]>([]);
  const [tplBusySlideId, setTplBusySlideId] = useState<string | null>(null);

  const [styleReferenceEnabled, setStyleReferenceEnabled] = useState(false);
  const [styleReferenceStrength, setStyleReferenceStrength] =
    useState<CardBuilderStyleReferenceStrength>("medium");
  const [styleReferenceFlags, setStyleReferenceFlags] = useState({
    useComposition: DEFAULT_CARD_BUILDER_STYLE_REFERENCE.useComposition,
    useBackground: DEFAULT_CARD_BUILDER_STYLE_REFERENCE.useBackground,
    useColors: DEFAULT_CARD_BUILDER_STYLE_REFERENCE.useColors,
    useTypography: false,
    useBadges: false,
    useIcons: false,
    useMood: DEFAULT_CARD_BUILDER_STYLE_REFERENCE.useMood,
    useOverallPresentation: DEFAULT_CARD_BUILDER_STYLE_REFERENCE.useOverallPresentation,
  });
  const [styleReferenceImages, setStyleReferenceImages] = useState<StyleReferenceRow[]>([]);
  const [styleReferenceUploading, setStyleReferenceUploading] = useState(false);
  const [sourceImage, setSourceImage] = useState<SourceImageValue>(null);
  const [sourceImageSaving, setSourceImageSaving] = useState(false);
  /** После успешной гидратации для `projectId` не подставляем saved.* повторно при refresh. */
  const hydratedProjectIdRef = useRef<string | null>(null);
  /** Проект, для которого уже подставили общее фото проекта в card_builder. */
  const autoSyncedFromProjectRef = useRef<string | null>(null);
  /** Авто-vision уже запущен для проекта (hydrate без saved vision). */
  const hydrateVisionTriggeredRef = useRef<string | null>(null);
  /** Пользователь успел изменить форму до завершения первого fetch — не перезатирать локальный ввод. */
  const userEditedFormRef = useRef(false);
  const styleReferenceFileInputRef = useRef<HTMLInputElement>(null);
  const styleReferenceFieldId = useId();

  const markUserEditedForm = useCallback(() => {
    userEditedFormRef.current = true;
  }, []);

  const resetVisionState = useCallback(() => {
    setVisionAnalysis(null);
    setVisionSummary(null);
    setVisionLoading(false);
    setProductFacts([]);
    setCategoryKey("auto");
    setCategoryManuallyOverridden(false);
    setProductType("");
    setProductNameGuess("");
  }, []);

  const derivedPlanStyles = useMemo(
    () =>
      derivePlanStyleFields({
        visualStyle,
        textAmountToggle,
      }),
    [visualStyle, textAmountToggle],
  );

  const computedProductTitle = useMemo(
    () =>
      computeCardBuilderProductTitle({
        productNameGuess,
        projectTitle,
      }),
    [productNameGuess, projectTitle],
  );

  const previewTextDensity = derivedPlanStyles.textDensity;

  const removeStyleReferenceAt = useCallback(
    (idx: number) => {
      markUserEditedForm();
      setStyleReferenceImages((prev) => prev.filter((_, i) => i !== idx));
    },
    [markUserEditedForm],
  );

  const handleStyleReferenceFileInputChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const list = e.target.files;
      e.target.value = "";
      if (!list?.length) return;
      if (!projectId || !initDone) {
        toast.error("Чтобы загрузить референс, нужен сохранённый проект с доступом к загрузкам.");
        return;
      }
      markUserEditedForm();
      const files = [...list];
      setStyleReferenceUploading(true);
      try {
        for (const file of files) {
          if (!isValidStyleRefImage(file)) {
            toast.error("Референс: нужен файл PNG, JPG, JPEG или WebP.");
            continue;
          }
          if (file.size > STYLE_REF_MAX_BYTES) {
            toast.error(`Референс: файл не больше ${STYLE_REF_MAX_MB} МБ.`);
            continue;
          }
          const form = new FormData();
          form.set("file", file);
          form.set("purpose", "product_card_style_reference");
          const res = await fetch("/api/uploads", { method: "POST", body: form });
          const data = (await res.json()) as {
            url?: string;
            fileId?: string;
            size?: number;
            error?: string;
          };
          const ok =
            res.ok &&
            typeof data.url === "string" &&
            data.url.trim() &&
            typeof data.fileId === "string" &&
            data.fileId.trim();
          if (!ok) {
            toast.error(
              typeof data.error === "string" && data.error.trim()
                ? data.error
                : "Не удалось загрузить референс стиля.",
            );
            continue;
          }

          let atCap = false;
          setStyleReferenceImages((prev) => {
            if (prev.length >= 3) {
              atCap = true;
              return prev;
            }
            const sizeNum =
              typeof data.size === "number" && Number.isFinite(data.size) ? data.size : file.size;
            return [
              ...prev,
              {
                url: data.url!.trim(),
                fileName: file.name,
                size: sizeNum,
                fileId: data.fileId!.trim(),
              },
            ];
          });

          if (atCap) {
            toast.message("Уже загружено максимум три референса.");
            break;
          }
        }
      } finally {
        setStyleReferenceUploading(false);
      }
    },
    [projectId, initDone, markUserEditedForm],
  );

  const hasDedicatedCardBuilderImage = Boolean(
    sourceImage?.url?.trim() && sourceImage.fileId?.trim(),
  );
  const hasProjectImage = Boolean(
    projectSource?.url?.trim() &&
      projectSource.fileId?.trim() &&
      !projectSource.isLocalPreview,
  );
  const hasCardBuilderImage = hasDedicatedCardBuilderImage || hasProjectImage;
  const canWork = Boolean(hasCardBuilderImage && projectId && initDone);
  const canUploadCardBuilderImage = Boolean(initDone && !sourceImageSaving);

  const resolvedPlannerCategory = mapUniversalCategoryToPlannerCategory(
    categoryKey === "auto" && visionSummary?.categoryKey
      ? visionSummary.categoryKey
      : categoryKey,
  );

  const planGoal =
    creationMode === "single"
      ? "main_photo"
      : gallerySlideCount === 8
        ? "full_gallery_8"
        : "full_gallery_6";

  const planPayload = useMemo(() => {
    const cat = resolvedPlannerCategory;

    const styleReferenceIds = styleReferenceEnabled
      ? styleReferenceImages
          .map((x) => x.fileId?.trim())
          .filter((x): x is string => Boolean(x))
          .slice(0, 3)
      : [];

    const styleReferenceBlock =
      styleReferenceEnabled && styleReferenceIds.length
        ? {
            styleReference: {
              enabled: true,
              referenceAssetIds: styleReferenceIds,
              strength: styleReferenceStrength,
              ...styleReferenceFlags,
            },
          }
        : {};

    return {
      selectedCategory: cat,
      marketplace: CARD_BUILDER_DEFAULT_MARKETPLACE_ID,
      targetPlatform: CARD_BUILDER_DEFAULT_TARGET_PLATFORM,
      cardBuilderCategoryKey: categoryKey,
      categoryManuallyOverridden,
      creationMode,
      singleCardType,
      visualStyle,
      productType: productType.trim() || undefined,
      productNameGuess: productNameGuess.trim() || undefined,
      productFacts,
      visionAnalysis: visionAnalysis ?? undefined,
      gallerySlideCount,
      goal: planGoal,
      preserveProduct: true,
      preserveAspects: [...CARD_BUILDER_FIXED_PRESERVE_ASPECTS],
      allowCreativeStylization: false,
      languageMode: "auto",
      audience: "mass_market",
      priceSegment: "middle",
      salesStyle: derivedPlanStyles.salesStyle,
      textDensity: derivedPlanStyles.textDensity,
      ...styleReferenceBlock,
    };
  }, [
    resolvedPlannerCategory,
    categoryKey,
    categoryManuallyOverridden,
    creationMode,
    singleCardType,
    visualStyle,
    productType,
    productNameGuess,
    productFacts,
    visionAnalysis,
    gallerySlideCount,
    planGoal,
    derivedPlanStyles,
    styleReferenceEnabled,
    styleReferenceImages,
    styleReferenceStrength,
    styleReferenceFlags,
  ]);

  const applySourceImageFromBlock = useCallback((blk: CardBuilderBlockPayload | null) => {
    const raw = blk?.sourceImage;
    if (!raw || typeof raw !== "object") {
      setSourceImage(null);
      return;
    }
    const url = typeof raw.url === "string" ? raw.url.trim() : "";
    const fileId = typeof raw.fileId === "string" ? raw.fileId.trim() : "";
    if (!url || !fileId) {
      setSourceImage(null);
      return;
    }
    setSourceImage({
      url,
      fileId,
      fileName: typeof raw.fileName === "string" ? raw.fileName : "Фото товара",
      size: typeof raw.size === "number" && Number.isFinite(raw.size) ? raw.size : 0,
    });
  }, []);

  const fetchCardBuilderBlockForProject = useCallback(
    async (
      pid: string,
    ): Promise<{ block: CardBuilderBlockPayload | null; projectTitle: string | null }> => {
      if (!initDone) return { block: null, projectTitle: null };
      const res = await fetch(`/api/product-card-projects/${pid}`);
      const parsed = await readJsonSafe<{
        project?: { title?: string | null; metadata?: { cardBuilder?: CardBuilderBlockPayload } };
      }>(res);
      if (!parsed.ok || !res.ok) return { block: null, projectTitle: null };
      const title =
        typeof parsed.data.project?.title === "string" ? parsed.data.project.title.trim() : null;
      return {
        block: parsed.data.project?.metadata?.cardBuilder ?? null,
        projectTitle: title || null,
      };
    },
    [initDone],
  );

  const applySlidesAndHistoryFromBlock = useCallback((blk: CardBuilderBlockPayload | null) => {
    const list = blk?.galleryPlan;
    if (Array.isArray(list) && list.length) {
      setSlides(list as GallerySlide[]);
      setActiveSlideId((prev) => {
        if (prev && list.some((s: GallerySlide) => s.slideId === prev)) return prev;
        return (list[0] as GallerySlide).slideId;
      });
    }
    const rawGens = blk?.generations;
    const slideGenRestore: Record<string, { status: string; url: string | null }> = {};
    if (Array.isArray(rawGens)) {
      const rows: CardBuilderGenHistoryRow[] = [];
      for (const x of rawGens) {
        if (!x || typeof x !== "object") continue;
        const r = x as Record<string, unknown>;
        const id = typeof r.generationId === "string" ? r.generationId.trim() : "";
        const slideId = typeof r.slideId === "string" ? r.slideId.trim() : "";
        if (!id || !slideId) continue;
        const row: CardBuilderGenHistoryRow = {
          generationId: id,
          slideId,
        };
        if (typeof r.imageRole === "string") row.imageRole = r.imageRole;
        if (typeof r.createdAt === "string") row.createdAt = r.createdAt;
        if (typeof r.status === "string") row.status = r.status;
        if (typeof r.errorMessage === "string" && r.errorMessage.trim()) {
          row.errorMessage = r.errorMessage.trim().slice(0, 320);
        }
        const finalUrl = typeof r.finalUrl === "string" ? r.finalUrl.trim() : "";
        if (finalUrl) {
          row.finalUrl = finalUrl;
          const st = (row.status ?? "").toLowerCase();
          if (st === "done" || st === "completed" || !row.status) {
            slideGenRestore[slideId] = { status: "done", url: finalUrl };
          }
        }
        rows.push(row);
      }
      setGenHistory(rows);
      setSlideGen((prev) => ({ ...prev, ...slideGenRestore }));
    } else {
      setGenHistory([]);
      setSlideGen({});
    }
  }, []);

  const applyHydratedSettingsFromSaved = useCallback(
    (saved: Record<string, unknown>) => {
      if (typeof saved.cardBuilderCategoryKey === "string" && saved.cardBuilderCategoryKey.trim()) {
        setCategoryKey(saved.cardBuilderCategoryKey.trim() as CardBuilderUniversalCategoryId);
      }
      if (saved.categoryManuallyOverridden === true) {
        setCategoryManuallyOverridden(true);
      }
      if (typeof saved.productType === "string") setProductType(saved.productType);
      if (typeof saved.productNameGuess === "string") setProductNameGuess(saved.productNameGuess);
      if (Array.isArray(saved.productFacts)) {
        setProductFacts(normalizeProductFactsList(saved.productFacts));
      }
      if (saved.visionAnalysis && typeof saved.visionAnalysis === "object") {
        const va = saved.visionAnalysis as Record<string, unknown>;
        setVisionAnalysis(va);
        setVisionSummary({
          categoryKey: typeof va.categoryKey === "string" ? va.categoryKey : undefined,
          productType: typeof va.productType === "string" ? va.productType : undefined,
          productNameGuess: typeof va.productNameGuess === "string" ? va.productNameGuess : undefined,
          mainColors: Array.isArray(va.mainColors)
            ? va.mainColors.filter((x): x is string => typeof x === "string")
            : undefined,
          styleGuess: typeof va.styleGuess === "string" ? va.styleGuess : null,
          materialGuess: typeof va.materialGuess === "string" ? va.materialGuess : null,
          analysisFailed: va.analysisFailed === true,
          warnings: Array.isArray(va.warnings)
            ? va.warnings.filter((x): x is string => typeof x === "string")
            : undefined,
        });
      }
      if (saved.creationMode === "single" || saved.creationMode === "full_gallery") {
        setCreationMode(saved.creationMode);
      }
      if (typeof saved.singleCardType === "string" && saved.singleCardType.trim()) {
        setSingleCardType(saved.singleCardType.trim() as CardBuilderSingleCardTypeId);
      }
      if (typeof saved.visualStyle === "string" && saved.visualStyle.trim()) {
        setVisualStyle(saved.visualStyle.trim() as CardBuilderVisualStyleId);
      }
      if (typeof saved.textDensity === "string" && saved.textDensity.trim()) {
        setTextAmountToggle(textDensityToToggle(saved.textDensity.trim()));
      }
      if (saved.gallerySlideCount === 8) setGallerySlideCount(8);

      const rawSr = saved.styleReference;
      if (rawSr && typeof rawSr === "object" && !Array.isArray(rawSr)) {
        const s = rawSr as Record<string, unknown>;
        setStyleReferenceEnabled(s.enabled === true);
        const stRaw = typeof s.strength === "string" ? s.strength.trim() : "";
        setStyleReferenceStrength(
          stRaw === "low" || stRaw === "high" || stRaw === "medium" ? stRaw : "medium",
        );
        setStyleReferenceFlags({
          useComposition: s.useComposition === true,
          useBackground: s.useBackground === true,
          useColors: s.useColors === true,
          useTypography: s.useTypography === true,
          useBadges: s.useBadges === true,
          useIcons: s.useIcons === true,
          useMood: s.useMood === true,
          useOverallPresentation: s.useOverallPresentation === true,
        });
        const idList = Array.isArray(s.referenceAssetIds)
          ? s.referenceAssetIds
              .filter((x): x is string => typeof x === "string" && x.trim().length > 0)
              .slice(0, 3)
          : [];
        setStyleReferenceImages(
          idList.map((fid, idx) => ({
            fileId: fid.trim(),
            url: "",
            fileName: `Референс ${idx + 1}`,
            size: 0,
          })),
        );
      } else {
        setStyleReferenceEnabled(false);
        setStyleReferenceStrength("medium");
        setStyleReferenceFlags({
          useComposition: DEFAULT_CARD_BUILDER_STYLE_REFERENCE.useComposition,
          useBackground: DEFAULT_CARD_BUILDER_STYLE_REFERENCE.useBackground,
          useColors: DEFAULT_CARD_BUILDER_STYLE_REFERENCE.useColors,
          useTypography: DEFAULT_CARD_BUILDER_STYLE_REFERENCE.useTypography,
          useBadges: DEFAULT_CARD_BUILDER_STYLE_REFERENCE.useBadges,
          useIcons: DEFAULT_CARD_BUILDER_STYLE_REFERENCE.useIcons,
          useMood: DEFAULT_CARD_BUILDER_STYLE_REFERENCE.useMood,
          useOverallPresentation: DEFAULT_CARD_BUILDER_STYLE_REFERENCE.useOverallPresentation,
        });
        setStyleReferenceImages([]);
      }
    },
    [],
  );

  /** Обновление плана галереи и истории генераций без перезаписи полей формы. */
  const refreshHistoryAndPlanStatus = useCallback(async () => {
    const pid = projectId;
    if (!pid || !initDone) return;
    const { block: blk, projectTitle: fetchedTitle } = await fetchCardBuilderBlockForProject(pid);
    if (pid !== projectId) return;
    applySlidesAndHistoryFromBlock(blk);
    if (fetchedTitle) setProjectTitle(fetchedTitle);
  }, [projectId, initDone, fetchCardBuilderBlockForProject, applySlidesAndHistoryFromBlock]);

  const runVisionAnalysis = useCallback(
    async (options?: { projectId?: string; force?: boolean; manual?: boolean }) => {
      const pid = options?.projectId ?? projectId;
      if (!pid || !initDone) return;
      if (!options?.force && !options?.manual && !hasCardBuilderImage) return;
      if (options?.manual) {
        hydrateVisionTriggeredRef.current = null;
      }
      setVisionLoading(true);
      try {
        const res = await fetch(`/api/product-card-projects/${pid}/vision-analysis`, {
          method: "POST",
        });
        const parsed = await readJsonSafe<VisionSummary & { productFacts?: CardBuilderProductFact[] }>(
          res,
        );
        if (!parsed.ok || !res.ok) {
          toast.error(parsed.ok ? "Не удалось распознать товар" : parsed.message);
          return;
        }
        const d = parsed.data;
        if (d.analysisFailed) {
          const msg =
            d.warnings?.find((w) => typeof w === "string" && w.trim())?.trim() ??
            "Не удалось распознать товар — заполните данные вручную.";
          toast.error(msg);
          hydrateVisionTriggeredRef.current = null;
        }
        setVisionSummary({
          categoryKey: d.categoryKey,
          productType: d.productType,
          productNameGuess: d.productNameGuess,
          mainColors: d.mainColors,
          styleGuess: d.styleGuess,
          materialGuess: d.materialGuess,
          analysisFailed: d.analysisFailed,
          warnings: d.warnings,
        });
        setVisionAnalysis(d as unknown as Record<string, unknown>);
        if (d.productType?.trim()) setProductType(d.productType.trim());
        if (d.productNameGuess?.trim()) setProductNameGuess(d.productNameGuess.trim());
        if (!categoryManuallyOverridden && d.categoryKey) {
          setCategoryKey(d.categoryKey as CardBuilderUniversalCategoryId);
        }
        if (Array.isArray(d.productFacts) && d.productFacts.length) {
          setProductFacts((prev) => {
            const merged = normalizeProductFactsList(d.productFacts);
            const userBenefits = prev.filter((f) => f.type === "benefit" && f.source === "user");
            const userPurpose = prev.filter(
              (f) => f.type === "product_purpose" && f.source === "user",
            );
            if (userBenefits.length === 0 && userPurpose.length === 0) return merged;
            const mergedRest = merged.filter(
              (f) => f.type !== "benefit" && f.type !== "product_purpose",
            );
            return normalizeProductFactsList([...mergedRest, ...userBenefits, ...userPurpose]);
          });
        }
      } finally {
        setVisionLoading(false);
      }
    },
    [projectId, initDone, hasCardBuilderImage, categoryManuallyOverridden],
  );

  const persistCardBuilderSourceImage = useCallback(
    async (next: SourceImageValue): Promise<boolean> => {
      if (!initDone) {
        toast.error("Страница ещё загружается — подождите секунду.");
        return false;
      }
      setSourceImageSaving(true);
      try {
        const pid = projectId ?? (await ensureProjectId());
        if (!pid) {
          toast.error("Не удалось создать проект. Повторите попытку.");
          return false;
        }

        if (!next?.url?.trim() || !next.fileId?.trim()) {
          if (!projectId) {
            setSourceImage(null);
            resetVisionState();
            return true;
          }
          const res = await fetch(
            `/api/product-card-projects/${pid}/card-builder/source-image`,
            { method: "DELETE" },
          );
          const parsed = await readJsonSafe<{ error?: string }>(res);
          if (!parsed.ok || !res.ok) {
            toast.error(parsed.ok ? "Не удалось удалить фото" : parsed.message);
            return false;
          }
          setSourceImage(null);
          resetVisionState();
          setSlides([]);
          setActiveSlideId(null);
          cbPricingSnapRef.current = { lastPlanHash: null, singleCredits: null, galleryCredits: null };
          return true;
        }

        const res = await fetch(
          `/api/product-card-projects/${pid}/card-builder/source-image`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              url: next.url.trim(),
              fileId: next.fileId.trim(),
              fileName: next.fileName,
              size: next.size,
            }),
          },
        );
        const parsed = await readJsonSafe<{ error?: string }>(res);
        if (!parsed.ok || !res.ok) {
          toast.error(
            parsed.ok
              ? typeof parsed.data.error === "string"
                ? parsed.data.error
                : "Не удалось сохранить фото"
              : parsed.message,
          );
          return false;
        }
        setSourceImage(next);
        resetVisionState();
        hydrateVisionTriggeredRef.current = null;
        setSlides([]);
        setActiveSlideId(null);
        setSlideGen({});
        cbPricingSnapRef.current = { lastPlanHash: null, singleCredits: null, galleryCredits: null };
        void runVisionAnalysis({ projectId: pid, force: true });
        return true;
      } finally {
        setSourceImageSaving(false);
      }
    },
    [initDone, projectId, ensureProjectId, resetVisionState, runVisionAnalysis],
  );

  const handleCardBuilderSourceImageChange = useCallback(
    (next: SourceImageValue) => {
      void persistCardBuilderSourceImage(next);
    },
    [persistCardBuilderSourceImage],
  );

  /** Гидратация полей формы только при первом заходе на проект или после смены projectId. */
  const hydrateFormFromServer = useCallback(async () => {
    const pid = projectId;
    if (!pid || !initDone) return;
    const { block: blk, projectTitle: fetchedTitle } = await fetchCardBuilderBlockForProject(pid);
    if (pid !== projectId) return;
    if (fetchedTitle) setProjectTitle(fetchedTitle);
    const saved = blk?.settings;
    const needsFormHydrate = hydratedProjectIdRef.current !== pid;
    if (needsFormHydrate && saved && typeof saved === "object" && !userEditedFormRef.current) {
      applyHydratedSettingsFromSaved(saved);
    }
    if (needsFormHydrate) {
      hydratedProjectIdRef.current = pid;
    }
    applySourceImageFromBlock(blk);
    applySlidesAndHistoryFromBlock(blk);

    const img = blk?.sourceImage;
    const hasDedicatedPhoto = Boolean(img?.url?.trim() && img?.fileId?.trim());
    const hasProjectPhoto = Boolean(
      projectSource?.url?.trim() &&
        projectSource.fileId?.trim() &&
        !projectSource.isLocalPreview,
    );
    const hasPhoto = hasDedicatedPhoto || hasProjectPhoto;
    const hasSavedVision =
      saved &&
      typeof saved === "object" &&
      saved.visionAnalysis &&
      typeof saved.visionAnalysis === "object";
    if (
      hasPhoto &&
      !hasSavedVision &&
      hydrateVisionTriggeredRef.current !== pid
    ) {
      hydrateVisionTriggeredRef.current = pid;
      void runVisionAnalysis({ projectId: pid, force: true });
    }
  }, [
    projectId,
    initDone,
    projectSource,
    fetchCardBuilderBlockForProject,
    applyHydratedSettingsFromSaved,
    applySlidesAndHistoryFromBlock,
    applySourceImageFromBlock,
    runVisionAnalysis,
  ]);

  const runPlan = useCallback(async () => {
    if (!projectId) return;
    setPlanLoading(true);
    setPlanError(null);
    try {
      const res = await fetch(`/api/product-card-projects/${projectId}/card-builder/plan`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(planPayload),
      });
      const parsed = await readJsonSafe<{
        slides?: GallerySlide[];
        error?: string;
        planWarning?: string;
      }>(res);
      if (!parsed.ok) {
        setPlanError(parsed.message);
        return;
      }
      if (!res.ok) {
        setPlanError(parsed.data.error ?? "Не удалось сохранить структуру");
        return;
      }
      if (parsed.data.planWarning?.trim()) {
        toast.message(parsed.data.planWarning.trim(), { duration: 10_000 });
      }
      const list = parsed.data.slides ?? [];
      setSlides(list);
      setActiveSlideId(list[0]?.slideId ?? null);
      cbPricingSnapRef.current.lastPlanHash = null;
      userEditedFormRef.current = false;
      await refreshHistoryAndPlanStatus();
    } finally {
      setPlanLoading(false);
    }
  }, [projectId, planPayload, refreshHistoryAndPlanStatus]);

  const runEstimate = useCallback(
    async (mode: "single_slide" | "full_gallery") => {
      if (!projectId) return;
      setEstimating(true);
      try {
        const res = await fetch(`/api/product-card-projects/${projectId}/estimate/card-builder`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            source: slides.length ? "saved" : "payload",
            payload: slides.length ? undefined : planPayload,
            mode,
            activeSlideId:
              activeSlideId && slides.some((s) => s.slideId === activeSlideId)
                ? activeSlideId
                : undefined,
          }),
        });
        const parsed = await readJsonSafe<{
          credits?: number;
          planHash?: string;
          error?: string;
          code?: string;
        }>(res);
        if (!parsed.ok) {
          setPlanError(parsed.message);
          return;
        }
        if (!res.ok) {
          setPlanError(parsed.data.error ?? "Оценка недоступна");
          return;
        }
        const c = parsed.data.credits ?? null;
        const ph = typeof parsed.data.planHash === "string" ? parsed.data.planHash : null;
        if (ph) {
          cbPricingSnapRef.current.lastPlanHash = ph;
        }
        if (mode === "single_slide") {
          setEstimateSingle(c);
          if (typeof c === "number" && Number.isFinite(c)) {
            cbPricingSnapRef.current.singleCredits = c;
          }
        } else {
          setEstimateGallery(c);
          if (typeof c === "number" && Number.isFinite(c)) {
            cbPricingSnapRef.current.galleryCredits = c;
          }
        }
      } finally {
        setEstimating(false);
      }
    },
    [projectId, planPayload, slides, activeSlideId],
  );

  const pollGen = useCallback(async (generationId: string) => {
    const done = new Set(["COMPLETED"]);
    const terminalBad = new Set(["FAILED", "CANCELLED", "REFUNDED", "BLOCKED"]);
    for (let i = 0; i < IMAGE_GENERATION_POLL_MAX_ITERATIONS; i++) {
      const res = await fetch(`/api/generations/${generationId}`);
      const parsed = await readJsonSafe<{ status: string; outputFiles?: unknown }>(res);
      if (!parsed.ok || !res.ok) break;
      const st = parsed.data.status;
      if (done.has(st)) {
        return getFirstOutputUrlFromJson(parsed.data.outputFiles) ?? null;
      }
      if (terminalBad.has(st)) break;
      await new Promise((r) => setTimeout(r, IMAGE_GENERATION_POLL_INTERVAL_MS));
    }
    return null;
  }, []);

  const changeSlideTemplate = useCallback(
    async (slideId: string, templateId: string) => {
      if (!projectId) return;
      setTplBusySlideId(slideId);
      setPlanError(null);
      try {
        const res = await fetch(
          `/api/product-card-projects/${projectId}/card-builder/slide-template`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ slideId, templateId }),
          },
        );
        const parsed = await readJsonSafe<{
          galleryPlan?: GallerySlide[];
          error?: string;
          code?: string;
        }>(res);
        if (!parsed.ok) {
          setPlanError(parsed.message);
          return;
        }
        if (!res.ok) {
          setPlanError(parsed.data.error ?? "Не удалось сменить шаблон");
          return;
        }
        const list = parsed.data.galleryPlan;
        if (Array.isArray(list) && list.length) {
          setSlides(list);
          cbPricingSnapRef.current.lastPlanHash = null;
        }
      } finally {
        setTplBusySlideId(null);
      }
    },
    [projectId],
  );

  const generateOne = useCallback(
    async (slideId: string) => {
      if (!projectId) return;
      setGenBusy(true);
      try {
        const hash = cbPricingSnapRef.current.lastPlanHash;
        const cred = cbPricingSnapRef.current.singleCredits;
        if (!hash || cred == null) {
          toast.error("Сначала нажмите «Оценить один слайд».");
          return;
        }
        const res = await fetch(
          `/api/product-card-projects/${projectId}/generate/card-builder-slide`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              slideId,
              clientEstimateCredits: cred,
              clientPlanHash: hash,
              useSavedPlan: true,
            }),
          },
        );
        const parsed = await readJsonSafe<{
          generationId?: string;
          error?: string;
          code?: string;
          marketplaceNotice?: string;
        }>(res);
        if (!parsed.ok) {
          setPlanError(parsed.message);
          return;
        }
        if (!res.ok) {
          const msg = parsed.data.error ?? "Не удалось запустить генерацию";
          setPlanError(msg);
          if (parsed.data.code === "PLAN_CHANGED" || parsed.data.code === "PRICE_CHANGED") {
            toast.error(msg);
          }
          return;
        }
        const notice = parsed.data.marketplaceNotice?.trim();
        if (notice) {
          toast.message(notice);
        }
        const gid = parsed.data.generationId;
        if (!gid) return;
        setSlideGen((prev) => ({
          ...prev,
          [slideId]: { status: "generating", url: prev[slideId]?.url ?? null },
        }));
        const url = await pollGen(gid);
        setSlideGen((prev) => ({
          ...prev,
          [slideId]: { status: url ? "done" : "error", url },
        }));
        await refreshHistoryAndPlanStatus();
      } finally {
        setGenBusy(false);
      }
    },
    [projectId, pollGen, refreshHistoryAndPlanStatus],
  );

  const generateAll = useCallback(async () => {
    if (!projectId) return;
    setBatchBusy(true);
    await runEstimate("full_gallery");
    const gh = cbPricingSnapRef.current.lastPlanHash;
    const ggc = cbPricingSnapRef.current.galleryCredits;
    if (!gh || ggc == null) {
      toast.error("Сначала дождитесь оценки всей галереи.");
      setBatchBusy(false);
      return;
    }
    try {
      const res = await fetch(`/api/product-card-projects/${projectId}/generate/card-builder`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientEstimateCredits: ggc,
          clientPlanHash: gh,
        }),
      });
      const parsed = await readJsonSafe<{
        totalCredits?: number;
        results?: { slideId?: string; generationId?: string; error?: string }[];
        error?: string;
        code?: string;
      }>(res);
      if (!parsed.ok) {
        setPlanError(parsed.message);
        return;
      }
      if (!res.ok) {
        const msg = parsed.data.error ?? "Пакетная генерация недоступна";
        setPlanError(msg);
        if (parsed.data.code === "PLAN_CHANGED" || parsed.data.code === "PRICE_CHANGED") {
          toast.error(msg);
        }
        return;
      }
      const rows = parsed.data.results ?? [];
      for (const row of rows) {
        if (!row.slideId) continue;
        if (row.generationId) {
          setSlideGen((p) => ({
            ...p,
            [row.slideId!]: { status: "generating", url: p[row.slideId!]?.url ?? null },
          }));
          const url = await pollGen(row.generationId);
          setSlideGen((p) => ({
            ...p,
            [row.slideId!]: { status: url ? "done" : "error", url },
          }));
        } else {
          setSlideGen((p) => ({
            ...p,
            [row.slideId!]: { status: "error", url: p[row.slideId!]?.url ?? null },
          }));
        }
      }
    } finally {
      setBatchBusy(false);
      await refreshHistoryAndPlanStatus();
    }
  }, [projectId, pollGen, runEstimate, refreshHistoryAndPlanStatus]);

  useEffect(() => {
    hydratedProjectIdRef.current = null;
    autoSyncedFromProjectRef.current = null;
    hydrateVisionTriggeredRef.current = null;
    userEditedFormRef.current = false;
    void Promise.resolve().then(() => {
      setCategoryKey("auto");
      setCategoryManuallyOverridden(false);
      setProductType("");
      setProductNameGuess("");
      setProductFacts([]);
      setVisionAnalysis(null);
      setVisionSummary(null);
      setVisionLoading(false);
      setCreationMode("full_gallery");
      setSingleCardType("auto");
      setVisualStyle("auto");
      setTextAmountToggle("more");
      setGallerySlideCount(6);
      setProjectTitle(null);
      setSlides([]);
      setActiveSlideId(null);
      setPlanError(null);
      setEstimateSingle(null);
      setEstimateGallery(null);
      setSlideGen({});
      setGenHistory([]);
      setStyleReferenceEnabled(false);
      setStyleReferenceStrength("medium");
      setStyleReferenceFlags({
        useComposition: DEFAULT_CARD_BUILDER_STYLE_REFERENCE.useComposition,
        useBackground: DEFAULT_CARD_BUILDER_STYLE_REFERENCE.useBackground,
        useColors: DEFAULT_CARD_BUILDER_STYLE_REFERENCE.useColors,
        useTypography: DEFAULT_CARD_BUILDER_STYLE_REFERENCE.useTypography,
        useBadges: DEFAULT_CARD_BUILDER_STYLE_REFERENCE.useBadges,
        useIcons: DEFAULT_CARD_BUILDER_STYLE_REFERENCE.useIcons,
        useMood: DEFAULT_CARD_BUILDER_STYLE_REFERENCE.useMood,
        useOverallPresentation: DEFAULT_CARD_BUILDER_STYLE_REFERENCE.useOverallPresentation,
      });
      setStyleReferenceImages([]);
      setStyleReferenceUploading(false);
      setSourceImage(null);
      setSourceImageSaving(false);
      cbPricingSnapRef.current = { lastPlanHash: null, singleCredits: null, galleryCredits: null };
    });
  }, [projectId]);

  useEffect(() => {
    if (!projectId || !initDone) return;
    void Promise.resolve().then(() => void hydrateFormFromServer());
  }, [projectId, initDone, hydrateFormFromServer]);

  /** Подставить общее фото проекта, если для card_builder ещё нет отдельного снимка. */
  useEffect(() => {
    if (!initDone || !projectId || sourceImageSaving) return;
    if (hasDedicatedCardBuilderImage) return;
    if (autoSyncedFromProjectRef.current === projectId) return;
    const ps = projectSource;
    if (!ps?.url?.trim() || !ps.fileId?.trim() || ps.isLocalPreview) return;

    autoSyncedFromProjectRef.current = projectId;
    queueMicrotask(() => {
      void persistCardBuilderSourceImage(ps);
    });
  }, [
    initDone,
    projectId,
    hasDedicatedCardBuilderImage,
    projectSource,
    sourceImageSaving,
    persistCardBuilderSourceImage,
  ]);

  const styleReferencePreviewActive =
    styleReferenceEnabled && styleReferenceImages.some((x) => Boolean(x.fileId?.trim()));
  const primaryStyleReferenceThumbUrl =
    styleReferenceImages.find((x) => typeof x.url === "string" && x.url.trim())?.url ?? "";

  return (
    <div className="grid gap-6 lg:grid-cols-2 lg:items-start">
      <div className="space-y-4">
        {planError && (
          <Alert variant="destructive">
            <AlertTitle>Ошибка</AlertTitle>
            <AlertDescription>{planError}</AlertDescription>
          </Alert>
        )}

        <Alert>
          <AlertTitle>Текст на изображении</AlertTitle>
          <AlertDescription>
            Лимиты для одного слайда: одна текстовая фраза до ~400 символов; суммарно не больше 16 значимых фраз.
          </AlertDescription>
        </Alert>

        <Card className="rounded-2xl border-border">
          <CardContent className="pt-6">
            <SourceImageUpload
              value={sourceImage ?? (hasProjectImage ? projectSource : null)}
              onChange={handleCardBuilderSourceImageChange}
              disabled={!canUploadCardBuilderImage}
              uploadPurpose="product_card_card_builder_source"
              title="Фото для «Создать карточку»"
              description={
                hasDedicatedCardBuilderImage
                  ? "Отдельное фото для этого сценария. Можно заменить на другое — оно не меняет общее фото проекта выше."
                  : "По умолчанию используется фото из блока выше. При необходимости загрузите другое — только для этого сценария."
              }
            />
          </CardContent>
        </Card>

        {!hasCardBuilderImage ? (
          <Alert>
            <AlertTitle>Загрузите фото</AlertTitle>
            <AlertDescription>
              Загрузите фото товара в блоке вверху страницы или в поле выше — без фото генерация недоступна.
            </AlertDescription>
          </Alert>
        ) : null}

        <CardBuilderUniversalPanel
          visionLoading={visionLoading}
          visionSummary={visionSummary}
          categoryKey={categoryKey}
          productType={productType}
          productFacts={productFacts}
          creationMode={creationMode}
          singleCardType={singleCardType}
          visualStyle={visualStyle}
          onCategoryKeyChange={(v) => {
            markUserEditedForm();
            setCategoryManuallyOverridden(true);
            setCategoryKey(v);
          }}
          onProductTypeChange={(v) => {
            markUserEditedForm();
            setProductType(v);
          }}
          onProductFactsChange={(facts) => {
            markUserEditedForm();
            setProductFacts(facts);
          }}
          onCreationModeChange={(v) => {
            markUserEditedForm();
            setCreationMode(v);
          }}
          onSingleCardTypeChange={(v) => {
            markUserEditedForm();
            setSingleCardType(v);
          }}
          onVisualStyleChange={(v) => {
            markUserEditedForm();
            setVisualStyle(v);
          }}
          textAmountToggle={textAmountToggle}
          onTextAmountToggleChange={(v) => {
            markUserEditedForm();
            setTextAmountToggle(v);
          }}
          onRetryAnalysis={() => void runVisionAnalysis({ manual: true })}
          canRetryAnalysis={canWork}
          gallerySlideCount={gallerySlideCount}
          onGallerySlideCountChange={(v) => {
            markUserEditedForm();
            setGallerySlideCount(v);
          }}
        />

        <Card className="rounded-2xl border-border">
          <CardHeader>
            <CardTitle className="text-base">Референс стиля (необязательно)</CardTitle>
            <CardDescription>
              Загрузите пример карточки или фото в желаемом стиле. Мы используем его как ориентир по дизайну, но
              не будем копировать чужой товар или текст.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-2">
              <input
                id={`${styleReferenceFieldId}-toggle`}
                type="checkbox"
                checked={styleReferenceEnabled}
                onChange={(e) => {
                  markUserEditedForm();
                  setStyleReferenceEnabled(e.target.checked);
                }}
                className="border-input accent-primary size-4 shrink-0 rounded border"
              />
              <Label htmlFor={`${styleReferenceFieldId}-toggle`}>Использовать референс стиля</Label>
            </div>

            <div className="space-y-2">
              <Label htmlFor={`${styleReferenceFieldId}-strength`}>Сила влияния</Label>
              <select
                id={`${styleReferenceFieldId}-strength`}
                className={nativeFieldClass}
                value={styleReferenceStrength}
                onChange={(e) => {
                  markUserEditedForm();
                  const v = e.target.value;
                  if (v === "low" || v === "medium" || v === "high") setStyleReferenceStrength(v);
                }}
              >
                <option value="low">Низкая</option>
                <option value="medium">Средняя</option>
                <option value="high">Высокая</option>
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor={styleReferenceFieldId}>Изображения референса (1–3)</Label>
              <input
                ref={styleReferenceFileInputRef}
                id={styleReferenceFieldId}
                type="file"
                accept={STYLE_REF_ACCEPT}
                multiple
                className="sr-only"
                onChange={(e) => void handleStyleReferenceFileInputChange(e)}
              />
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className="rounded-xl"
                  disabled={
                    !initDone || !projectId || styleReferenceUploading || styleReferenceImages.length >= 3
                  }
                  onClick={() => styleReferenceFileInputRef.current?.click()}
                >
                  {styleReferenceUploading ? "Загрузка…" : "Выбрать файлы"}
                </Button>
                <span className="text-muted-foreground text-xs">
                  PNG, JPG, WebP · до {STYLE_REF_MAX_MB} МБ · максимум 3 файла
                </span>
              </div>
            </div>

            {styleReferenceImages.length ? (
              <div className="space-y-2">
                {styleReferenceImages.map((row, idx) => (
                  <div
                    key={row.fileId ?? `style-ref-${idx}`}
                    className="flex items-start gap-3 rounded-xl border border-border bg-card p-2"
                  >
                    <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-lg border bg-muted">
                      {row.url ? (
                        <>
                          {/* eslint-disable-next-line @next/next/no-img-element -- динамический URL из uploads */}
                          <img src={row.url} alt="" className="size-full object-cover" />
                        </>
                      ) : (
                        <div className="text-muted-foreground flex size-full items-center justify-center text-[10px]">
                          Нет превью
                        </div>
                      )}
                    </div>
                    <div className="min-w-0 flex-1 text-xs leading-snug">
                      <div className="truncate font-medium">{row.fileName || `Референс ${idx + 1}`}</div>
                      {row.size ? (
                        <div className="text-muted-foreground">
                          {(row.size / (1024 * 1024)).toFixed(1)} МБ
                        </div>
                      ) : null}
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="shrink-0 text-destructive"
                      onClick={() => removeStyleReferenceAt(idx)}
                    >
                      Удалить
                    </Button>
                  </div>
                ))}
              </div>
            ) : null}
          </CardContent>
        </Card>

        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            className="rounded-xl"
            disabled={!canWork || planLoading}
            onClick={() => void runPlan()}
          >
            {planLoading ? "Сохранение…" : creationMode === "single" ? "Сгенерировать карточку" : "Сгенерировать структуру"}
          </Button>
          <Button
            type="button"
            variant="outline"
            className="rounded-xl"
            disabled={!canWork || estimating}
            onClick={() => void runEstimate("single_slide")}
          >
            Оценить один слайд
          </Button>
          <Button
            type="button"
            variant="outline"
            className="rounded-xl"
            disabled={!canWork || estimating || slides.length === 0}
            onClick={() => void runEstimate("full_gallery")}
          >
            Оценить всю галерею
          </Button>
        </div>

        <div className="flex flex-wrap gap-2 text-sm text-muted-foreground">
          {estimateSingle != null && (
            <span className="tabular-nums">Один слайд ≈ {estimateSingle} ток.</span>
          )}
          {estimateGallery != null && slides.length > 1 && (
            <span className="tabular-nums">Вся галерея ≈ {estimateGallery} ток.</span>
          )}
          <span className="tabular-nums text-foreground">
            Баланс: {balanceCredits}
          </span>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            className="rounded-xl"
            disabled={!canWork || !activeSlideId || batchBusy || genBusy}
            onClick={() => activeSlideId && void generateOne(activeSlideId)}
          >
            {genBusy ? "Запуск…" : "Сгенерировать выбранный слайд"}
          </Button>
          <Button
            type="button"
            variant="secondary"
            className="rounded-xl"
            disabled={!canWork || slides.length === 0 || batchBusy || genBusy}
            onClick={() => void generateAll()}
          >
            {batchBusy ? "Генерация галереи…" : "Сгенерировать все слайды"}
          </Button>
        </div>

        {genHistory.length ? (
          <Card className="rounded-2xl border-border">
            <CardHeader>
              <CardTitle className="text-base">Создать карточку — ранее в проекте</CardTitle>
              <CardDescription>Отдельно от карточки маркетплейса и других сценариев</CardDescription>
            </CardHeader>
            <CardContent className="max-h-64 space-y-2 overflow-y-auto text-sm">
              {[...genHistory].reverse().map((g) => {
                const slide = slides.find((s) => s.slideId === g.slideId);
                const slideTitle = slide?.title ?? "Слайд";
                const slideLabel =
                  getUserFacingSlideLabel(g.imageRole ?? slide?.imageRole) ?? slideTitle;
                const previewUrl =
                  slideGen[g.slideId]?.url ?? g.finalUrl ?? null;
                const statusLabel = g.status
                  ? getUserFacingGenerationStatusFromRaw(g.status)
                  : null;
                const userError = g.errorMessage
                  ? mapGenerationErrorToUserMessage(g.errorMessage)
                  : null;
                return (
                  <div
                    key={`${g.generationId}-${g.createdAt ?? ""}`}
                    className="flex flex-wrap items-start justify-between gap-2 rounded-lg border border-border px-3 py-2"
                  >
                    <div className="flex min-w-0 gap-2">
                      {previewUrl ? (
                        <div className="bg-muted h-12 w-12 shrink-0 overflow-hidden rounded-md border">
                          {/* eslint-disable-next-line @next/next/no-img-element -- generation preview */}
                          <img
                            src={previewUrl}
                            alt=""
                            className="h-full w-full object-cover"
                          />
                        </div>
                      ) : null}
                      <div className="min-w-0">
                        <div className="font-medium">Создать карточку</div>
                        <div className="text-muted-foreground text-xs">Слайд: {slideLabel}</div>
                        <div className="text-muted-foreground text-xs">
                          {g.createdAt
                            ? new Date(g.createdAt).toLocaleString("ru-RU", {
                                dateStyle: "short",
                                timeStyle: "short",
                              })
                            : "—"}
                          {statusLabel ? <> · {statusLabel}</> : null}
                        </div>
                        {userError ? (
                          <p className="text-destructive mt-1 max-w-[min(28rem,88vw)] text-[11px] leading-snug">
                            {userError}
                          </p>
                        ) : null}
                      </div>
                    </div>
                    <div className="flex shrink-0 flex-wrap gap-2">
                      {previewUrl && g.status?.toLowerCase() === "done" ? (
                        <a
                          href={`/api/generations/${g.generationId}/download`}
                          className="text-primary text-xs font-medium underline"
                          target="_blank"
                          rel="noreferrer"
                        >
                          Скачать
                        </a>
                      ) : null}
                      <Link
                        href={`/dashboard/history/${g.generationId}`}
                        className="text-primary text-xs font-medium underline"
                      >
                        Открыть
                      </Link>
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        ) : null}
      </div>

      <div className="lg:sticky lg:top-24 space-y-3">
        <CardBuilderGalleryPreview
          slides={slides}
          productFacts={productFacts}
          productTitle={computedProductTitle}
          textDensity={previewTextDensity}
          mainPhotoTextAllowed={templateProfile.mainPhotoTextAllowed}
          slideGen={slideGen}
          activeSlideId={activeSlideId}
          onSelectSlide={setActiveSlideId}
          canWork={canWork}
          genBusy={genBusy}
          batchBusy={batchBusy}
          tplBusySlideId={tplBusySlideId}
          resolvedPlannerCategory={resolvedPlannerCategory}
          templateProfile={templateProfile}
          onChangeTemplate={changeSlideTemplate}
          onGenerateSlide={(slideId) => void generateOne(slideId)}
          styleReferencePreviewActive={styleReferencePreviewActive}
          primaryStyleReferenceThumbUrl={primaryStyleReferenceThumbUrl}
          slideProgressLabel={slideProgressLabel}
        />
      </div>
    </div>
  );
}
