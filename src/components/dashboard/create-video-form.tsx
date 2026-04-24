"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { cn } from "@/lib/utils";
import type { GenerationStatus } from "@/generated/prisma/enums";

export type CreateVideoFormModel = {
  id: string;
  name: string;
  slug: string;
  costCredits: number;
  description: string | null;
  supportsNegativePrompt: boolean;
  supportsImageInput: boolean;
  supportsVideoInput: boolean;
  supportsSeed: boolean;
  maxDuration: number | null;
};

type Props = {
  models: CreateVideoFormModel[];
  balanceCredits: number;
};

const TERMINAL: GenerationStatus[] = [
  "COMPLETED",
  "FAILED",
  "REFUNDED",
  "CANCELLED",
  "BLOCKED",
];

export function CreateVideoForm({ models, balanceCredits }: Props) {
  const [modelId, setModelId] = useState(models[0]?.id ?? "");
  const [prompt, setPrompt] = useState("");
  const [negativePrompt, setNegativePrompt] = useState("");
  const [aspectRatio, setAspectRatio] = useState("");
  const [resolution, setResolution] = useState("");
  const [seed, setSeed] = useState("");
  const [durationSec, setDurationSec] = useState("");
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

  const showInputUrls =
    selected?.supportsImageInput || selected?.supportsVideoInput;

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

    setLoading(true);
    try {
      const res = await fetch("/api/generations/video", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await res.json()) as {
        error?: string;
        generationId?: string;
        status?: string;
      };
      if (!res.ok) {
        setError(data.error ?? `Ошибка ${res.status}`);
        return;
      }
      if (data.generationId && data.status) {
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
        <AlertTitle>Нет активных VIDEO-моделей</AlertTitle>
        <AlertDescription>
          Добавьте модель (тип VIDEO) в админке и активируйте её.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <form onSubmit={onSubmit} className="max-w-2xl space-y-6">
      <p className="text-muted-foreground text-sm">
        Баланс:{" "}
        <span className="text-foreground font-medium tabular-nums">
          {balanceCredits}
        </span>{" "}
        кред. Задача встаёт в очередь, ответ приходит сразу.
      </p>

      {error && (
        <Alert variant="destructive">
          <AlertTitle>Ошибка</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {result && (
        <Alert>
          <AlertTitle>Задача принята</AlertTitle>
          <AlertDescription className="space-y-2 text-sm">
            <p>
              ID:{" "}
              <code className="text-xs break-all">{result.generationId}</code> —
              «{result.status}»
            </p>
            {poll && (
              <p>
                Статус сейчас: <strong>{poll.status}</strong>
                {poll.errorMessage && (
                  <span className="text-destructive block">
                    {poll.errorMessage}
                  </span>
                )}
              </p>
            )}
            <p className="text-muted-foreground text-xs">
              Статус обновляется каждые 3 с (GET /api/generations/:id). После
              воркера (этап 9) сюда попадут outputFiles.
            </p>
            <Link
              href="/dashboard"
              className="text-primary font-medium inline-block underline"
            >
              К кабинету
            </Link>
          </AlertDescription>
        </Alert>
      )}

      <div className="space-y-2">
        <Label htmlFor="vmodel">Модель</Label>
        <select
          id="vmodel"
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

      {selected?.supportsNegativePrompt && (
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

      {selected?.supportsSeed && (
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

      {selected?.maxDuration != null && (
        <div className="space-y-2">
          <Label htmlFor="vdur">Длительность, с (макс. {selected.maxDuration})</Label>
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

      <Button type="submit" disabled={loading}>
        {loading ? "Отправка…" : "Создать задачу"}
      </Button>
    </form>
  );
}
