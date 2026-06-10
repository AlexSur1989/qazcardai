"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState, useId } from "react";
import { Loader2, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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

const REF_MAX_MB = 10;
const REF_MAX_BYTES = REF_MAX_MB * 1024 * 1024;
const REF_ACCEPT = "image/png,image/jpeg,image/jpg,image/webp";

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
  selectedCategoryLabel?: string | null;
  showAdminHints?: boolean;
  registerPrefillHandler?: (
    handler: ((payload: { productTitle: string; benefitsText: string }) => void) | null,
  ) => void;
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
  };
}

export function SimpleProductCardTab({
  projectId,
  initDone,
  ensureProjectId,
  sourceImages,
  balanceCredits,
  selectedCategoryLabel = null,
  showAdminHints = false,
  registerPrefillHandler,
}: Props) {
  const refFieldId = useId();
  const photosWithId = useMemo(
    () => sourceImages.filter((img): img is ProductSourceImageValue & { fileId: string } => Boolean(img.fileId?.trim())),
    [sourceImages],
  );

  const [productPhotoId, setProductPhotoId] = useState<string>("");
  const [productLabel, setProductLabel] = useState("");
  const [userText, setUserText] = useState("");
  const [visionLoading, setVisionLoading] = useState(false);
  const [visionSummary, setVisionSummary] = useState<SimpleCardVisionResponse | null>(null);
  const [analyzedPhotoId, setAnalyzedPhotoId] = useState<string | null>(null);
  const [styleMode, setStyleMode] = useState<SimpleCardStyleMode>(SIMPLE_CARD_DEFAULT_STYLE_MODE);
  const [classicUseReference, setClassicUseReference] = useState(false);
  const [referenceImage, setReferenceImage] = useState<ReferenceRow | null>(null);
  const [referenceCreativity, setReferenceCreativity] = useState(SIMPLE_CARD_CREATIVITY_DEFAULT);
  const [aspectRatio, setAspectRatio] = useState<SimpleCardAspectRatio>(SIMPLE_CARD_DEFAULT_ASPECT_RATIO);

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
  const userTextTouchedRef = useRef(false);
  const productLabelTouchedRef = useRef(false);
  const visionRequestRef = useRef<string | null>(null);
  const autoVisionRanForPhotoRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!registerPrefillHandler) return;
    registerPrefillHandler(({ productTitle, benefitsText }) => {
      if (productTitle.trim()) {
        setProductLabel(productTitle.trim());
        productLabelTouchedRef.current = true;
      }
      if (benefitsText.trim()) {
        setUserText(benefitsText.trim());
        userTextTouchedRef.current = true;
      }
    });
    return () => registerPrefillHandler(null);
  }, [registerPrefillHandler]);

  const defaultProductPhotoId = useMemo(() => {
    const main = photosWithId.find((p) => p.role === "main") ?? photosWithId[0];
    return main?.fileId ?? "";
  }, [photosWithId]);

  const selectedProductPhotoId = productPhotoId || defaultProductPhotoId;

  const runVisionAnalysis = useCallback(
    async (options?: { force?: boolean; photoId?: string }) => {
      const pid = projectId;
      const photoId = options?.photoId ?? selectedProductPhotoId;
      if (!pid || !initDone || !photoId.trim()) return;
      if (!options?.force && analyzedPhotoId === photoId && visionSummary) {
        return;
      }
      if (visionRequestRef.current === photoId) return;
      visionRequestRef.current = photoId;
      setVisionLoading(true);
      try {
        const res = await fetch(`/api/product-card-projects/${pid}/product-analysis/vision`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ productPhotoId: photoId, saveToSimpleCard: true }),
        });
        const parsed = await readJsonSafe<SimpleCardVisionResponse>(res);
        if (visionRequestRef.current !== photoId) return;
        if (!parsed.ok || !res.ok) {
          setVisionSummary({ analysisFailed: true, warnings: [parsed.ok ? "Не удалось распознать товар" : parsed.message] });
          setAnalyzedPhotoId(photoId);
          return;
        }
        const d = parsed.data;
        setVisionSummary(d);
        setAnalyzedPhotoId(photoId);

        if (d.analysisFailed) {
          return;
        }

        const label = (d.productLabel ?? d.productNameGuess ?? "").trim();
        if (label && !productLabelTouchedRef.current) {
          setProductLabel(label);
        }
        const suggested = d.suggestedUserText?.trim() ?? "";
        if (suggested && !userTextTouchedRef.current) {
          setUserText(suggested);
        }
      } finally {
        if (visionRequestRef.current === photoId) {
          setVisionLoading(false);
        }
      }
    },
    [projectId, initDone, selectedProductPhotoId, analyzedPhotoId, visionSummary],
  );

  useEffect(() => {
    if (!projectId || !initDone || !selectedProductPhotoId.trim()) return;
    if (autoVisionRanForPhotoRef.current.has(selectedProductPhotoId)) return;
    autoVisionRanForPhotoRef.current.add(selectedProductPhotoId);
    void runVisionAnalysis({ photoId: selectedProductPhotoId });
  }, [projectId, initDone, selectedProductPhotoId, runVisionAnalysis]);

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
      if (saved.productLabel) {
        setProductLabel(saved.productLabel);
        productLabelTouchedRef.current = true;
      }
      if (saved.userText) {
        setUserText(saved.userText);
        userTextTouchedRef.current = true;
      }
      if (saved.styleMode) setStyleMode(saved.styleMode);
      if (saved.aspectRatio) setAspectRatio(saved.aspectRatio);
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
      if (block?.vision && !block.vision.analysisFailed) {
        setVisionSummary(block.vision);
        if (block.vision.productPhotoId) {
          setAnalyzedPhotoId(block.vision.productPhotoId);
          visionRequestRef.current = block.vision.productPhotoId;
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [projectId, initDone, photosWithId]);

  const usesReference =
    styleMode === "reference" || (styleMode === "classic" && classicUseReference);

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
  const resolutionLabel = "1K";
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
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(280px,360px)]">
      <div className="space-y-4">
        <Card className="rounded-2xl border-border">
          <CardHeader>
            <CardTitle className="text-base">Выберите фото товара</CardTitle>
            <CardDescription>
              Это фото будет основой карточки. AI сохранит товар, форму, цвет, упаковку и ключевые детали.
            </CardDescription>
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
              <>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {photosWithId.map((img) => {
                    const selected = selectedProductPhotoId === img.fileId;
                    return (
                      <button
                        key={img.fileId}
                        type="button"
                        onClick={() => {
                          setProductPhotoId(img.fileId!);
                          if (analyzedPhotoId !== img.fileId) {
                            setVisionSummary(null);
                          }
                        }}
                        className={cn(
                          "overflow-hidden rounded-xl border-2 text-left transition-colors",
                          selected ? "border-primary ring-primary/30 ring-2" : "border-border hover:border-primary/40",
                        )}
                      >
                        <div className="bg-muted aspect-square w-full">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={img.url} alt="" className="h-full w-full object-cover" />
                        </div>
                        <div className="px-2 py-1.5 text-xs font-medium">
                          {img.role === "main" ? "Главное" : img.role}
                        </div>
                      </button>
                    );
                  })}
                </div>
                {visionLoading ? (
                  <div className="text-muted-foreground flex items-center gap-2 text-sm">
                    <Loader2 className="size-4 animate-spin" />
                    Распознаём товар на фото…
                  </div>
                ) : null}
              </>
            )}
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-border">
          <CardHeader>
            <CardTitle className="text-base">Что это за товар?</CardTitle>
            <CardDescription>
              Заполните название и преимущества вручную. Автораспознавание подключим позже — для генерации карточки оно не обязательно.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {visionSummary?.analysisFailed ? (
              <Alert>
                <AlertDescription>
                  {visionSummary.warnings?.[0] ??
                    "Распознавание недоступно — укажите название и преимущества вручную."}
                </AlertDescription>
              </Alert>
            ) : null}
            {visionLoading && !productLabel.trim() ? (
              <div className="text-muted-foreground flex items-center gap-2 text-sm">
                <Loader2 className="size-4 animate-spin" />
                Анализируем фото…
              </div>
            ) : (
              <>
                <div className="space-y-2">
                  <Label htmlFor="simple-card-product-label">Название товара</Label>
                  <Input
                    id="simple-card-product-label"
                    value={productLabel}
                    onChange={(e) => {
                      productLabelTouchedRef.current = true;
                      setProductLabel(e.target.value);
                    }}
                    placeholder="Например: Шампунь Clear Men Ледяная свежесть"
                    maxLength={200}
                  />
                </div>
                {visionSummary && !visionSummary.analysisFailed ? (
                  <div className="text-muted-foreground grid gap-1 text-xs sm:grid-cols-2">
                    {visionSummary.productType?.trim() ? (
                      <div>
                        <span>Тип: </span>
                        <span className="text-foreground">{visionSummary.productType.trim()}</span>
                      </div>
                    ) : null}
                    {visionSummary.mainColors?.length ? (
                      <div>
                        <span>Цвет: </span>
                        <span className="text-foreground">{visionSummary.mainColors.slice(0, 4).join(", ")}</span>
                      </div>
                    ) : null}
                    {visionSummary.materialGuess?.trim() ? (
                      <div>
                        <span>Материал: </span>
                        <span className="text-foreground">{visionSummary.materialGuess.trim()}</span>
                      </div>
                    ) : null}
                  </div>
                ) : null}
                {visionSummary?.analysisFailed ? (
                  <Alert>
                    <AlertTitle>Не удалось распознать товар</AlertTitle>
                    <AlertDescription>
                      Укажите название вручную — генерация всё равно доступна.
                    </AlertDescription>
                  </Alert>
                ) : null}
                {selectedProductPhotoId && !visionLoading ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="rounded-xl"
                    onClick={() => void runVisionAnalysis({ force: true, photoId: selectedProductPhotoId })}
                  >
                    Обновить распознавание
                  </Button>
                ) : null}
              </>
            )}
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-border">
          <CardHeader>
            <CardTitle className="text-base">Преимущества и характеристики товара</CardTitle>
            <CardDescription>
              Напишите факты о товаре. ИИ превратит их в короткие продающие преимущества.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="text-muted-foreground text-xs">
              Для лучшего результата используйте описание, которое относится к загруженному фото. Генерация
              доступна и при несовпадении — вы сами отвечаете за введённый текст.
            </p>
            {visionLoading && !userText.trim() ? (
              <div className="text-muted-foreground flex items-center gap-2 text-sm">
                <Loader2 className="size-4 animate-spin" />
                Подбираем текст для карточки…
              </div>
            ) : null}
            <Textarea
              value={userText}
              onChange={(e) => {
                userTextTouchedRef.current = true;
                setUserText(e.target.value);
              }}
              placeholder="Например: удобный хват, Bluetooth, Type-C, быстрая зарядка, для PlayStation"
              rows={5}
              maxLength={SIMPLE_CARD_USER_TEXT_MAX}
              className="resize-y"
            />
            <div className="text-muted-foreground flex justify-between gap-3 text-xs">
              <span>Укажите 2–3 факта через запятую или с новой строки.</span>
              <span>
                {textLen} / {SIMPLE_CARD_USER_TEXT_MAX}
              </span>
            </div>
            {userText.trim() && !hasEnoughProductBenefits(userText) ? (
              <p className="text-destructive text-xs">{SIMPLE_CARD_BENEFITS_REQUIRED_MESSAGE}</p>
            ) : null}
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-border">
          <CardHeader>
            <CardTitle className="text-base">Выберите стиль карточки</CardTitle>
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
                    <div className="font-medium">{meta.label}</div>
                    <div className="text-muted-foreground text-sm">{meta.description}</div>
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
              <CardTitle className="text-base">По фото-референсу</CardTitle>
              <CardDescription>
                Загрузите пример дизайна. AI возьмёт из него стиль, фон, композицию и визуальную подачу.
              </CardDescription>
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
              <CardTitle className="text-base">По фото-референсу</CardTitle>
              <CardDescription>
                Загрузите пример дизайна. AI возьмёт из него стиль, фон, композицию и визуальную подачу.
              </CardDescription>
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
            <CardTitle className="text-base">Формат фото</CardTitle>
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
          </CardContent>
        </Card>
      </div>

      <div className="lg:sticky lg:top-24 space-y-3">
        <Card className="rounded-2xl border-border">
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
                  <dd className="text-foreground max-w-[60%] truncate text-right">
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
                  <dt>Стоимость</dt>
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
                  <div className="border-border/60 space-y-1 border-t pt-2 font-mono text-[10px] leading-relaxed">
                    <p>model: {planPreview.admin.modelSlug}</p>
                    <p>apiModelId: {planPreview.admin.apiModelId}</p>
                    <p>
                      <Link href={planPreview.admin.adminModelEditUrl} className="text-primary underline">
                        Редактировать модель
                      </Link>
                      {" · "}
                      <span>dry-run: POST {planPreview.admin.payloadDryRunUrl}</span>
                    </p>
                  </div>
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
    <div className="space-y-2">
      <input
        ref={refInputRef}
        id={`${refFieldId}-file`}
        type="file"
        accept={REF_ACCEPT}
        className="sr-only"
        onChange={onUpload}
      />
      {referenceImage ? (
        <div className="flex items-start gap-3 rounded-lg border p-2">
          <div className="bg-muted size-16 shrink-0 overflow-hidden rounded-md">
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
      <p className="text-muted-foreground text-xs">
        Референс используется только для стиля. Товар берётся с основного фото.
      </p>
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
      <Label htmlFor={`${fieldId}-creativity`}>Креативность референса</Label>
      <p className="text-muted-foreground text-xs">
        Насколько свободно AI интерпретирует референс. Слева — точное следование, справа — свободное вдохновение.
      </p>
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
