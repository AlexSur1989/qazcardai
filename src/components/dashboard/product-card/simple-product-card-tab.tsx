"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useId } from "react";
import Link from "next/link";
import { Loader2, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
  IMAGE_GENERATION_POLL_INTERVAL_MS,
  IMAGE_GENERATION_POLL_MAX_ITERATIONS,
} from "@/lib/generation-client-polling";
import { readJsonSafe } from "@/lib/fetch-json-safe";
import { getFirstOutputUrlFromJson } from "@/lib/product-card-output";
import {
  getUserFacingGenerationStatusFromRaw,
  mapGenerationErrorToUserMessage,
} from "@/lib/generation-display";
import { cn } from "@/lib/utils";
import type { SimpleProductCardRequest } from "@/lib/validations/simple-product-card";

import type { ProductSourceImageValue, SourceImagesValue } from "./source-images-upload";

const REF_MAX_MB = 10;
const REF_MAX_BYTES = REF_MAX_MB * 1024 * 1024;
const REF_ACCEPT = "image/png,image/jpeg,image/jpg,image/webp";

type ReferenceRow = {
  url: string;
  fileName: string;
  size: number;
  fileId: string;
};

type Props = {
  projectId: string | null;
  initDone: boolean;
  ensureProjectId: () => Promise<string | null>;
  sourceImages: SourceImagesValue;
  balanceCredits: number;
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
  userText: string;
  styleMode: SimpleCardStyleMode;
  useReference: boolean;
  referenceImage: ReferenceRow | null;
  referenceCreativity: number;
  aspectRatio: SimpleCardAspectRatio;
}): SimpleProductCardRequest {
  return {
    productPhotoId: input.productPhotoId,
    userText: input.userText.trim(),
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
}: Props) {
  const refFieldId = useId();
  const photosWithId = useMemo(
    () => sourceImages.filter((img): img is ProductSourceImageValue & { fileId: string } => Boolean(img.fileId?.trim())),
    [sourceImages],
  );

  const [productPhotoId, setProductPhotoId] = useState<string>("");
  const [userText, setUserText] = useState("");
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
  const [result, setResult] = useState<{
    generationId: string;
    status: string;
    costCredits: number;
    outputUrl: string | null;
    errorMessage?: string | null;
  } | null>(null);

  const refInputRef = useRef<HTMLInputElement>(null);

  const defaultProductPhotoId = useMemo(() => {
    const main = photosWithId.find((p) => p.role === "main") ?? photosWithId[0];
    return main?.fileId ?? "";
  }, [photosWithId]);

  const selectedProductPhotoId = productPhotoId || defaultProductPhotoId;

  useEffect(() => {
    if (!projectId || !initDone) return;
    let cancelled = false;
    void (async () => {
      const res = await fetch(`/api/product-card-projects/${projectId}`);
      const parsed = await readJsonSafe<{ project?: { metadata?: Record<string, unknown> } }>(res);
      if (cancelled || !parsed.ok || !res.ok) return;
      const settings = (
        parsed.data.project?.metadata as {
          marketplaceCard?: { simpleCard?: { settings?: SimpleProductCardRequest } };
          cardBuilder?: { simpleCard?: { settings?: SimpleProductCardRequest } };
        } | undefined
      );
      const saved =
        settings?.marketplaceCard?.simpleCard?.settings ??
        settings?.cardBuilder?.simpleCard?.settings;
      if (!saved) return;
      if (saved.userText) setUserText(saved.userText);
      if (saved.styleMode) setStyleMode(saved.styleMode);
      if (saved.aspectRatio) setAspectRatio(saved.aspectRatio);
      if (saved.styleMode === "classic") setClassicUseReference(Boolean(saved.useReference));
      if (saved.referenceCreativity != null) setReferenceCreativity(saved.referenceCreativity);
      if (saved.productPhotoId && photosWithId.some((p) => p.fileId === saved.productPhotoId)) {
        setProductPhotoId(saved.productPhotoId);
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
        userText,
        styleMode,
        useReference: classicUseReference,
        referenceImage,
        referenceCreativity,
        aspectRatio,
      }),
    [
      selectedProductPhotoId,
      userText,
      styleMode,
      classicUseReference,
      referenceImage,
      referenceCreativity,
      aspectRatio,
    ],
  );

  const canEstimate = Boolean(
    projectId &&
      initDone &&
      selectedProductPhotoId.trim() &&
      userText.trim() &&
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
      body: JSON.stringify({ payload }),
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
      setEstErr(parsed.data.error ?? "Оценка недоступна");
      setEstimateCredits(null);
      if (parsed.data.code === "REFERENCE_UNSUPPORTED") {
        setSupportsReference(false);
      }
      return;
    }
    setSupportsReference(parsed.data.supportsReference !== false);
    setEstimateCredits(typeof parsed.data.credits === "number" ? parsed.data.credits : null);
  }, [projectId, payload]);

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
      form.set("purpose", "product_card_style_reference");
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
    if (!userText.trim()) return "Добавьте хотя бы одну фразу или преимущество для карточки.";
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

    setGenerating(true);
    setGenError(null);
    const res = await fetch(`/api/product-card-projects/${pid}/generate/simple-card`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ payload, clientEstimateCredits: estimateCredits }),
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
    setResult({
      generationId: genId,
      status: parsed.data.status ?? "queued",
      costCredits: parsed.data.costCredits ?? estimateCredits,
      outputUrl: null,
    });

    let iter = 0;
    const poll = async () => {
      iter += 1;
      const gRes = await fetch(`/api/generations/${genId}`);
      const gParsed = await readJsonSafe<{ status?: string; outputFiles?: unknown; errorMessage?: string | null }>(gRes);
      if (!gParsed.ok || !gRes.ok) {
        if (iter < IMAGE_GENERATION_POLL_MAX_ITERATIONS) {
          window.setTimeout(poll, IMAGE_GENERATION_POLL_INTERVAL_MS);
        } else {
          setGenerating(false);
        }
        return;
      }
      const status = gParsed.data.status ?? "queued";
      const outputUrl = getFirstOutputUrlFromJson(gParsed.data.outputFiles);
      setResult((prev) =>
        prev
          ? { ...prev, status, outputUrl, errorMessage: gParsed.data.errorMessage ?? null }
          : prev,
      );
      const done = ["COMPLETED", "FAILED", "REFUNDED", "CANCELLED", "BLOCKED"].includes(status);
      if (done) {
        setGenerating(false);
        if (status === "FAILED" && gParsed.data.errorMessage) {
          setGenError(mapGenerationErrorToUserMessage(gParsed.data.errorMessage));
        }
        return;
      }
      if (iter < IMAGE_GENERATION_POLL_MAX_ITERATIONS) {
        window.setTimeout(poll, IMAGE_GENERATION_POLL_INTERVAL_MS);
      } else {
        setGenerating(false);
      }
    };
    window.setTimeout(poll, IMAGE_GENERATION_POLL_INTERVAL_MS);
  };

  const textLen = graphemeLen(userText);
  const clientErr = validateClient();

  return (
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
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {photosWithId.map((img) => {
                  const selected = selectedProductPhotoId === img.fileId;
                  return (
                    <button
                      key={img.fileId}
                      type="button"
                      onClick={() => setProductPhotoId(img.fileId!)}
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
            )}
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-border">
          <CardHeader>
            <CardTitle className="text-base">Какой текст хотите видеть на карточке?</CardTitle>
            <CardDescription>
              Напишите в свободной форме: преимущества, качества товара, заголовок, подзаголовок или любые фразы,
              которые нужно использовать. Если хотите показать размеры на карточке, укажите их прямо в тексте:
              например, «размер 20×30 см», «высота 15 см», «объём 500 мл», «вес 250 г».
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <Textarea
              value={userText}
              onChange={(e) => setUserText(e.target.value)}
              placeholder="Например: Лёгкий и удобный. Подходит для ежедневного использования. Современный дизайн. Прочный материал."
              rows={5}
              maxLength={SIMPLE_CARD_USER_TEXT_MAX}
              className="resize-y"
            />
            <div className="text-muted-foreground flex justify-between text-xs">
              <span>AI красиво покажет указанные размеры стрелками, линиями или плашками на карточке</span>
              <span>
                {textLen} / {SIMPLE_CARD_USER_TEXT_MAX}
              </span>
            </div>
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
              <CardTitle className="text-base">Фото-референс (необязательно)</CardTitle>
              <CardDescription>
                Необязательно. AI может взять из референса фон, стиль, композицию и настроение.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
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
              <CardTitle className="text-base">Загрузите фото-референс</CardTitle>
              <CardDescription>
                AI возьмёт из референса стиль, фон, композицию, цвета и настроение. Товар будет взят с вашего основного
                фото.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
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
            <div className="text-sm">
              Стоимость:{" "}
              {estimating ? (
                <Loader2 className="inline size-4 animate-spin" />
              ) : displayEstimateCredits != null ? (
                <span className="font-semibold">{displayEstimateCredits} токенов</span>
              ) : (
                "—"
              )}
            </div>
            <div className="text-muted-foreground text-xs">Баланс: {balanceCredits} токенов</div>
            <Button
              className="w-full"
              disabled={generating || estimating || !canEstimate || clientErr != null || displayEstimateCredits == null}
              onClick={() => void handleGenerate()}
            >
              {generating ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" />
                  Генерация…
                </>
              ) : (
                "Сгенерировать"
              )}
            </Button>
            {genError ? <p className="text-destructive text-sm">{genError}</p> : null}
            {result ? (
              <div className="space-y-2 border-t pt-3">
                <div className="text-muted-foreground text-xs">
                  {getUserFacingGenerationStatusFromRaw(result.status)}
                </div>
                {result.outputUrl ? (
                  <div className="bg-muted overflow-hidden rounded-lg border">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={result.outputUrl} alt="Результат" className="w-full object-contain" />
                  </div>
                ) : null}
                <div className="flex flex-wrap gap-2">
                  {result.outputUrl && result.status === "COMPLETED" ? (
                    <a
                      href={`/api/generations/${result.generationId}/download`}
                      className="text-primary text-xs font-medium underline"
                      target="_blank"
                      rel="noreferrer"
                    >
                      Скачать
                    </a>
                  ) : null}
                  <Link
                    href={`/dashboard/history/${result.generationId}`}
                    className="text-primary text-xs font-medium underline"
                  >
                    История
                  </Link>
                </div>
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>
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
            <Button type="button" variant="ghost" size="sm" className="mt-1 h-7 px-2" onClick={onRemove}>
              <Trash2 className="mr-1 size-3.5" />
              Удалить
            </Button>
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
