"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { cn } from "@/lib/utils";
import { canonicalModelSlug } from "@/lib/model-slug-params";
import {
  defaultsFromSchema,
  getSchemaFields,
} from "@/lib/generation-form-settings-schema";
import { toast } from "sonner";
import type { GenerationStatus } from "@/generated/prisma/enums";
import { DynamicModelSettingsFields } from "@/components/dashboard/dynamic-model-settings-fields";
import { KlingMotionControlUploads } from "@/components/dashboard/kling-motion-control-uploads";
import { GenerationCostCard } from "@/components/dashboard/generation-cost-card";
import { GenerationResultAside } from "@/components/dashboard/generation-result-aside";

export type CreateVideoFormModel = {
  id: string;
  name: string;
  slug: string;
  creditsUiMin: number;
  description: string | null;
  settingsSchema?: unknown;
  supportsNegativePrompt: boolean;
  supportsImageInput: boolean;
  supportsVideoInput: boolean;
  supportsSeed: boolean;
  maxDuration: number | null;
};

type Props = {
  models: CreateVideoFormModel[];
  balanceCredits: number;
  /** Для хаба семейства: режим выбран снаружи, селект модели не нужен. */
  hideModelSelect?: boolean;
  /**
   * Режим «семейство на странице модели»: без выпадающего списка, только переключение режимов.
   * Длина labels совпадает с models.
   */
  familyHub?: {
    labels: string[];
    /** Какой slug БД выбрать при монтировании (например из ?mode= на странице хаба) */
    initialSlug?: string;
  };
};

const TERMINAL: GenerationStatus[] = [
  "COMPLETED",
  "FAILED",
  "REFUNDED",
  "CANCELLED",
  "BLOCKED",
];

export function CreateVideoForm({
  models,
  balanceCredits,
  hideModelSelect = false,
  familyHub,
}: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [modelId, setModelId] = useState(() => {
    if (familyHub && models.length > 0) {
      if (familyHub.initialSlug) {
        const hit = models.find((m) => m.slug === familyHub.initialSlug);
        if (hit) return hit.id;
      }
      return models[0]?.id ?? "";
    }
    const mid = searchParams.get("modelId");
    const canonical = canonicalModelSlug(searchParams.get("model"));
    if (mid && models.some((m) => m.id === mid)) {
      return mid;
    }
    if (canonical) {
      const bySlug = models.find((m) => m.slug === canonical);
      if (bySlug) {
        return bySlug.id;
      }
    }
    return models[0]?.id ?? "";
  });
  const [prompt, setPrompt] = useState(() => {
    const pr = searchParams.get("prompt");
    return pr != null && pr.length > 0 ? pr : "";
  });
  const [negativePrompt, setNegativePrompt] = useState("");
  const [aspectRatio, setAspectRatio] = useState("");
  const [resolution, setResolution] = useState("");
  const [seed, setSeed] = useState("");
  const [durationSec, setDurationSec] = useState("");
  const [inputFileUrls, setInputFileUrls] = useState("");

  const selected = useMemo(
    () => models.find((m) => m.id === modelId),
    [models, modelId],
  );

  const schemaFields = useMemo(() => {
    const f = getSchemaFields(selected?.settingsSchema);
    if (selected?.slug === "kling-3-0-motion-control") {
      return f.filter(
        (x) =>
          x.name !== "inputUrls" &&
          x.name !== "videoUrls" &&
          x.name !== "duration",
      );
    }
    return f;
  }, [selected?.settingsSchema, selected?.slug]);
  const hasDynamicSettings = schemaFields.length > 0;

  const [dynSettings, setDynSettings] = useState<Record<string, unknown>>(() => {
    if (familyHub && models.length > 0) {
      const slug = familyHub.initialSlug;
      const m = slug ? models.find((x) => x.slug === slug) : undefined;
      return defaultsFromSchema((m ?? models[0])?.settingsSchema);
    }
    const mid = searchParams.get("modelId");
    const canonical = canonicalModelSlug(searchParams.get("model"));
    const bySlugMatch = canonical
      ? models.find((m) => m.slug === canonical)
      : undefined;
    const initialId =
      mid && models.some((m) => m.id === mid)
        ? mid
        : (bySlugMatch?.id ?? models[0]?.id ?? "");
    const m = models.find((x) => x.id === initialId);
    return defaultsFromSchema(m?.settingsSchema);
  });

  const [estimatedCredits, setEstimatedCredits] = useState<number | null>(null);
  const [motionEstimateExtra, setMotionEstimateExtra] = useState<{
    videoDurationSeconds: number;
    billingDurationSeconds: number;
    modelName?: string;
  } | null>(null);
  const [estimateLoading, setEstimateLoading] = useState(true);
  const [estimateFailed, setEstimateFailed] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{
    generationId: string;
    status: string;
    providerTaskId?: string | null;
  } | null>(null);
  const [poll, setPoll] = useState<{
    id: string;
    status: string;
    errorMessage: string | null;
    outputFiles: unknown;
  } | null>(null);
  const [pollComplete, setPollComplete] = useState(false);

  const showInputUrls =
    !hasDynamicSettings &&
    (selected?.supportsImageInput || selected?.supportsVideoInput);

  const insufficientBalance =
    estimatedCredits != null && balanceCredits < estimatedCredits;

  const klingMultishotBlocked =
    hasDynamicSettings &&
    (selected?.slug === "kling-3-0" ||
      selected?.slug === "kling-3-0-video" ||
      (selected?.slug != null && selected.slug.startsWith("kling-2-6-"))) &&
    dynSettings.multiShots === true;

  const [klingImageError, setKlingImageError] = useState<string | null>(null);
  const [klingVideoError, setKlingVideoError] = useState<string | null>(null);

  const submitDisabled =
    loading ||
    estimateLoading ||
    estimateFailed ||
    estimatedCredits == null ||
    insufficientBalance ||
    klingMultishotBlocked;

  const applyPoll = useCallback(
    (data: {
      id?: string;
      status?: string;
      errorMessage?: string | null;
      outputFiles?: unknown;
    }) => {
      if (data.id && data.status) {
        setPoll({
          id: data.id,
          status: data.status,
          errorMessage: data.errorMessage ?? null,
          outputFiles: data.outputFiles,
        });
        if (TERMINAL.includes(data.status as GenerationStatus)) {
          setPollComplete(true);
        }
      }
    },
    [],
  );

  const fetchStatus = useCallback(
    async (id: string) => {
      const res = await fetch(`/api/generations/${id}`, { method: "GET" });
      const data = (await res.json()) as {
        error?: string;
        status?: string;
        id?: string;
        errorMessage?: string | null;
        outputFiles?: unknown;
      };
      if (!res.ok) {
        return;
      }
      applyPoll(data);
    },
    [applyPoll],
  );

  useEffect(() => {
    if (!selected?.id) {
      queueMicrotask(() => {
        setEstimatedCredits(null);
        setEstimateLoading(false);
        setEstimateFailed(false);
        setMotionEstimateExtra(null);
      });
      return;
    }

    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled) {
        setEstimateLoading(true);
        setEstimateFailed(false);
      }
    });

    const settingsPayload = hasDynamicSettings ? dynSettings : {};

    const t = window.setTimeout(() => {
      void (async () => {
        try {
          const res = await fetch("/api/generations/estimate", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              modelId: selected.id,
              settings: settingsPayload,
            }),
          });
          const data = (await res.json()) as {
            credits?: number;
            error?: string;
            billingDurationSeconds?: number;
            videoDurationSeconds?: number;
            modelName?: string;
          };
          if (cancelled) return;
          if (res.ok && typeof data.credits === "number") {
            setEstimatedCredits(data.credits);
            setEstimateFailed(false);
            if (
              selected.slug === "kling-3-0-motion-control" &&
              typeof data.billingDurationSeconds === "number" &&
              typeof data.videoDurationSeconds === "number"
            ) {
              setMotionEstimateExtra({
                billingDurationSeconds: data.billingDurationSeconds,
                videoDurationSeconds: data.videoDurationSeconds,
                modelName: data.modelName,
              });
            } else {
              setMotionEstimateExtra(null);
            }
          } else {
            setEstimatedCredits(null);
            setEstimateFailed(true);
            setMotionEstimateExtra(null);
          }
        } catch {
          if (cancelled) return;
          setEstimatedCredits(null);
          setEstimateFailed(true);
          setMotionEstimateExtra(null);
        } finally {
          if (!cancelled) {
            setEstimateLoading(false);
          }
        }
      })();
    }, 300);

    return () => {
      cancelled = true;
      window.clearTimeout(t);
    };
  }, [selected?.id, selected?.slug, hasDynamicSettings, dynSettings]);

  useEffect(() => {
    if (!result?.generationId || pollComplete) {
      return;
    }
    const id = result.generationId;
    const tick = () => {
      void fetchStatus(id);
    };
    tick();
    const interval = setInterval(tick, 3000);
    return () => clearInterval(interval);
  }, [result?.generationId, fetchStatus, pollComplete]);

  function setDynField(name: string, value: unknown) {
    setDynSettings((prev) => ({ ...prev, [name]: value }));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitDisabled) return;
    setError(null);
    setKlingImageError(null);
    setKlingVideoError(null);
    setResult(null);
    setPoll(null);
    setPollComplete(false);
    if (!modelId) {
      setError("Выберите модель");
      return;
    }
    if (!prompt.trim()) {
      setError("Введите промпт");
      return;
    }
    if (selected?.slug === "kling-3-0-motion-control") {
      const i = dynSettings.inputUrls;
      const v = dynSettings.videoUrls;
      const hasI =
        Array.isArray(i) &&
        i.length === 1 &&
        typeof i[0] === "string" &&
        /^https?:\/\//i.test(i[0].trim());
      const hasV =
        Array.isArray(v) &&
        v.length === 1 &&
        typeof v[0] === "string" &&
        /^https?:\/\//i.test(v[0].trim());
      if (!hasI) {
        setKlingImageError("Загрузите reference image.");
      }
      if (!hasV) {
        setKlingVideoError("Загрузите motion video.");
      }
      if (!hasI || !hasV) {
        return;
      }
    }

    const lines = inputFileUrls
      .split(/[\n,]+/)
      .map((s) => s.trim())
      .filter(Boolean);
    const body: Record<string, unknown> = {
      modelId,
      prompt: prompt.trim(),
    };
    if (typeof estimatedCredits === "number" && Number.isFinite(estimatedCredits)) {
      body.clientEstimateCredits = estimatedCredits;
    }

    if (hasDynamicSettings) {
      body.settings = dynSettings;
    } else {
      if (selected?.supportsNegativePrompt && negativePrompt.trim()) {
        body.negativePrompt = negativePrompt.trim();
      }
      if (aspectRatio.trim()) body.aspectRatio = aspectRatio.trim();
      if (resolution.trim()) body.resolution = resolution.trim();
      if (selected?.supportsSeed && seed.trim() !== "") {
        const n = parseInt(seed, 10);
        if (!Number.isInteger(n)) {
          setError("Seed: целое число");
          return;
        }
        body.seed = n;
      }
      if (selected?.maxDuration != null && durationSec.trim() !== "") {
        const d = parseInt(durationSec, 10);
        if (!Number.isInteger(d) || d < 1) {
          setError("Длительность: целое число секунд");
          return;
        }
        if (d > selected.maxDuration) {
          setError(`Максимальная длительность: ${selected.maxDuration} с`);
          return;
        }
        body.durationSec = d;
      }
      if (showInputUrls && lines.length > 0) {
        body.inputFiles = lines;
      }
    }

    setLoading(true);
    const controller = new AbortController();
    const clientTimeoutMs = 30_000;
    const timeoutId = window.setTimeout(() => controller.abort(), clientTimeoutMs);
    try {
      const res = await fetch("/api/generations/video", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      const data = (await res.json()) as {
        error?: string;
        message?: string;
        generationId?: string;
        status?: string;
        providerTaskId?: string | null;
        code?: string;
        credits?: number;
      };
      if (!res.ok) {
        if (
          res.status === 409 &&
          data.code === "PRICE_CHANGED" &&
          typeof data.credits === "number"
        ) {
          setEstimatedCredits(data.credits);
          const msg =
            typeof data.error === "string" && data.error.trim()
              ? data.error
              : "Цена изменилась. Обновите оценку и повторите отправку.";
          setError(msg);
          toast.error(msg);
          return;
        }
        const msg = [
          (typeof data.message === "string" && data.message.trim()
            ? data.message
            : null) ??
            (typeof data.error === "string" ? data.error : null) ??
            `Ошибка ${res.status}`,
          typeof (data as { reason?: string }).reason === "string" &&
          (data as { reason?: string }).reason!.trim() !== ""
            ? (data as { reason: string }).reason
            : null,
        ]
          .filter(Boolean)
          .join(" — ");
        setError(msg);
        toast.error(msg);
        return;
      }
      if (data.generationId && data.status) {
        setResult({
          generationId: data.generationId,
          status: data.status,
          providerTaskId: data.providerTaskId,
        });
        if (data.status === "COMPLETED") {
          toast.success("Видео готово");
          router.push(`/dashboard/history/${data.generationId}`);
        } else if (data.status === "FAILED" || data.status === "REFUNDED") {
          const msg = data.error ?? "Ошибка генерации";
          setError(msg);
          toast.error(msg);
        } else {
          toast.success("Запрос обработан");
        }
        void fetchStatus(data.generationId);
      } else {
        setError("Некорректный ответ сервера");
        toast.error("Некорректный ответ сервера");
      }
    } catch (e) {
      if (e instanceof Error && e.name === "AbortError") {
        const msg =
          "Превышено время ожидания ответа (30 с). Попробуйте снова или проверьте сервер.";
        setError(msg);
        toast.error(msg);
      } else {
        setError("Сеть: не удалось выполнить запрос");
        toast.error("Сеть: не удалось выполнить запрос");
      }
    } finally {
      window.clearTimeout(timeoutId);
      setLoading(false);
    }
  }

  if (models.length === 0) {
    return (
      <Alert>
        <AlertTitle>Нет активных VIDEO-моделей</AlertTitle>
        <AlertDescription>
          Добавьте модель (тип VIDEO) в админке и активируйте её.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="flex flex-col gap-8 lg:flex-row lg:items-start">
      <form onSubmit={onSubmit} className="min-w-0 flex-1 space-y-6">
        {error && (
          <Alert variant="destructive">
            <AlertTitle>Ошибка</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {klingMultishotBlocked && (
          <Alert variant="destructive">
            <AlertTitle>Multi-shot</AlertTitle>
            <AlertDescription>
              Режим multi-shot пока не поддерживается. Отключите опцию, чтобы
              продолжить.
            </AlertDescription>
          </Alert>
        )}

        {!hideModelSelect && familyHub ? (
          <div className="space-y-2">
            <Label>Режим</Label>
            <div className="flex flex-wrap gap-2">
              {models.map((m, i) => {
                const label = familyHub.labels[i] ?? m.name;
                const isOn = modelId === m.id;
                return (
                  <Button
                    key={m.id}
                    type="button"
                    variant={isOn ? "default" : "outline"}
                    className="rounded-full"
                    onClick={() => {
                      if (modelId === m.id) return;
                      setModelId(m.id);
                      setKlingImageError(null);
                      setKlingVideoError(null);
                      setMotionEstimateExtra(null);
                      setDynSettings(defaultsFromSchema(m.settingsSchema));
                    }}
                  >
                    {label}
                  </Button>
                );
              })}
            </div>
            {selected?.description && (
              <p className="text-muted-foreground text-xs">{selected.description}</p>
            )}
          </div>
        ) : !hideModelSelect ? (
          <div className="space-y-2">
            <Label htmlFor="vmodel">Модель</Label>
            <select
              id="vmodel"
              name="modelId"
              value={modelId}
              onChange={(e) => {
                const id = e.target.value;
                setModelId(id);
                setKlingImageError(null);
                setKlingVideoError(null);
                setMotionEstimateExtra(null);
                const m = models.find((x) => x.id === id);
                setDynSettings(defaultsFromSchema(m?.settingsSchema));
              }}
              className={cn(
                "border-input file:text-foreground placeholder:text-muted-foreground",
                "focus-visible:ring-ring flex h-9 w-full min-w-0 rounded-md border bg-transparent",
                "px-3 py-1 text-sm shadow-sm outline-none focus-visible:ring-2",
              )}
            >
              {models.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name} — от {m.creditsUiMin} кред
                </option>
              ))}
            </select>
            {selected?.description && (
              <p className="text-muted-foreground text-xs">{selected.description}</p>
            )}
          </div>
        ) : null}

        {hasDynamicSettings && (
          <DynamicModelSettingsFields
            schemaFields={schemaFields}
            dynSettings={dynSettings}
            setDynField={setDynField}
          />
        )}

        {selected?.slug === "kling-3-0-motion-control" && (
          <KlingMotionControlUploads
            inputUrls={
              Array.isArray(dynSettings.inputUrls)
                ? (dynSettings.inputUrls as string[])
                : []
            }
            videoUrls={
              Array.isArray(dynSettings.videoUrls)
                ? (dynSettings.videoUrls as string[])
                : []
            }
            setInputUrls={(urls) => setDynField("inputUrls", urls)}
            setVideoUrls={(urls) => setDynField("videoUrls", urls)}
            imageError={klingImageError}
            videoError={klingVideoError}
            onImageUploadSuccess={() => setKlingImageError(null)}
            onVideoUploadSuccess={({ fileId, durationSeconds }) => {
              setKlingVideoError(null);
              if (typeof fileId === "string" && fileId.trim() !== "") {
                setDynField("motionVideoFileId", fileId);
              }
              if (
                typeof durationSeconds === "number" &&
                Number.isFinite(durationSeconds) &&
                durationSeconds > 0
              ) {
                setDynField("videoDurationSeconds", durationSeconds);
              }
            }}
            onVideoCleared={() => {
              setDynSettings((prev) => {
                const n = { ...prev };
                delete n.motionVideoFileId;
                delete n.videoDurationSeconds;
                return n;
              });
              setMotionEstimateExtra(null);
            }}
            disabled={loading}
          />
        )}

        {selected?.slug === "kling-3-0-motion-control" &&
          typeof dynSettings.videoDurationSeconds === "number" &&
          Number.isFinite(dynSettings.videoDurationSeconds) &&
          dynSettings.videoDurationSeconds > 0 && (
            <Alert>
              <AlertTitle>Длительность видео</AlertTitle>
              <AlertDescription className="space-y-1 text-sm leading-relaxed">
                <p>
                  Длительность видео:{" "}
                  {(
                    motionEstimateExtra?.videoDurationSeconds ??
                    dynSettings.videoDurationSeconds
                  ).toLocaleString("ru-RU", {
                    minimumFractionDigits: 1,
                    maximumFractionDigits: 4,
                  })}{" "}
                  сек
                </p>
                <p>
                  К оплате считается:{" "}
                  {motionEstimateExtra?.billingDurationSeconds ??
                    Math.ceil(dynSettings.videoDurationSeconds as number)}{" "}
                  сек (округление вверх до целой секунды)
                </p>
              </AlertDescription>
            </Alert>
          )}

        {selected?.slug === "kling-3-0-motion-control" && (
          <Alert>
            <AlertTitle>Рекомендации к кадру</AlertTitle>
            <AlertDescription className="space-y-3 text-sm">
              <p>
                <strong>Reference image:</strong> JPEG, PNG или JPG; максимум 10 MB; размер
                больше 340px; aspect ratio 2:5 — 5:2; в кадре должны быть видны голова, плечи
                и торс персонажа или объекта.
              </p>
              <p>
                <strong>Motion video:</strong> MP4 или QuickTime; 3–30 с; максимум 100 MB; размер
                больше 340px; aspect ratio 2:5 — 5:2; в кадре — голова, плечи и торс. На один
                запрос — одно изображение и одно видео.
              </p>
            </AlertDescription>
          </Alert>
        )}

        <div className="space-y-2">
          <Label htmlFor="vprompt">Промпт</Label>
          <Textarea
            id="vprompt"
            name="prompt"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            rows={4}
            required
          />
        </div>

        {!hasDynamicSettings && selected?.supportsNegativePrompt && (
          <div className="space-y-2">
            <Label htmlFor="vneg">Негативный промпт</Label>
            <Textarea
              id="vneg"
              value={negativePrompt}
              onChange={(e) => setNegativePrompt(e.target.value)}
              rows={2}
            />
          </div>
        )}

        {!hasDynamicSettings && (
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="var">Соотношение</Label>
              <Input
                id="var"
                value={aspectRatio}
                onChange={(e) => setAspectRatio(e.target.value)}
                placeholder="16:9"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="vres">Разрешение</Label>
              <Input
                id="vres"
                value={resolution}
                onChange={(e) => setResolution(e.target.value)}
                placeholder="опц."
              />
            </div>
          </div>
        )}

        {!hasDynamicSettings && selected?.supportsSeed && (
          <div className="space-y-2">
            <Label htmlFor="vseed">Seed</Label>
            <Input
              id="vseed"
              inputMode="numeric"
              value={seed}
              onChange={(e) => setSeed(e.target.value)}
            />
          </div>
        )}

        {!hasDynamicSettings && selected?.maxDuration != null && (
          <div className="space-y-2">
            <Label htmlFor="vdur">
              Длительность, с (макс. {selected.maxDuration})
            </Label>
            <Input
              id="vdur"
              inputMode="numeric"
              value={durationSec}
              onChange={(e) => setDurationSec(e.target.value)}
              placeholder="например 5"
            />
          </div>
        )}

        {showInputUrls && (
          <div className="space-y-2">
            <Label htmlFor="vref">URL вложений (http/https, по строке)</Label>
            <Textarea
              id="vref"
              value={inputFileUrls}
              onChange={(e) => setInputFileUrls(e.target.value)}
              rows={3}
              className="font-mono text-xs"
              placeholder="https://…"
            />
          </div>
        )}

        <Button type="submit" disabled={submitDisabled}>
          {loading ? "Отправка…" : "Сгенерировать"}
        </Button>
      </form>

      <aside className="flex w-full flex-col gap-6 lg:sticky lg:top-4 lg:w-80 lg:shrink-0">
        <GenerationResultAside
          modelKind="VIDEO"
          generationId={result?.generationId ?? null}
          status={poll?.status ?? result?.status ?? null}
          errorMessage={poll?.errorMessage ?? null}
          outputFiles={poll?.outputFiles ?? null}
          providerTaskId={result?.providerTaskId ?? null}
          submitting={loading}
        />
        <GenerationCostCard
          estimateLoading={estimateLoading}
          estimateFailed={estimateFailed}
          credits={estimatedCredits}
          balanceCredits={balanceCredits}
        />
      </aside>
    </div>
  );
}
