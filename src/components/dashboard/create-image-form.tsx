"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";

import type { GenerationStatus } from "@/generated/prisma/enums";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { cn } from "@/lib/utils";
import { USER_LABELS } from "@/lib/user-facing-copy";
import { canonicalModelSlug } from "@/lib/model-slug-params";
import {
  defaultsFromSchema,
  getSchemaFields,
} from "@/lib/generation-form-settings-schema";
import { toast } from "sonner";
import { DynamicModelSettingsFields } from "@/components/dashboard/dynamic-model-settings-fields";
import { GenerationCostCard } from "@/components/dashboard/generation-cost-card";
import { GenerationResultAside } from "@/components/dashboard/generation-result-aside";

export type CreateImageFormModel = {
  id: string;
  name: string;
  slug: string;
  /** Подпись в селекторе для варианта внутри группы (иначе — name). */
  pickerLabel?: string;
  costCredits: number;
  /** Минимум с бэкенда (matrix / fallback), для подписи до ответа estimate */
  creditsUiMin: number;
  description: string | null;
  settingsSchema?: unknown;
  supportsNegativePrompt: boolean;
  supportsImageInput: boolean;
  supportsSeed: boolean;
};

export type CreateImageModelGroup = {
  label: string;
  members: CreateImageFormModel[];
};

type Props = {
  soloModels: CreateImageFormModel[];
  modelGroups: CreateImageModelGroup[];
  balanceCredits: number;
  /** Для хаба семейства: режим выбран снаружи, селект модели не нужен. */
  hideModelSelect?: boolean;
};

function formatModelOptionLabel(m: CreateImageFormModel): string {
  const title = m.pickerLabel ?? m.name;
  return `${title} — от ${m.creditsUiMin} кред`;
}

const TERMINAL: GenerationStatus[] = [
  "COMPLETED",
  "FAILED",
  "REFUNDED",
  "CANCELLED",
  "BLOCKED",
];

export function CreateImageForm({
  soloModels,
  modelGroups,
  balanceCredits,
  hideModelSelect = false,
}: Props) {
  const searchParams = useSearchParams();
  const allModels = useMemo(
    () => [...soloModels, ...modelGroups.flatMap((g) => g.members)],
    [soloModels, modelGroups],
  );

  const [modelId, setModelId] = useState(() => {
    const mid = searchParams.get("modelId");
    const canonical = canonicalModelSlug(searchParams.get("model"));
    if (mid && allModels.some((m) => m.id === mid)) {
      return mid;
    }
    if (canonical) {
      const bySlug = allModels.find((m) => m.slug === canonical);
      if (bySlug) {
        return bySlug.id;
      }
    }
    return allModels[0]?.id ?? "";
  });
  const [prompt, setPrompt] = useState(() => {
    const pr = searchParams.get("prompt");
    return pr != null && pr.length > 0 ? pr : "";
  });
  const [negativePrompt, setNegativePrompt] = useState("");
  const [aspectRatio, setAspectRatio] = useState("");
  const [resolution, setResolution] = useState("");
  const [seed, setSeed] = useState("");
  const [inputFileUrls, setInputFileUrls] = useState("");

  const selected = useMemo(
    () => allModels.find((m) => m.id === modelId),
    [allModels, modelId],
  );

  const schemaFields = useMemo(
    () => getSchemaFields(selected?.settingsSchema),
    [selected?.settingsSchema],
  );
  const hasDynamicSettings = schemaFields.length > 0;

  const [dynSettings, setDynSettings] = useState<Record<string, unknown>>(() => {
    const mid = searchParams.get("modelId");
    const canonical = canonicalModelSlug(searchParams.get("model"));
    const bySlugMatch = canonical
      ? allModels.find((m) => m.slug === canonical)
      : undefined;
    const initialId =
      mid && allModels.some((m) => m.id === mid)
        ? mid
        : (bySlugMatch?.id ?? allModels[0]?.id ?? "");
    const m = allModels.find((x) => x.id === initialId);
    return defaultsFromSchema(m?.settingsSchema);
  });

  const [estimatedCredits, setEstimatedCredits] = useState<number | null>(null);
  const [estimateLoading, setEstimateLoading] = useState(true);
  const [estimateFailed, setEstimateFailed] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{
    generationId: string;
    status: string;
  } | null>(null);
  const [poll, setPoll] = useState<{
    id: string;
    status: string;
    errorMessage: string | null;
    outputFiles: unknown;
  } | null>(null);
  const [pollComplete, setPollComplete] = useState(false);

  const showInputUrls =
    !hasDynamicSettings && selected?.supportsImageInput;

  const insufficientBalance =
    estimatedCredits != null && balanceCredits < estimatedCredits;

  const submitDisabled =
    loading ||
    estimateLoading ||
    estimateFailed ||
    estimatedCredits == null ||
    insufficientBalance;

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
          const data = (await res.json()) as { credits?: number; error?: string };
          if (cancelled) return;
          if (res.ok && typeof data.credits === "number") {
            setEstimatedCredits(data.credits);
            setEstimateFailed(false);
          } else {
            setEstimatedCredits(null);
            setEstimateFailed(true);
          }
        } catch {
          if (cancelled) return;
          setEstimatedCredits(null);
          setEstimateFailed(true);
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
  }, [selected?.id, hasDynamicSettings, dynSettings]);

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
    setResult(null);
    setPoll(null);
    setPollComplete(false);
    if (!modelId) {
      setError("Выберите модель");
      return;
    }
    if (!prompt.trim()) {
      setError("Введите описание");
      return;
    }

    const lines = inputFileUrls
      .split(/[\n,]+/)
      .map((s) => s.trim())
      .filter(Boolean);
    const body: Record<string, unknown> = {
      modelId,
      prompt: prompt.trim(),
    };

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
      if (showInputUrls && lines.length > 0) {
        body.inputFiles = lines;
      }
    }
    if (typeof estimatedCredits === "number" && Number.isFinite(estimatedCredits)) {
      body.clientEstimateCredits = estimatedCredits;
    }

    setLoading(true);
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), 30_000);
    try {
      const res = await fetch("/api/generations/image", {
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
        outputUrls?: string[];
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
        setResult({ generationId: data.generationId, status: data.status });
        toast.success(USER_LABELS.generationStarted);
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

  if (allModels.length === 0) {
    return (
      <Alert>
        <AlertTitle>Нет активных IMAGE-моделей</AlertTitle>
        <AlertDescription>
          Администратор должен добавить модели (тип IMAGE) в разделе админки.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="flex flex-col gap-8 lg:flex-row lg:items-start">
      <form onSubmit={onSubmit} className="min-w-0 flex-1 space-y-6">
        {error && (
          <Alert variant="destructive">
            <AlertTitle>Не удалось запустить</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {!hideModelSelect && (
          <div className="space-y-2">
            <Label htmlFor="modelId">Модель</Label>
            <select
              id="modelId"
              name="modelId"
              value={modelId}
              onChange={(e) => {
                const id = e.target.value;
                setModelId(id);
                const m = allModels.find((x) => x.id === id);
                setDynSettings(defaultsFromSchema(m?.settingsSchema));
              }}
              className={cn(
                "border-input file:text-foreground placeholder:text-muted-foreground",
                "focus-visible:ring-ring flex h-9 w-full min-w-0 rounded-md border bg-transparent",
                "px-3 py-1 text-sm shadow-sm outline-none focus-visible:ring-2",
              )}
            >
              {soloModels.map((m) => (
                <option key={m.id} value={m.id}>
                  {formatModelOptionLabel(m)}
                </option>
              ))}
              {modelGroups.map((g) => (
                <optgroup key={g.label} label={g.label}>
                  {g.members.map((m) => (
                    <option key={m.id} value={m.id}>
                      {formatModelOptionLabel(m)}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
            {selected?.description && (
              <p className="text-muted-foreground text-xs">{selected.description}</p>
            )}
          </div>
        )}

        {hasDynamicSettings && (
          <DynamicModelSettingsFields
            schemaFields={schemaFields}
            dynSettings={dynSettings}
            setDynField={setDynField}
          />
        )}

        <div className="space-y-2">
          <Label htmlFor="prompt">{USER_LABELS.prompt}</Label>
          <Textarea
            id="prompt"
            name="prompt"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            rows={4}
            required
            placeholder="Опишите изображение"
          />
        </div>

        {!hasDynamicSettings && selected?.supportsNegativePrompt && (
          <div className="space-y-2">
            <Label htmlFor="neg">{USER_LABELS.negativePromptOptional}</Label>
            <Textarea
              id="neg"
              value={negativePrompt}
              onChange={(e) => setNegativePrompt(e.target.value)}
              rows={2}
            />
          </div>
        )}

        {!hasDynamicSettings && (
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="ar">Соотношение (например 1:1, 3:2)</Label>
              <Input
                id="ar"
                value={aspectRatio}
                onChange={(e) => setAspectRatio(e.target.value)}
                placeholder="1:1"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="res">Разрешение (если применимо)</Label>
              <Input
                id="res"
                value={resolution}
                onChange={(e) => setResolution(e.target.value)}
                placeholder="опционально"
              />
            </div>
          </div>
        )}

        {!hasDynamicSettings && selected?.supportsSeed && (
          <div className="space-y-2">
            <Label htmlFor="seed">Seed (опционально)</Label>
            <Input
              id="seed"
              inputMode="numeric"
              value={seed}
              onChange={(e) => setSeed(e.target.value)}
              placeholder="целое число"
            />
          </div>
        )}

        {showInputUrls && (
          <div className="space-y-2">
            <Label htmlFor="ref">
              URL референс-изображений (http/https, по одному в строке)
            </Label>
            <Textarea
              id="ref"
              value={inputFileUrls}
              onChange={(e) => setInputFileUrls(e.target.value)}
              rows={3}
              placeholder="https://…"
              className="font-mono text-xs"
            />
          </div>
        )}

        <Button type="submit" disabled={submitDisabled}>
          {loading ? "Отправка…" : "Сгенерировать"}
        </Button>
      </form>

      <aside className="flex w-full flex-col gap-6 lg:sticky lg:top-4 lg:w-80 lg:shrink-0">
        <GenerationResultAside
          modelKind="IMAGE"
          generationId={result?.generationId ?? null}
          status={poll?.status ?? result?.status ?? null}
          errorMessage={poll?.errorMessage ?? null}
          outputFiles={poll?.outputFiles ?? null}
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
