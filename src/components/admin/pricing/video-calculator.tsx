"use client";

import { useCallback, useState } from "react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2 } from "lucide-react";

const SELECT_CLS =
  "border-border bg-background text-foreground h-9 w-full rounded-lg border px-2.5 text-sm";

type VideoModelOption = {
  id: string;
  name: string;
  slug: string;
  scenario: "general" | "product";
};

type CalcResult = {
  credits: number;
  formula: string;
  priceSource?: string;
  providerCostUsd?: number;
  marginPercent?: number | null;
};

type Props = {
  generalModels: VideoModelOption[];
  productModels: VideoModelOption[];
};

export function AdminVideoPricingCalculator({ generalModels, productModels }: Props) {
  const [scenario, setScenario] = useState<"general" | "product">(
    generalModels.length > 0 ? "general" : "product",
  );
  const models = scenario === "general" ? generalModels : productModels;
  const [modelId, setModelId] = useState(models[0]?.id ?? "");
  const [duration, setDuration] = useState("5");
  const [resolution, setResolution] = useState("720p");
  const [mode, setMode] = useState("std_no_sound");
  const [sound, setSound] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<CalcResult | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const run = useCallback(async () => {
    if (!modelId) return;
    setLoading(true);
    setErr(null);
    try {
      const body: Record<string, unknown> = {
        scenario,
        modelId,
        duration: Number.isFinite(Number(duration)) ? Number(duration) : duration,
        resolution,
      };
      if (scenario === "general") {
        body.mode = mode;
        body.sound = sound;
      }
      const res = await fetch("/api/admin/pricing/video-calculator", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await res.json()) as CalcResult & { error?: string };
      if (!res.ok) {
        setErr(data.error ?? `Ошибка ${res.status}`);
        setResult(null);
        return;
      }
      setResult(data);
    } catch {
      setErr("Сеть: не удалось рассчитать");
    } finally {
      setLoading(false);
    }
  }, [scenario, modelId, duration, resolution, mode, sound]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Калькулятор видео</CardTitle>
        <CardDescription>
          GENERAL — pricingSchema модели; Product Card — product_card_matrix.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div className="space-y-1.5">
            <Label>Сценарий</Label>
            <select
              className={SELECT_CLS}
              value={scenario}
              onChange={(e) => {
                const s = e.target.value as "general" | "product";
                setScenario(s);
                const list = s === "general" ? generalModels : productModels;
                setModelId(list[0]?.id ?? "");
              }}
            >
              <option value="general" disabled={generalModels.length === 0}>
                AI-видео (GENERAL)
              </option>
              <option value="product" disabled={productModels.length === 0}>
                Видео товара (Product Card)
              </option>
            </select>
          </div>
          <div className="space-y-1.5">
            <Label>Модель</Label>
            <select
              className={SELECT_CLS}
              value={modelId}
              onChange={(e) => setModelId(e.target.value)}
            >
              {models.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label>Длительность (с)</Label>
            <select className={SELECT_CLS} value={duration} onChange={(e) => setDuration(e.target.value)}>
              {["5", "10", "15"].map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label>Разрешение</Label>
            <select
              className={SELECT_CLS}
              value={resolution}
              onChange={(e) => setResolution(e.target.value)}
            >
              {["480p", "720p", "1080p", "std", "pro", "4K"].map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>
          {scenario === "general" ? (
            <>
              <div className="space-y-1.5">
                <Label>Mode (Kling и др.)</Label>
                <select className={SELECT_CLS} value={mode} onChange={(e) => setMode(e.target.value)}>
                  {["std_no_sound", "std_sound", "pro_no_sound", "pro_sound", "720p", "1080p"].map(
                    (m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ),
                  )}
                </select>
              </div>
              <div className="flex items-end gap-2 pb-1">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={sound}
                    onChange={(e) => setSound(e.target.checked)}
                  />
                  sound
                </label>
              </div>
            </>
          ) : null}
        </div>
        <Button type="button" onClick={() => void run()} disabled={loading || !modelId}>
          {loading ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              Считаем…
            </>
          ) : (
            "Рассчитать"
          )}
        </Button>
        {err ? (
          <Alert variant="destructive">
            <AlertDescription>{err}</AlertDescription>
          </Alert>
        ) : null}
        {result ? (
          <div className="bg-muted/40 space-y-1 rounded-md border p-4 text-sm">
            <p className="text-2xl font-semibold tabular-nums">
              {result.credits} <span className="text-base font-normal">токенов</span>
            </p>
            <p className="font-mono text-xs">{result.formula}</p>
            {result.marginPercent != null ? (
              <p className="text-muted-foreground text-xs">
                Маржа: {result.marginPercent.toFixed(1)}%
              </p>
            ) : null}
            <details className="text-xs">
              <summary className="cursor-pointer text-muted-foreground">Technical details</summary>
              <pre className="mt-2 overflow-auto">{JSON.stringify(result, null, 2)}</pre>
            </details>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
