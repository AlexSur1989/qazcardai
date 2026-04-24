"use client";

import { useState } from "react";
import Link from "next/link";

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

export function CreateImageForm({ models, balanceCredits }: Props) {
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
    outputUrls?: string[];
  } | null>(null);

  const selected = models.find((m) => m.id === modelId);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setResult(null);
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
        setResult({
          generationId: data.generationId,
          status: data.status,
          outputUrls: data.outputUrls,
        });
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

  return (
    <form onSubmit={onSubmit} className="space-y-6 max-w-2xl">
      <p className="text-muted-foreground text-sm">
        Баланс: <span className="text-foreground font-medium tabular-nums">{balanceCredits}</span> кред
      </p>

      {error && (
        <Alert variant="destructive">
          <AlertTitle>Не удалось запустить</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {result && (
        <Alert>
          <AlertTitle>Генерация создана</AlertTitle>
          <AlertDescription className="space-y-2">
            <p>
              ID: <code className="text-xs break-all">{result.generationId}</code> — статус:{" "}
              <strong>{result.status}</strong>
            </p>
            {result.outputUrls && result.outputUrls.length > 0 && (
              <ul className="list-disc pl-4 text-sm space-y-1">
                {result.outputUrls.map((u) => (
                  <li key={u}>
                    <a
                      href={u}
                      target="_blank"
                      rel="noreferrer"
                      className="text-primary underline"
                    >
                      {u.slice(0, 64)}
                      {u.length > 64 ? "…" : ""}
                    </a>
                  </li>
                ))}
              </ul>
            )}
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
