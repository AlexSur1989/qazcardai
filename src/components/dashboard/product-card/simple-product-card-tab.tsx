"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState, useId } from "react";
import { Loader2, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { InfoTooltip } from "@/components/ui/info-tooltip";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  SIMPLE_CARD_ASPECT_RATIOS,
  SIMPLE_CARD_CREATIVITY_DEFAULT,
  SIMPLE_CARD_CREATIVITY_MAX,
  SIMPLE_CARD_CREATIVITY_MIN,
  SIMPLE_CARD_DEFAULT_ASPECT_RATIO,
  SIMPLE_CARD_DEFAULT_STYLE_MODE,
  SIMPLE_CARD_STYLE_MODE_META,
  SIMPLE_CARD_USER_TEXT_MAX,
  type SimpleCardAspectRatio,
  type SimpleCardStyleMode,
} from "@/config/simple-product-card";
import {
  isProductCardImageResolutionAllowed,
  PRODUCT_CARD_IMAGE_RESOLUTION_DEFAULT,
  type ProductCardImageResolution,
} from "@/config/product-card-image-resolution";
import { SIMPLE_CARD_REFERENCE_UNSUPPORTED_MESSAGE } from "@/lib/simple-product-card-model";
import {
  PRODUCT_CARD_GENERATION_POLL_INTERVAL_MS,
  PRODUCT_CARD_GENERATION_POLL_MAX_ITERATIONS,
} from "@/lib/generation-client-polling";
import { readJsonSafe } from "@/lib/fetch-json-safe";
import type { UserFacingGenerationPollSnapshot } from "@/lib/generation-display";
import { cn } from "@/lib/utils";
import { mergeSimpleCardProductLabelIntoUserText } from "@/lib/simple-product-card-vision-text";
import {
  hasEnoughProductBenefits,
  SIMPLE_CARD_BENEFITS_REQUIRED_MESSAGE,
} from "@/lib/simple-product-card-benefits";
import { mapProductCardModelErrorForUser } from "@/lib/product-card-scenario-setup-copy";
import type { SimpleProductCardRequest } from "@/lib/validations/simple-product-card";

import type { ProductSourceImageValue, SourceImagesValue } from "./source-images-upload";
import {
  buildProductCardGenerationMock,
  ProductCardGenerationStatusPanel,
} from "./product-card-generation-status";
import { ProductCardImageResolutionPicker } from "./product-card-image-resolution-picker";

const REF_MAX_MB = 10;
const REF_MAX_BYTES = REF_MAX_MB * 1024 * 1024;
const REF_ACCEPT = "image/png,image/jpeg,image/jpg,image/webp";

const PRODUCT_PHOTO_ROLE_LABELS: Record<string, string> = {
  main: "Главное",
  side: "Сбоку",
  back: "Сзади",
  detail: "Детали",
};

type ReferenceRow = {
  url: string;
  fileName: string;
  size: number;
  fileId: string;
};

type SimpleCardVisionResponse = {
  productLabel?: string;
  suggestedUserText?: string;
  productNameGuess?: string;
  productType?: string;
  mainColors?: string[];
  materialGuess?: string | null;
  styleGuess?: string | null;
  analysisFailed?: boolean;
  warnings?: string[];
};

type SavedSimpleCardBlock = {
  settings?: SimpleProductCardRequest & { productLabel?: string };
  vision?: { productPhotoId?: string; analyzedAt?: string } & SimpleCardVisionResponse;
};

type Props = {
  projectId: string | null;
  initDone: boolean;
  ensureProjectId: () => Promise<string | null>;
  sourceImages: SourceImagesValue;
  balanceCredits: number;
  productLabel: string;
  userText: string;
  onProductLabelChange: (value: string) => void;
  onUserTextChange: (value: string) => void;
  selectedCategoryLabel?: string | null;
  showAdminHints?: boolean;
};

type PlanPreviewResponse = {
  ready: boolean;
  readinessStatus: "Ready" | "Not ready";
  userMessage: string;
  categoryLabel: string | null;
  productLabel: string | null;
  benefitsText: string;
  aspectRatio: string;
  resolution: string;
  credits: number;
  issues: string[];
  admin?: {
    modelSlug: string;
    apiModelId: string;
    adminModelEditUrl: string;
    payloadDryRunUrl: string;
  };
};

function isValidRefImage(file: File): boolean {
  const t = file.type.toLowerCase();
  if (t === "image/jpeg" || t === "image/jpg" || t === "image/png" || t === "image/webp") return true;
  return /\.(jpe?g|png|webp)$/i.test(file.name);
}

function graphemeLen(s: string): number {
  return [...s].length;
}

function buildPayload(input: {
  productPhotoId: string;
  productLabel: string;
  userText: string;
  styleMode: SimpleCardStyleMode;
  useReference: boolean;
  referenceImage: ReferenceRow | null;
  referenceCreativity: number;
  aspectRatio: SimpleCardAspectRatio;
  resolution: ProductCardImageResolution;
}): SimpleProductCardRequest {
  return {
    productPhotoId: input.productPhotoId,
    userText: mergeSimpleCardProductLabelIntoUserText(input.productLabel, input.userText),
    styleMode: input.styleMode,
    useReference: input.styleMode === "classic" ? input.useReference : input.styleMode === "reference",
    referenceImageId:
      input.styleMode === "premium"
        ? null
        : input.styleMode === "reference" || (input.styleMode === "classic" && input.useReference)
          ? input.referenceImage?.fileId ?? null
          : null,
    referenceCreativity:
      input.styleMode === "premium"
        ? null
        : input.styleMode === "reference" || (input.styleMode === "classic" && input.useReference)
          ? input.referenceCreativity
          : null,
    aspectRatio: input.aspectRatio,
    resolution: input.resolution,
  };
}

export function SimpleProductCardTab({
  projectId,
  initDone,
  ensureProjectId,
  sourceImages,
  balanceCredits,
  productLabel,
  userText,
  onProductLabelChange,
  onUserTextChange,
  selectedCategoryLabel = null,
  showAdminHints = false,
}: Props) {
  const refFieldId = useId();
  const photosWithId = useMemo(
    () => sourceImages.filter((img): img is ProductSourceImageValue & { fileId: string } => Boolean(img.fileId?.trim())),
    [sourceImages],
  );

  const [productPhotoId, setProductPhotoId] = useState<string>("");
  const [styleMode, setStyleMode] = useState<SimpleCardStyleMode>(SIMPLE_CARD_DEFAULT_STYLE_MODE);
  const [classicUseReference, setClassicUseReference] = useState(false);
  const [referenceImage, setReferenceImage] = useState<ReferenceRow | null>(null);
  const [referenceCreativity, setReferenceCreativity] = useState(SIMPLE_CARD_CREATIVITY_DEFAULT);
  const [aspectRatio, setAspectRatio] = useState<SimpleCardAspectRatio>(SIMPLE_CARD_DEFAULT_ASPECT_RATIO);
  const [resolution, setResolution] = useState<ProductCardImageResolution>(
    PRODUCT_CARD_IMAGE_RESOLUTION_DEFAULT,
  );

  const [supportsReference, setSupportsReference] = useState(true);
  const [estimating, setEstimating] = useState(false);
  const [estimateCredits, setEstimateCredits] = useState<number | null>(null);
  const [estErr, setEstErr] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);
  const [refUploading, setRefUploading] = useState(false);
  const [planPreview, setPlanPreview] = useState<PlanPreviewResponse | null>(null);
  const [planLoading, setPlanLoading] = useState(false);
  const [planError, setPlanError] = useState<string | null>(null);
  const [generationSnapshot, setGenerationSnapshot] = useState<UserFacingGenerationPollSnapshot | null>(
    null,
  );
  const [pollStale, setPollStale] = useState(false);
  const [adminPollDebug, setAdminPollDebug] = useState<Record<string, string | null | undefined> | null>(
    null,
  );

  const devMockPhase = useMemo(() => {
    if (process.env.NODE_ENV === "production") return null;
    if (typeof window === "undefined") return null;
    const raw = new URLSearchParams(window.location.search).get("pcGenMock")?.trim().toLowerCase();
    if (raw === "queued" || raw === "processing" || raw === "completed" || raw === "failed") {
      return raw;
    }
    return null;
  }, []);
  const devMockSnapshot = useMemo(
    () => (devMockPhase ? buildProductCardGenerationMock(devMockPhase) : null),
    [devMockPhase],
  );

  const pollTimerRef = useRef<number | null>(null);
  const pollFailuresRef = useRef(0);

  const clearGenerationPoll = useCallback(() => {
    if (pollTimerRef.current) {
      clearTimeout(pollTimerRef.current);
      pollTimerRef.current = null;
    }
    pollFailuresRef.current = 0;
  }, []);

  useEffect(() => () => clearGenerationPoll(), [clearGenerationPoll]);

  const resetGenerationUi = useCallback(() => {
    clearGenerationPoll();
    setGenerationSnapshot(null);
    setPollStale(false);
    setAdminPollDebug(null);
    setGenError(null);
    setGenerating(false);
  }, [clearGenerationPoll]);

  const activeSnapshot = devMockSnapshot ?? generationSnapshot;
  const refInputRef = useRef<HTMLInputElement>(null);

  const defaultProductPhotoId = useMemo(() => {
    const main = photosWithId.find((p) => p.role === "main") ?? photosWithId[0];
    return main?.fileId ?? "";
  }, [photosWithId]);

  const selectedProductPhotoId = useMemo(() => {
    const validIds = new Set(photosWithId.map((p) => p.fileId));
    if (productPhotoId && validIds.has(productPhotoId)) return productPhotoId;
    return defaultProductPhotoId;
  }, [productPhotoId, photosWithId, defaultProductPhotoId]);

  const prevMainPhotoIdRef = useRef(defaultProductPhotoId);
  useEffect(() => {
    const prevMain = prevMainPhotoIdRef.current;
    const nextMain = defaultProductPhotoId;
    prevMainPhotoIdRef.current = nextMain;
    if (!nextMain) return;

    setProductPhotoId((prev) => {
      const validIds = new Set(photosWithId.map((p) => p.fileId));
      if (!prev || !validIds.has(prev)) return nextMain;
      if (prevMain && prevMain !== nextMain && prev === prevMain) return nextMain;
      return prev;
    });
  }, [defaultProductPhotoId, photosWithId]);

  useEffect(() => {
    if (!projectId || !initDone) return;
    let cancelled = false;
    void (async () => {
      const res = await fetch(`/api/product-card-projects/${projectId}`);
      const parsed = await readJsonSafe<{
        project?: { metadata?: Record<string, unknown> };
        simpleCardReferencePreview?: {
          fileId: string;
          url: string;
          fileName: string;
          size: number;
        };
      }>(res);
      if (cancelled || !parsed.ok || !res.ok) return;
      const meta = parsed.data.project?.metadata as {
        marketplaceCard?: { simpleCard?: SavedSimpleCardBlock };
        cardBuilder?: { simpleCard?: SavedSimpleCardBlock };
      } | undefined;
      const block =
        meta?.marketplaceCard?.simpleCard ?? meta?.cardBuilder?.simpleCard;
      const saved = block?.settings;
      if (!saved) return;
      if (saved.styleMode) setStyleMode(saved.styleMode);
      if (saved.aspectRatio) setAspectRatio(saved.aspectRatio);
      if (saved.resolution) setResolution(saved.resolution);
      if (saved.styleMode === "classic") setClassicUseReference(Boolean(saved.useReference));
      if (saved.referenceCreativity != null) setReferenceCreativity(saved.referenceCreativity);
      if (saved.productPhotoId && photosWithId.some((p) => p.fileId === saved.productPhotoId)) {
        setProductPhotoId(saved.productPhotoId);
      }
      const refPreview = parsed.data.simpleCardReferencePreview;
      if (refPreview?.fileId && refPreview.url) {
        if (!saved.referenceImageId || saved.referenceImageId === refPreview.fileId) {
          setReferenceImage({
            fileId: refPreview.fileId,
            url: refPreview.url,
            fileName: refPreview.fileName,
            size: refPreview.size,
          });
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [projectId, initDone, photosWithId]);

  const usesReference =
    styleMode === "reference" || (styleMode === "classic" && classicUseReference);

  useEffect(() => {
    if (!isProductCardImageResolutionAllowed(resolution, aspectRatio)) {
      setResolution(PRODUCT_CARD_IMAGE_RESOLUTION_DEFAULT);
    }
  }, [resolution, aspectRatio]);

  const payload = useMemo(
    () =>
      buildPayload({
        productPhotoId: selectedProductPhotoId,
        productLabel,
        userText,
        styleMode,
        useReference: classicUseReference,
        referenceImage,
        referenceCreativity,
        aspectRatio,
        resolution,
      }),
    [
      selectedProductPhotoId,
      productLabel,
      userText,
      styleMode,
      classicUseReference,
      referenceImage,
      referenceCreativity,
      aspectRatio,
      resolution,
    ],
  );

  const effectiveCardText = useMemo(
    () => mergeSimpleCardProductLabelIntoUserText(productLabel, userText),
    [productLabel, userText],
  );

  const canEstimate = Boolean(
    projectId &&
      initDone &&
      selectedProductPhotoId.trim() &&
      hasEnoughProductBenefits(userText) &&
      (styleMode !== "reference" || referenceImage?.fileId) &&
      (styleMode !== "classic" || !classicUseReference || referenceImage?.fileId),
  );

  const displayEstimateCredits = canEstimate ? estimateCredits : null;
  const displayEstErr = canEstimate ? estErr : null;

  const runEstimate = useCallback(async () => {
    if (!projectId) return;
    setEstimating(true);
    setEstErr(null);
    const res = await fetch(`/api/product-card-projects/${projectId}/estimate/simple-card`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ payload, productLabel: productLabel.trim() || undefined }),
    });
    const parsed = await readJsonSafe<{
      credits?: number;
      supportsReference?: boolean;
      error?: string;
      code?: string;
    }>(res);
    setEstimating(false);
    if (!parsed.ok) {
      setEstErr(parsed.message);
      setEstimateCredits(null);
      return;
    }
    if (!res.ok) {
      const msg = parsed.data.error ?? "Оценка недоступна";
      setEstErr(mapProductCardModelErrorForUser(msg) ?? msg);
      setEstimateCredits(null);
      if (parsed.data.code === "REFERENCE_UNSUPPORTED") {
        setSupportsReference(false);
      }
      return;
    }
    setSupportsReference(parsed.data.supportsReference !== false);
    setEstimateCredits(typeof parsed.data.credits === "number" ? parsed.data.credits : null);
  }, [projectId, payload, productLabel]);

  useEffect(() => {
    if (!canEstimate) return;
    const t = window.setTimeout(() => void runEstimate(), 400);
    return () => window.clearTimeout(t);
  }, [canEstimate, runEstimate]);

  const handleStyleModeChange = (mode: SimpleCardStyleMode) => {
    setStyleMode(mode);
    if (mode === "premium") {
      setReferenceImage(null);
      setClassicUseReference(false);
    }
  };

  const handleRefUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const pid = projectId ?? (await ensureProjectId());
    if (!pid) {
      toast.error("Сначала загрузите фото товара.");
      return;
    }
    if (!isValidRefImage(file)) {
      toast.error("Референс: нужен файл PNG, JPG или WebP.");
      return;
    }
    if (file.size > REF_MAX_BYTES) {
      toast.error(`Референс: файл не больше ${REF_MAX_MB} МБ.`);
      return;
    }
    setRefUploading(true);
    try {
      const form = new FormData();
      form.set("file", file);
      form.set("purpose", "product_card_source_image");
      const res = await fetch("/api/uploads", { method: "POST", body: form });
      const data = (await res.json()) as { url?: string; fileId?: string; size?: number; error?: string };
      if (!res.ok || !data.url?.trim() || !data.fileId?.trim()) {
        toast.error(data.error?.trim() || "Не удалось загрузить референс.");
        return;
      }
      setReferenceImage({
        url: data.url.trim(),
        fileName: file.name,
        size: typeof data.size === "number" ? data.size : file.size,
        fileId: data.fileId.trim(),
      });
    } finally {
      setRefUploading(false);
    }
  };

  const validateClient = (): string | null => {
    if (!selectedProductPhotoId.trim()) return "Выберите фото товара.";
    if (!hasEnoughProductBenefits(userText)) {
      return SIMPLE_CARD_BENEFITS_REQUIRED_MESSAGE;
    }
    if (styleMode === "classic" && classicUseReference && !referenceImage?.fileId) {
      return "Загрузите фото-референс или выключите эту опцию.";
    }
    if (styleMode === "reference" && !referenceImage?.fileId) {
      return "Загрузите фото-референс для этого стиля.";
    }
    if (usesReference && !supportsReference) {
      return SIMPLE_CARD_REFERENCE_UNSUPPORTED_MESSAGE;
    }
    return null;
  };

  const runPlanPreview = useCallback(async () => {
    const err = validateClient();
    if (err) {
      toast.error(err);
      return;
    }
    const pid = projectId ?? (await ensureProjectId());
    if (!pid) {
      toast.error("Сначала загрузите фото товара.");
      return;
    }
    setPlanLoading(true);
    setPlanError(null);
    const res = await fetch(`/api/product-card-projects/${pid}/preview/simple-card-plan`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ payload, productLabel: productLabel.trim() || undefined }),
    });
    const parsed = await readJsonSafe<PlanPreviewResponse & { error?: string }>(res);
    setPlanLoading(false);
    if (!parsed.ok || !res.ok) {
      const msg = parsed.ok ? (parsed.data.error ?? "Не удалось проверить план") : parsed.message;
      setPlanError(mapProductCardModelErrorForUser(msg) ?? msg);
      setPlanPreview(null);
      return;
    }
    setPlanPreview(parsed.data);
  }, [
    projectId,
    ensureProjectId,
    payload,
    productLabel,
    selectedProductPhotoId,
    userText,
    styleMode,
    classicUseReference,
    referenceImage,
    usesReference,
    supportsReference,
  ]);

  const handleGenerate = async () => {
    const err = validateClient();
    if (err) {
      toast.error(err);
      return;
    }
    const pid = projectId ?? (await ensureProjectId());
    if (!pid) {
      toast.error("Сначала загрузите фото товара.");
      return;
    }
    if (estimateCredits == null) {
      toast.error("Дождитесь оценки стоимости.");
      return;
    }
    if (balanceCredits < estimateCredits) {
      toast.error("Недостаточно токенов.");
      return;
    }

    resetGenerationUi();
    setGenerating(true);

    const res = await fetch(`/api/product-card-projects/${pid}/generate/simple-card`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        payload,
        clientEstimateCredits: estimateCredits,
        productLabel: productLabel.trim() || undefined,
      }),
    });
    const parsed = await readJsonSafe<{
      generationId?: string;
      status?: string;
      costCredits?: number;
      error?: string;
    }>(res);
    if (!parsed.ok || !res.ok) {
      setGenerating(false);
      setGenError(parsed.ok ? (parsed.data.error ?? "Ошибка генерации") : parsed.message);
      return;
    }
    const genId = parsed.data.generationId;
    if (!genId) {
      setGenerating(false);
      setGenError("Нет ID генерации");
      return;
    }

    const initialStatus = (parsed.data.status ?? "QUEUED").toUpperCase();
    setGenerationSnapshot({
      id: genId,
      type: "IMAGE",
      status: initialStatus as UserFacingGenerationPollSnapshot["status"],
      statusLabel: initialStatus === "PROCESSING" ? "Генерируется" : "Ожидает",
      statusHint: null,
      scenarioLabel: "Карточка товара",
      kindLabel: "Генерация карточки",
      costCredits: parsed.data.costCredits ?? estimateCredits,
      previewUrl: null,
      downloadUrl: null,
      canDownload: false,
      createdAt: new Date().toISOString(),
      completedAt: null,
      errorMessage: null,
    });

    let iter = 0;
    const poll = async () => {
      iter += 1;
      const gRes = await fetch(`/api/generations/${genId}`);
      const gParsed = await readJsonSafe<
        UserFacingGenerationPollSnapshot & {
          admin?: { providerTaskId?: string; modelSlug?: string; apiModelId?: string };
        }
      >(gRes);
      if (!gParsed.ok || !gRes.ok) {
        pollFailuresRef.current += 1;
        if (pollFailuresRef.current >= 3) {
          setPollStale(true);
        }
        if (iter < PRODUCT_CARD_GENERATION_POLL_MAX_ITERATIONS) {
          pollTimerRef.current = window.setTimeout(poll, PRODUCT_CARD_GENERATION_POLL_INTERVAL_MS);
        } else {
          setGenerating(false);
          setPollStale(true);
        }
        return;
      }

      pollFailuresRef.current = 0;
      setPollStale(false);
      const snap = gParsed.data;
      setGenerationSnapshot({
        id: snap.id,
        type: snap.type,
        status: snap.status,
        statusLabel: snap.statusLabel,
        statusHint: snap.statusHint ?? null,
        scenarioLabel: snap.scenarioLabel,
        kindLabel: snap.kindLabel,
        costCredits: snap.costCredits,
        previewUrl: snap.previewUrl,
        downloadUrl: snap.downloadUrl,
        canDownload: snap.canDownload,
        createdAt: snap.createdAt,
        completedAt: snap.completedAt,
        errorMessage: snap.errorMessage,
      });
      if (showAdminHints && gParsed.data.admin) {
        setAdminPollDebug({
          providerTaskId: gParsed.data.admin.providerTaskId ?? null,
          modelSlug: gParsed.data.admin.modelSlug ?? null,
          apiModelId: gParsed.data.admin.apiModelId ?? null,
        });
      }

      const done = ["COMPLETED", "FAILED", "REFUNDED", "CANCELLED", "BLOCKED"].includes(snap.status);
      if (done) {
        setGenerating(false);
        if (snap.status === "FAILED" && snap.errorMessage) {
          setGenError(snap.errorMessage);
        }
        return;
      }
      if (iter < PRODUCT_CARD_GENERATION_POLL_MAX_ITERATIONS) {
        pollTimerRef.current = window.setTimeout(poll, PRODUCT_CARD_GENERATION_POLL_INTERVAL_MS);
      } else {
        setGenerating(false);
        setPollStale(true);
      }
    };
    pollTimerRef.current = window.setTimeout(poll, PRODUCT_CARD_GENERATION_POLL_INTERVAL_MS);
  };

  const textLen = graphemeLen(userText);
  const clientErr = validateClient();
  const resolutionLabel = resolution;
  const insufficientBalance =
    displayEstimateCredits != null && balanceCredits < displayEstimateCredits;
  const canGenerate =
    !generating &&
    !estimating &&
    canEstimate &&
    clientErr == null &&
    displayEstimateCredits != null &&
    !insufficientBalance;

  return (
    <div className="min-w-0 max-w-full space-y-6 overflow-x-clip">
      <div className="flex min-w-0 max-w-full flex-col gap-6">
        <Card className="min-w-0 max-w-full rounded-2xl border-border">
          <CardHeader>
            <CardTitle className="inline-flex items-center gap-1 text-base">
              Выберите фото товара
              <InfoTooltip content="Это фото будет основой карточки. AI сохранит товар, форму, цвет, упаковку и ключевые детали." />
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {photosWithId.length === 0 ? (
              <Alert>
                <AlertTitle>Нет загруженных фото</AlertTitle>
                <AlertDescription>
                  Загрузите фото товара в блоке выше — без него карточку создать нельзя.
                </AlertDescription>
              </Alert>
            ) : (
              <div
                className={cn(
                  "grid min-w-0 gap-2",
                  photosWithId.length === 1
                    ? "max-w-[320px] grid-cols-1"
                    : "grid-cols-2 sm:grid-cols-3 lg:max-w-xl lg:grid-cols-4",
                )}
              >
                {photosWithId.map((img) => {
                  const selected = selectedProductPhotoId === img.fileId;
                  const label =
                    PRODUCT_PHOTO_ROLE_LABELS[img.role] ?? img.role ?? "Фото";
                  return (
                    <button
                      key={img.fileId}
                      type="button"
                      onClick={() => setProductPhotoId(img.fileId!)}
                      className={cn(
                        "flex min-w-0 flex-col items-center gap-1.5 rounded-xl border-2 p-2 text-center transition-colors",
                        selected
                          ? "border-primary bg-primary/5 ring-primary/25 ring-2"
                          : "border-border hover:border-primary/40",
                      )}
                    >
                      <div className="bg-muted h-16 w-16 shrink-0 overflow-hidden rounded-lg sm:h-[4.5rem] sm:w-[4.5rem]">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={img.url}
                          alt=""
                          className="h-full w-full object-cover"
                        />
                      </div>
                      <span className="text-foreground w-full truncate text-xs font-medium">
                        {label}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="min-w-0 max-w-full rounded-2xl border-border">
          <CardHeader>
            <CardTitle className="inline-flex items-center gap-1 text-base">
              Текст карточки
              <InfoTooltip content="Название подставляется из блока «Данные товара» выше. Преимущества и характеристики укажите здесь — они попадут на карточку. ИИ может предзаполнить их после распознавания фото." />
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="simple-card-product-label">Название товара</Label>
              <Input
                id="simple-card-product-label"
                className="w-full min-w-0"
                value={productLabel}
                onChange={(e) => onProductLabelChange(e.target.value)}
                placeholder="Например: Беспроводной геймпад"
                maxLength={200}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="simple-card-user-text" className="inline-flex items-center gap-1">
                Преимущества и характеристики
                <InfoTooltip content="Укажите 2–3 коротких факта через запятую или с новой строки. Они появятся на карточке как преимущества или характеристики." />
              </Label>
              <Textarea
                id="simple-card-user-text"
                value={userText}
                onChange={(e) => onUserTextChange(e.target.value)}
                placeholder="Например: удобный хват, Bluetooth, Type-C, быстрая зарядка"
                rows={5}
                maxLength={SIMPLE_CARD_USER_TEXT_MAX}
                className="min-w-0 resize-y"
              />
              <div className="text-muted-foreground flex justify-end gap-3 text-xs">
                <span>
                  {textLen} / {SIMPLE_CARD_USER_TEXT_MAX}
                </span>
              </div>
              {userText.trim() && !hasEnoughProductBenefits(userText) ? (
                <p className="text-destructive text-xs">{SIMPLE_CARD_BENEFITS_REQUIRED_MESSAGE}</p>
              ) : null}
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-border">
          <CardHeader>
            <CardTitle className="inline-flex items-center gap-1 text-base">
              Выберите стиль карточки
              <InfoTooltip content="Классический стиль создаёт карточку с нуля. Режим по референсу повторяет стиль, фон и композицию загруженного примера, сохраняя ваш товар." />
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3">
            {SIMPLE_CARD_STYLE_MODE_META.map((meta) => {
              const disabledRef = meta.id === "reference" && !supportsReference;
              return (
                <label
                  key={meta.id}
                  className={cn(
                    "flex cursor-pointer gap-3 rounded-xl border p-3 transition-colors",
                    styleMode === meta.id ? "border-primary bg-primary/5" : "border-border hover:border-primary/30",
                    disabledRef && "opacity-60",
                  )}
                >
                  <input
                    type="radio"
                    name="styleMode"
                    className="mt-1 accent-primary"
                    checked={styleMode === meta.id}
                    disabled={disabledRef}
                    onChange={() => handleStyleModeChange(meta.id)}
                  />
                  <div className="min-w-0">
                    <div className="inline-flex items-center gap-1 font-medium">
                      {meta.label}
                      <InfoTooltip content={meta.description} />
                    </div>
                    {disabledRef ? (
                      <div className="text-destructive mt-1 text-xs">{SIMPLE_CARD_REFERENCE_UNSUPPORTED_MESSAGE}</div>
                    ) : null}
                  </div>
                </label>
              );
            })}
          </CardContent>
        </Card>

        {styleMode === "classic" ? (
          <Card className="rounded-2xl border-border">
            <CardHeader>
              <CardTitle className="flex items-center gap-1 text-base">
                По фото-референсу
                <InfoTooltip content="Товар берётся с основного фото. Референс используется только для стиля, фона и композиции." />
              </CardTitle>
              <CardDescription>Загрузите пример дизайна для стиля и композиции.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {!supportsReference ? (
                <p className="text-muted-foreground text-xs">{SIMPLE_CARD_REFERENCE_UNSUPPORTED_MESSAGE}</p>
              ) : null}
              <div className="flex items-center gap-2">
                <input
                  id={`${refFieldId}-classic-toggle`}
                  type="checkbox"
                  checked={classicUseReference}
                  disabled={!supportsReference}
                  onChange={(e) => {
                    const on = e.target.checked;
                    setClassicUseReference(on);
                    if (!on) setReferenceImage(null);
                  }}
                  className="border-input accent-primary size-4 rounded border"
                />
                <Label htmlFor={`${refFieldId}-classic-toggle`}>Добавить фото-референс для стиля</Label>
              </div>
              {classicUseReference ? (
                <>
                  <ReferenceUploadBlock
                    referenceImage={referenceImage}
                    refUploading={refUploading}
                    refInputRef={refInputRef}
                    refFieldId={refFieldId}
                    onRemove={() => setReferenceImage(null)}
                    onUpload={handleRefUpload}
                  />
                  <CreativitySlider value={referenceCreativity} onChange={setReferenceCreativity} fieldId={refFieldId} />
                </>
              ) : null}
            </CardContent>
          </Card>
        ) : null}

        {styleMode === "reference" ? (
          <Card className="rounded-2xl border-border">
            <CardHeader>
              <CardTitle className="flex items-center gap-1 text-base">
                По фото-референсу
                <InfoTooltip content="Товар берётся с основного фото. Референс используется только для стиля, фона и композиции." />
              </CardTitle>
              <CardDescription>Загрузите пример дизайна для стиля и композиции.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {!supportsReference ? (
                <p className="text-destructive text-xs">{SIMPLE_CARD_REFERENCE_UNSUPPORTED_MESSAGE}</p>
              ) : null}
              <ReferenceUploadBlock
                referenceImage={referenceImage}
                refUploading={refUploading}
                refInputRef={refInputRef}
                refFieldId={refFieldId}
                onRemove={() => setReferenceImage(null)}
                onUpload={handleRefUpload}
              />
              <CreativitySlider value={referenceCreativity} onChange={setReferenceCreativity} fieldId={refFieldId} />
            </CardContent>
          </Card>
        ) : null}

        <Card className="rounded-2xl border-border">
          <CardHeader>
            <CardTitle className="inline-flex items-center gap-1 text-base">
              Формат фото
              <InfoTooltip content="Соотношение сторон и разрешение влияют на итоговый вид карточки и стоимость генерации." />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {SIMPLE_CARD_ASPECT_RATIOS.map((ar) => (
                <Button
                  key={ar}
                  type="button"
                  size="sm"
                  variant={aspectRatio === ar ? "default" : "outline"}
                  onClick={() => setAspectRatio(ar)}
                >
                  {ar}
                </Button>
              ))}
            </div>
            <ProductCardImageResolutionPicker
              value={resolution}
              onChange={setResolution}
              aspectRatio={aspectRatio}
            />
          </CardContent>
        </Card>

        <Card className="min-w-0 max-w-full rounded-2xl border-border">
          <CardHeader>
            <CardTitle className="text-base">Генерация</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {displayEstErr ? (
              <Alert variant="destructive">
                <AlertDescription>{displayEstErr}</AlertDescription>
              </Alert>
            ) : null}
            {clientErr && !canEstimate ? (
              <Alert>
                <AlertDescription>{clientErr}</AlertDescription>
              </Alert>
            ) : null}
            <div className="space-y-2 rounded-lg border border-border/80 bg-muted/20 p-3 text-sm">
              <p className="font-medium">Перед созданием карточки</p>
              <dl className="text-muted-foreground space-y-1 text-xs">
                <div className="flex justify-between gap-2">
                  <dt>Категория</dt>
                  <dd className="text-foreground text-right">
                    {selectedCategoryLabel?.trim() || "— выберите выше —"}
                  </dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt>Преимущества</dt>
                  <dd className="text-foreground min-w-0 max-w-[60%] truncate text-right">
                    {userText.trim() || "—"}
                  </dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt>Формат</dt>
                  <dd className="text-foreground">{aspectRatio}</dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt>Разрешение</dt>
                  <dd className="text-foreground">{resolutionLabel}</dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="inline-flex items-center gap-1">
                    Стоимость
                    <InfoTooltip content="Токены списываются только после запуска генерации. При ошибке токены возвращаются." />
                  </dt>
                  <dd className="text-foreground font-semibold">
                    {estimating ? (
                      "…"
                    ) : displayEstimateCredits != null ? (
                      `${displayEstimateCredits} токенов`
                    ) : (
                      "—"
                    )}
                  </dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt>Ваш баланс</dt>
                  <dd
                    className={
                      insufficientBalance ? "text-destructive font-medium" : "text-foreground"
                    }
                  >
                    {balanceCredits} токенов
                  </dd>
                </div>
              </dl>
              {insufficientBalance ? (
                <Alert variant="destructive" className="mt-2">
                  <AlertDescription className="space-y-2">
                    <p>Недостаточно токенов для создания карточки.</p>
                    <Link href="/dashboard/billing" className="text-primary font-medium underline">
                      Пополнить баланс
                    </Link>
                  </AlertDescription>
                </Alert>
              ) : null}
            </div>
            <Button
              type="button"
              variant="outline"
              className="w-full"
              disabled={planLoading || !selectedProductPhotoId.trim()}
              onClick={() => void runPlanPreview()}
            >
              {planLoading ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" />
                  Проверяем план…
                </>
              ) : (
                "Проверить план карточки"
              )}
            </Button>
            {planError ? <p className="text-destructive text-sm">{planError}</p> : null}
            {planPreview ? (
              <div className="space-y-2 rounded-lg border border-border/80 bg-muted/30 p-3 text-sm">
                <p className="font-medium">{planPreview.userMessage}</p>
                <dl className="text-muted-foreground space-y-1 text-xs">
                  {planPreview.categoryLabel || selectedCategoryLabel ? (
                    <div className="flex justify-between gap-2">
                      <dt>Категория</dt>
                      <dd className="text-foreground text-right">
                        {planPreview.categoryLabel ?? selectedCategoryLabel}
                      </dd>
                    </div>
                  ) : null}
                  {planPreview.productLabel ? (
                    <div className="flex justify-between gap-2">
                      <dt>Название</dt>
                      <dd className="text-foreground text-right">{planPreview.productLabel}</dd>
                    </div>
                  ) : null}
                  <div className="flex justify-between gap-2">
                    <dt>Формат</dt>
                    <dd className="text-foreground">{planPreview.aspectRatio}</dd>
                  </div>
                  <div className="flex justify-between gap-2">
                    <dt>Разрешение</dt>
                    <dd className="text-foreground">{planPreview.resolution}</dd>
                  </div>
                  <div className="flex justify-between gap-2">
                    <dt>Стоимость</dt>
                    <dd className="text-foreground font-medium">{planPreview.credits} токенов</dd>
                  </div>
                  <div className="flex justify-between gap-2">
                    <dt>Готовность</dt>
                    <dd className="text-foreground">{planPreview.readinessStatus}</dd>
                  </div>
                </dl>
                {planPreview.issues.length > 0 ? (
                  <ul className="text-destructive list-inside list-disc text-xs">
                    {planPreview.issues.map((issue) => (
                      <li key={issue}>{issue}</li>
                    ))}
                  </ul>
                ) : null}
                {showAdminHints && planPreview.admin ? (
                  <details className="border-border/60 border-t pt-2">
                    <summary className="text-muted-foreground cursor-pointer text-xs">Admin debug</summary>
                    <div className="text-muted-foreground mt-2 space-y-1 break-all font-mono text-[10px] leading-relaxed">
                      <p>model: {planPreview.admin.modelSlug}</p>
                      <p>apiModelId: {planPreview.admin.apiModelId}</p>
                      <p>
                        <Link href={planPreview.admin.adminModelEditUrl} className="text-primary underline">
                          Редактировать модель
                        </Link>
                      </p>
                      <p>dry-run: POST {planPreview.admin.payloadDryRunUrl}</p>
                    </div>
                  </details>
                ) : null}
              </div>
            ) : null}
            <Button
              className="w-full"
              disabled={!canGenerate}
              onClick={() => void handleGenerate()}
            >
              {generating ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" />
                  Создаём карточку…
                </>
              ) : insufficientBalance ? (
                "Недостаточно токенов"
              ) : (
                "Создать карточку"
              )}
            </Button>
            {genError ? <p className="text-destructive text-sm">{genError}</p> : null}
          </CardContent>
        </Card>
      </div>

      {activeSnapshot ? (
        <ProductCardGenerationStatusPanel
          snapshot={activeSnapshot}
          pollStale={pollStale}
          showAdminHints={showAdminHints}
          adminDebug={adminPollDebug ?? undefined}
          onCreateAnother={devMockPhase ? undefined : resetGenerationUi}
          onRetry={devMockPhase ? undefined : () => void handleGenerate()}
        />
      ) : null}

      {devMockPhase ? (
        <p className="text-muted-foreground text-center text-xs">
          Dev mock: ?pcGenMock={devMockPhase} (только development, без Kie)
        </p>
      ) : null}
    </div>
  );
}

function ReferenceUploadBlock({
  referenceImage,
  refUploading,
  refInputRef,
  refFieldId,
  onRemove,
  onUpload,
}: {
  referenceImage: ReferenceRow | null;
  refUploading: boolean;
  refInputRef: React.RefObject<HTMLInputElement | null>;
  refFieldId: string;
  onRemove: () => void;
  onUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
}) {
  return (
    <div className="min-w-0 max-w-full space-y-2">
      <input
        ref={refInputRef}
        id={`${refFieldId}-file`}
        type="file"
        accept={REF_ACCEPT}
        className="sr-only"
        onChange={onUpload}
      />
      {referenceImage ? (
        <div className="flex max-w-full items-start gap-2.5 rounded-lg border p-2 sm:max-w-[320px]">
          <div className="bg-muted h-14 w-14 shrink-0 overflow-hidden rounded-md sm:h-16 sm:w-16">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={referenceImage.url} alt="" className="h-full w-full object-cover" />
          </div>
          <div className="min-w-0 flex-1 text-xs">
            <div className="truncate font-medium">{referenceImage.fileName}</div>
            <div className="mt-1 flex flex-wrap gap-1">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-7 px-2"
                disabled={refUploading}
                onClick={() => refInputRef.current?.click()}
              >
                <Upload className="mr-1 size-3.5" />
                Заменить
              </Button>
              <Button type="button" variant="ghost" size="sm" className="h-7 px-2" onClick={onRemove}>
                <Trash2 className="mr-1 size-3.5" />
                Удалить
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <Button
          type="button"
          variant="outline"
          className="w-full"
          disabled={refUploading}
          onClick={() => refInputRef.current?.click()}
        >
          {refUploading ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Upload className="mr-2 size-4" />}
          Загрузить референс
        </Button>
      )}
      <p className="text-muted-foreground text-xs">PNG, JPG, WebP · до {REF_MAX_MB} МБ</p>
    </div>
  );
}

function CreativitySlider({
  value,
  onChange,
  fieldId,
}: {
  value: number;
  onChange: (v: number) => void;
  fieldId: string;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={`${fieldId}-creativity`} className="inline-flex items-center gap-1">
        Креативность референса
        <InfoTooltip content="Насколько свободно AI интерпретирует референс. Слева — точное следование, справа — свободное вдохновение." />
      </Label>
      <input
        id={`${fieldId}-creativity`}
        type="range"
        min={SIMPLE_CARD_CREATIVITY_MIN}
        max={SIMPLE_CARD_CREATIVITY_MAX}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="accent-primary w-full"
      />
      <div className="text-muted-foreground flex justify-between text-[11px]">
        <span>Точное следование</span>
        <span>{value}</span>
        <span>Свободное вдохновение</span>
      </div>
    </div>
  );
}
