"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import type { GenerationStatus } from "@/generated/prisma/enums";
import { DynamicModelSettingsFields } from "@/components/dashboard/dynamic-model-settings-fields";
import { GenerationCostCard } from "@/components/dashboard/generation-cost-card";
import { GenerationResultAside } from "@/components/dashboard/generation-result-aside";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  defaultsFromSchema,
  getSchemaFields,
  type SchemaField,
} from "@/lib/generation-form-settings-schema";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export type GptImage2PlaygroundModel = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  settingsSchema: unknown;
};

type GptVariant = "t2i" | "i2i";

const TERMINAL: GenerationStatus[] = [
  "COMPLETED",
  "FAILED",
  "REFUNDED",
  "CANCELLED",
  "BLOCKED",
];

const GPT_DOCS_HINT =
  "Поля соответствуют Kie GPT Image 2 (prompt → input.prompt, aspect_ratio → input.aspect_ratio, resolution → input.resolution; для image-to-image — input.input_urls через загрузку файлов).";

type Props = {
  balanceCredits: number;
  t2i: GptImage2PlaygroundModel;
  i2i: GptImage2PlaygroundModel;
  /** Из URL страницы: ?variant=i2i или ?variant=t2i */
  initialVariant?: GptVariant;
};

export function GptImage2Playground({
  balanceCredits,
  t2i,
  i2i,
  initialVariant,
}: Props) {
  const [variant, setVariant] = useState<GptVariant>(initialVariant ?? "t2i");
  const selected = variant === "t2i" ? t2i : i2i;

  const allSchemaFields = useMemo(
    () => getSchemaFields(selected.settingsSchema),
    [selected.settingsSchema],
  );

  const resolutionField = useMemo(
    () => allSchemaFields.find((f) => f.name === "resolution"),
    [allSchemaFields],
  );

  const resolutionOptions = useMemo(() => {
    const opts = resolutionField?.options;
    return Array.isArray(opts)
      ? opts.map((o) => String(o))
      : (["1K", "2K", "4K"] as string[]);
  }, [resolutionField]);

  const dynamicFields = useMemo(
    () =>
      allSchemaFields.filter((f): f is SchemaField => f.name !== "resolution"),
    [allSchemaFields],
  );

  const [dynSettings, setDynSettings] = useState<Record<string, unknown>>(() =>
    defaultsFromSchema(selected.settingsSchema),
  );

  const [prompt, setPrompt] = useState("");

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

  useEffect(() => {
    queueMicrotask(() => {
      setDynSettings(defaultsFromSchema(selected.settingsSchema));
      setResult(null);
      setPoll(null);
      setPollComplete(false);
      setError(null);
    });
  }, [variant, selected.id, selected.settingsSchema]);

  function setDynField(name: string, value: unknown) {
    setDynSettings((prev) => ({ ...prev, [name]: value }));
  }

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
    [setPoll, setPollComplete],
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
      if (!res.ok) return;
      applyPoll(data);
    },
    [applyPoll],
  );

  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled) {
        setEstimateLoading(true);
        setEstimateFailed(false);
      }
    });

    const t = window.setTimeout(() => {
      void (async () => {
        try {
          const res = await fetch("/api/generations/estimate", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              modelId: selected.id,
              settings: dynSettings,
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
          if (!cancelled) {
            setEstimatedCredits(null);
            setEstimateFailed(true);
          }
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
  }, [selected.id, dynSettings]);

  useEffect(() => {
    if (!result?.generationId || pollComplete) {
      return;
    }
    const id = result.generationId;
    const first = window.setTimeout(() => {
      void fetchStatus(id);
    }, 0);
    const interval = setInterval(() => {
      void fetchStatus(id);
    }, 3000);
    return () => {
      window.clearTimeout(first);
      clearInterval(interval);
    };
  }, [result?.generationId, fetchStatus, pollComplete]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitDisabled) return;

    const p = prompt.trim();
    setError(null);
    setResult(null);
    setPoll(null);
    setPollComplete(false);

    if (!p) {
      setError("Введите промпт (обязательное поле API: prompt)");
      return;
    }

    if (variant === "i2i") {
      const urls = dynSettings.inputUrls;
      const nonempty =
        Array.isArray(urls) ?
          urls.filter((u): u is string => typeof u === "string" && u.trim() !== "")
        : [];
      if (nonempty.length === 0) {
        setError("Добавьте хотя бы одно изображение через загрузку (input_urls).");
        return;
      }
    }

    const body: Record<string, unknown> = {
      modelId: selected.id,
      prompt: p,
      settings: dynSettings,
    };

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
        toast.success("Запрос поставлен в очередь");
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

  return (
    <section
      id="gpt-image-2-playground"
      className="border-border rounded-2xl border bg-muted/25 p-5 shadow-inner md:p-6"
    >
      <div className="mb-6 space-y-1">
        <h2 className="text-lg font-semibold">Генерация GPT Image 2</h2>
        <p className="text-muted-foreground text-sm">
          {GPT_DOCS_HINT}{" "}
          <a
            href="https://kie.ai/gpt-image-2"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary underline"
          >
            Документация Kie: GPT Image 2
          </a>
        </p>
      </div>

      <div className="flex flex-col gap-8 lg:flex-row lg:items-start">
        <form onSubmit={onSubmit} className="min-w-0 flex-1 space-y-6">
          {error && (
            <Alert variant="destructive">
              <AlertTitle>Не удалось запустить</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-2">
            <Label className="text-sm font-medium">Режим (Kie)</Label>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant={variant === "t2i" ? "default" : "outline"}
                onClick={() => setVariant("t2i")}
                className="rounded-full"
              >
                Text to image (text-to-image)
              </Button>
              <Button
                type="button"
                variant={variant === "i2i" ? "default" : "outline"}
                onClick={() => setVariant("i2i")}
                className="rounded-full"
              >
                Image to image (image-to-image)
              </Button>
            </div>
            <p className="text-muted-foreground text-xs">
              Маршруты API Kie: модель текст→изображение —{" "}
              <span className="font-mono">gpt-image-2-text-to-image</span>; с
              входными картинками —{" "}
              <span className="font-mono">gpt-image-2-image-to-image</span>.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="gpt2-prompt">Промпт (prompt → input.prompt)</Label>
            <Textarea
              id="gpt2-prompt"
              name="prompt"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              rows={5}
              required
              placeholder="Описание того, что должно быть на изображении"
              className="min-h-[120px]"
            />
          </div>

          <DynamicModelSettingsFields
            schemaFields={dynamicFields}
            dynSettings={dynSettings}
            setDynField={setDynField}
          />

          <div className="space-y-2">
            <Label>Разрешение (resolution)</Label>
            <div className="flex flex-wrap gap-2">
              {resolutionOptions.map((opt) => {
                const current =
                  dynSettings.resolution != null
                    ? String(dynSettings.resolution)
                    : "";
                const isActive = current === opt;
                return (
                  <Button
                    key={opt}
                    type="button"
                    variant={isActive ? "default" : "outline"}
                    className={cn(
                      "min-w-[4rem] rounded-lg font-semibold tabular-nums",
                    )}
                    onClick={() => setDynField("resolution", opt)}
                  >
                    {opt}
                  </Button>
                );
              })}
            </div>
            <p className="text-muted-foreground text-xs leading-relaxed">
              По документации Kie допустимы <span className="font-mono">1K</span>,{" "}
              <span className="font-mono">2K</span>,{" "}
              <span className="font-mono">4K</span>. Если{" "}
              <span className="font-mono">aspect_ratio</span> не 1:1, вывод 4K
              может ограничиваться (фактически 1K). Для{" "}
              <span className="font-mono">auto</span> или без заданной пары может
              применяться сценарий 1K.
            </p>
          </div>

          {variant === "i2i" && (
            <p className="text-muted-foreground text-xs leading-relaxed">
              <span className="font-mono">input_urls</span>: до 16 изображений
              после загрузки; форматы JPEG / PNG / WebP, как в Kie; публичные URL
              подставляет сервер после <span className="font-mono">/api/uploads</span>
              .
            </p>
          )}

          {selected.description && (
            <p className="text-muted-foreground text-xs">{selected.description}</p>
          )}

          <Button type="submit" disabled={submitDisabled} className="w-full sm:w-auto">
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
    </section>
  );
}
