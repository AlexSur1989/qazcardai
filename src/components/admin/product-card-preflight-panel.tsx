"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { readJsonSafe } from "@/lib/fetch-json-safe";
import type { MarketplaceCardPreflightResult, PreflightCheck } from "@/server/services/marketplaceCardPreflight";

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

export function ProductCardPreflightPanel() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<MarketplaceCardPreflightResult | null>(null);

  const runPreflight = async () => {
    setLoading(true);
    setError(null);
    const res = await fetch("/api/admin/product-card/preflight/marketplace-card", {
      method: "POST",
    });
    const parsed = await readJsonSafe<MarketplaceCardPreflightResult & { error?: string }>(res);
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
        <CardTitle className="text-base">Preflight перед real test</CardTitle>
        <Button type="button" size="sm" disabled={loading} onClick={() => void runPreflight()}>
          {loading ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
          Проверить готовность marketplace card
        </Button>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-muted-foreground text-xs">
          Проверка без вызова Kie.ai и без списания кредитов. Real test запускайте только вручную
          после Ready.
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
                {result.readyForRealTest ? "Ready for real test" : "Not ready for real test"}
              </AlertTitle>
              <AlertDescription>
                {result.readyForRealTest ? (
                  <>
                    Можно запускать real test вручную. Он может списать средства Kie.ai и токены
                    пользователя.
                  </>
                ) : (
                  <>Исправьте пункты ниже перед первым real test.</>
                )}
              </AlertDescription>
            </Alert>
            <div className="text-muted-foreground flex flex-wrap gap-3 text-xs">
              <span>
                Final credits:{" "}
                <strong className="text-foreground">{result.finalCredits ?? "—"}</strong>
              </span>
              <span>
                QUEUE_MODE: <span className="font-mono">{result.queueMode}</span>
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
            {result.warnings.length > 0 ? (
              <ul className="text-muted-foreground list-inside list-disc text-xs">
                {result.warnings.map((w) => (
                  <li key={w}>{w}</li>
                ))}
              </ul>
            ) : null}
          </>
        ) : null}
      </CardContent>
    </Card>
  );
}
