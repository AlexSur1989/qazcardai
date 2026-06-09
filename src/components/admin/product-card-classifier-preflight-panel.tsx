"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { readJsonSafe } from "@/lib/fetch-json-safe";
import type { ClassifierPreflightResult } from "@/server/services/classifierPreflight";
import type { PreflightCheck } from "@/server/services/marketplaceCardPreflight";

const STATUS_VARIANT: Record<
  PreflightCheck["status"],
  "qazBlue" | "outline" | "destructive"
> = {
  ok: "qazBlue",
  configured: "qazBlue",
  missing: "outline",
  warning: "outline",
  error: "destructive",
};

export function ProductCardClassifierPreflightPanel() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ClassifierPreflightResult | null>(null);

  const runPreflight = async () => {
    setLoading(true);
    setError(null);
    const res = await fetch("/api/admin/product-card/preflight/classifier", {
      method: "POST",
    });
    const parsed = await readJsonSafe<ClassifierPreflightResult & { error?: string }>(res);
    setLoading(false);
    if (!parsed.ok || !res.ok) {
      setError(parsed.ok ? (parsed.data.error ?? "Preflight failed") : parsed.message);
      setResult(null);
      return;
    }
    setResult(parsed.data);
  };

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
        <CardTitle className="text-base">Preflight classifier</CardTitle>
        <Button type="button" size="sm" disabled={loading} onClick={() => void runPreflight()}>
          {loading ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
          Проверить готовность classifier
        </Button>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-muted-foreground text-xs">
          Проверка chat/completions payload без вызова Kie.ai. Real classifier test — только
          вручную после Ready.
        </p>
        {error ? (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}
        {result ? (
          <>
            <Alert variant={result.readyForRealTest ? "default" : "destructive"}>
              <AlertTitle>
                {result.readyForRealTest ? "Ready for real classifier test" : "Not ready"}
              </AlertTitle>
            <AlertDescription>
              <div className="space-y-1">
                <p>
                  {result.readyForRealTest
                    ? "Можно запускать controlled real classifier test (admin) после активации runtime gate."
                    : "Исправьте пункты ниже. Real Kie test для USER пока недоступен."}
                </p>
                <p>
                  USER traffic:{" "}
                  <strong>{result.readyForUserTraffic ? "ready" : "not ready"}</strong>
                  {result.commercial
                    ? ` · access=${result.commercial.accessMode} · cost=${result.commercial.costCredits}`
                    : null}
                </p>
              </div>
            </AlertDescription>
            </Alert>
            <div className="text-muted-foreground flex flex-wrap gap-3 text-xs">
              <span>
                Model: <span className="font-mono">{result.modelSlug ?? "—"}</span>
              </span>
              <span>
                MOCK_KIE:{" "}
                <span className="font-mono">{result.mockKie ? "true" : "false"}</span>
              </span>
            </div>
            <div className="divide-border/80 divide-y rounded-lg border border-border/80">
              {result.checks.map((check) => (
                <div
                  key={check.key}
                  className="flex flex-wrap items-start justify-between gap-2 px-3 py-2 text-xs"
                >
                  <div>
                    <p className="font-medium">{check.label}</p>
                    {check.message ? (
                      <p className="text-muted-foreground font-mono text-[10px]">{check.message}</p>
                    ) : null}
                  </div>
                  <Badge variant={STATUS_VARIANT[check.status]}>{check.status}</Badge>
                </div>
              ))}
            </div>
          </>
        ) : null}
      </CardContent>
    </Card>
  );
}
