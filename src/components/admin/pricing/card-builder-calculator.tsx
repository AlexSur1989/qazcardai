"use client";

import { useCallback, useState } from "react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2 } from "lucide-react";

const SELECT_CLS =
  "border-border bg-background text-foreground h-9 w-full rounded-lg border px-2.5 text-sm";

const SLIDE_ROLES = [
  "main_photo",
  "benefits_infographic",
  "detail_closeup",
  "materials",
  "dimensions",
  "lifestyle",
  "packaging",
  "premium_poster",
] as const;

const VISUAL_STYLES = [
  "auto",
  "minimalism",
  "premium",
  "bold_ad",
  "lifestyle",
  "infographic",
] as const;

type CalcResult = {
  effectiveSalesStyle: string;
  effectiveTextDensity: string;
  baseCredits: number;
  multipliers: {
    premiumStyle: boolean;
    heavyText: boolean;
    premiumFactor: number;
    heavyFactor: number;
  };
  finalCredits: number;
  formula: string;
  formulaDetail: string;
  notes: string[];
  modelName: string;
  fallbackFromMarketplaceCard: boolean;
};

export function AdminCardBuilderPricingCalculator() {
  const [mode, setMode] = useState<"slide" | "gallery6" | "gallery8">("slide");
  const [slideRole, setSlideRole] = useState<string>("lifestyle");
  const [visualStyle, setVisualStyle] = useState<string>("premium");
  const [textAmount, setTextAmount] = useState<"less" | "more">("more");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<CalcResult | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const run = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const res = await fetch("/api/admin/pricing/card-builder-calculator", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode, slideRole, visualStyle, textAmount }),
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
  }, [mode, slideRole, visualStyle, textAmount]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Калькулятор (как estimate)</CardTitle>
        <CardDescription>
          Использует resolveCardBuilderPricingStyleForSlide и estimateCardBuilderCharge.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-1.5">
            <Label>Режим</Label>
            <select
              className={SELECT_CLS}
              value={mode}
              onChange={(e) => setMode(e.target.value as typeof mode)}
            >
              <option value="slide">1 слайд</option>
              <option value="gallery6">Галерея 6</option>
              <option value="gallery8">Галерея 8</option>
            </select>
          </div>
          <div className="space-y-1.5">
            <Label>Тип слайда</Label>
            <select
              className={SELECT_CLS}
              value={slideRole}
              onChange={(e) => setSlideRole(e.target.value)}
            >
              {SLIDE_ROLES.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label>Стиль карточки</Label>
            <select
              className={SELECT_CLS}
              value={visualStyle}
              onChange={(e) => setVisualStyle(e.target.value)}
            >
              {VISUAL_STYLES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label>Текста</Label>
            <select
              className={SELECT_CLS}
              value={textAmount}
              onChange={(e) => setTextAmount(e.target.value as "less" | "more")}
            >
              <option value="less">Меньше</option>
              <option value="more">Больше</option>
            </select>
          </div>
        </div>
        <Button type="button" onClick={() => void run()} disabled={loading}>
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
          <div className="bg-muted/40 space-y-2 rounded-md border p-4 text-sm">
            <p>
              <span className="text-muted-foreground">effectiveSalesStyle:</span>{" "}
              <strong>{result.effectiveSalesStyle}</strong>
            </p>
            <p>
              <span className="text-muted-foreground">effectiveTextDensity:</span>{" "}
              <strong>{result.effectiveTextDensity}</strong>
            </p>
            <p>
              <span className="text-muted-foreground">База:</span>{" "}
              <strong>{result.baseCredits}</strong> ток.
            </p>
            <p>
              <span className="text-muted-foreground">Множители:</span>{" "}
              premium {result.multipliers.premiumStyle ? `×${result.multipliers.premiumFactor}` : "—"},{" "}
              heavy {result.multipliers.heavyText ? `×${result.multipliers.heavyFactor}` : "—"}
            </p>
            <p className="text-2xl font-semibold tabular-nums">
              {result.finalCredits} <span className="text-base font-normal">токенов</span>
            </p>
            <p className="font-mono text-xs">{result.formula}</p>
            {result.notes.map((n) => (
              <p key={n} className="text-muted-foreground text-xs">
                • {n}
              </p>
            ))}
            <details className="text-xs">
              <summary className="cursor-pointer text-muted-foreground">Technical details</summary>
              <pre className="mt-2 overflow-auto whitespace-pre-wrap">{result.formulaDetail}</pre>
              <p className="mt-1">
                model: {result.modelName}, fallback marketplace:{" "}
                {result.fallbackFromMarketplaceCard ? "да" : "нет"}
              </p>
            </details>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
