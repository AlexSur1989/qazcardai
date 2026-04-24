"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

import type { GenerationStatus } from "@/generated/prisma/enums";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { cn } from "@/lib/utils";

export type CreateImageFormModel = {
  id: string;
  name: string;
  slug: string;
  costCredits: number;
  description: string | null;
  supportsNegativePrompt: boolean;
  supportsImageInput: boolean;
  supportsSeed: boolean;
};

type Props = {
  models: CreateImageFormModel[];
  balanceCredits: number;
};

const TERMINAL: GenerationStatus[] = [
  "COMPLETED",
  "FAILED",
  "REFUNDED",
  "CANCELLED",
  "BLOCKED",
];

function outputUrlsFromFiles(output: unknown): string[] {
  if (output == null) return [];
  if (!Array.isArray(output)) return [];
  return output
    .map((x) => {
      if (x && typeof x === "object" && "url" in x && typeof (x as { url: string }).url === "string") {
        return (x as { url: string }).url;
      }
      return null;
    })
    .filter((u): u is string => u != null);
}

export function CreateImageForm({ models, balanceCredits }: Props) {
  const searchParams = useSearchParams();
  const [modelId, setModelId] = useState(models[0]?.id ?? "");
  const [prompt, setPrompt] = useState("");
  const [negativePrompt, setNegativePrompt] = useState("");
  const [aspectRatio, setAspectRatio] = useState("");
  const [resolution, setResolution] = useState("");
  const [seed, setSeed] = useState("");
  const [inputFileUrls, setInputFileUrls] = useState("");

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

  const selected = models.find((m) => m.id === modelId);

  useEffect(() => {
    const mid = searchParams.get("modelId");
    const pr = searchParams.get("prompt");
    if (mid && models.some((m) => m.id === mid)) {
      setModelId(mid);
    }
    if (pr != null && pr.length > 0) {
      setPrompt(pr);
    }
  }, [searchParams, models]);

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
    if (!result?.generationId || pollComplete) {
      return;
    }
    const id = result.generationId;
    const tick = () => {
      void fetchStatus(id);
    };
    tick();
    const t = setInterval(tick, 3000);
    return () => clearInterval(t);
  }, [result?.generationId, fetchStatus, pollComplete]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
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

    const lines = inputFileUrls
      .split(/[\n,]+/)
      .map((s) => s.trim())
      .filter(Boolean);
    const body: Record<string, unknown> = {
      modelId,
      prompt: prompt.trim(),
    };
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
    if (selected?.supportsImageInput && lines.length > 0) {
      body.inputFiles = lines;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/generations/image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await res.json()) as {
        error?: string;
        generationId?: string;
        status?: string;
        outputUrls?: string[];
      };
      if (!res.ok) {
        setError(data.error ?? `Ошибка ${res.status}`);
        return;
      }
      if (data.generationId && data.status) {
        if (data.status === "BLOCKED") {
          setError(
            data.error ?? "Запрос не отправлен в провайдера: заблокирован модерацией.",
          );
          return;
        }
        setResult({ generationId: data.generationId, status: data.status });
        void fetchStatus(data.generationId);
      } else {
        setError("Некорректный ответ сервера");
      }
    } catch {
      setError("Сеть: не удалось выполнить запрос");
    } finally {
      setLoading(false);
    }
  }

  if (models.length === 0) {
    return (
      <Alert>
        <AlertTitle>Нет активных IMAGE-моделей</AlertTitle>
        <AlertDescription>
          Администратор должен добавить модели (тип IMAGE) в разделе админки.
        </AlertDescription>
      </Alert>
    );
  }

  const pollUrls = poll ? outputUrlsFromFiles(poll.outputFiles) : [];

  return (
    <form onSubmit={onSubmit} className="max-w-2xl space-y-6">
      <p className="text-muted-foreground text-sm">
        Баланс: <span className="text-foreground font-medium tabular-nums">{balanceCredits}</span> кред. Запрос
        в очередь (Redis + worker), готовый URL приходит в статусе.
      </p>

      {error && (
        <Alert variant="destructive">
          <AlertTitle>Не удалось запустить</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {result && (
        <Alert>
          <AlertTitle>Задача поставлена</AlertTitle>
          <AlertDescription className="space-y-2 text-sm">
            <p>
              ID: <code className="text-xs break-all">{result.generationId}</code> —{" "}
              <strong>{result.status}</strong>
            </p>
            {poll && (
              <p>
                Статус: <strong>{poll.status}</strong>
                {poll.errorMessage && (
                  <span className="text-destructive block">{poll.errorMessage}</span>
                )}
              </p>
            )}
            {pollUrls.length > 0 && (
              <ul className="list-disc pl-4 space-y-1">
                {pollUrls.map((u) => (
                  <li key={u}>
                    <a
                      href={u}
                      target="_blank"
                      rel="noreferrer"
                      className="text-primary underline"
                    >
                      {u.length > 72 ? `${u.slice(0, 72)}…` : u}
                    </a>
                  </li>
                ))}
              </ul>
            )}
            <p className="text-muted-foreground text-xs">
              Обновление статуса каждые 3 с (GET /api/generations/:id).
            </p>
            <Link
              href="/dashboard"
              className="text-primary text-sm font-medium inline-block underline"
            >
              К списку в кабинете
            </Link>
          </AlertDescription>
        </Alert>
      )}

      <div className="space-y-2">
        <Label htmlFor="modelId">Модель</Label>
        <select
          id="modelId"
          name="modelId"
          value={modelId}
          onChange={(e) => setModelId(e.target.value)}
          className={cn(
            "border-input file:text-foreground placeholder:text-muted-foreground",
            "focus-visible:ring-ring flex h-9 w-full min-w-0 rounded-md border bg-transparent",
            "px-3 py-1 text-sm shadow-sm outline-none focus-visible:ring-2",
          )}
        >
          {models.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name} — {m.costCredits} кред
            </option>
          ))}
        </select>
        {selected?.description && (
          <p className="text-muted-foreground text-xs">{selected.description}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="prompt">Промпт</Label>
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

      {selected?.supportsNegativePrompt && (
        <div className="space-y-2">
          <Label htmlFor="neg">Негативный промпт (опционально)</Label>
          <Textarea
            id="neg"
            value={negativePrompt}
            onChange={(e) => setNegativePrompt(e.target.value)}
            rows={2}
          />
        </div>
      )}

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

      {selected?.supportsSeed && (
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

      {selected?.supportsImageInput && (
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

      <Button type="submit" disabled={loading}>
        {loading ? "Отправка…" : "Создать"}
      </Button>
    </form>
  );
}
