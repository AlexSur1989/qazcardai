"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  PRODUCT_CLASSIFIER_ACCESS_MODES,
  type ProductClassifierAccessMode,
} from "@/lib/product-classifier-access-mode";
import { readJsonSafe } from "@/lib/fetch-json-safe";

type CommercialState = {
  runtimeGateEnabled: boolean;
  accessMode: ProductClassifierAccessMode;
  costCredits: number;
  dailyLimit: number;
  cooldownSeconds: number;
};

type Props = {
  canEdit: boolean;
};

const ACCESS_LABELS: Record<ProductClassifierAccessMode, string> = {
  disabled: "Выключено (USER не видит кнопку)",
  admin_only: "Только ADMIN/SUPER_ADMIN",
  beta_users: "Beta users (TODO — пока как disabled для USER)",
  all_users: "Все пользователи (при включённом runtime gate)",
};

export function ProductCardClassifierCommercialPanel({ canEdit }: Props) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [state, setState] = useState<CommercialState | null>(null);

  useEffect(() => {
    void (async () => {
      setLoading(true);
      const res = await fetch("/api/admin/product-card/classifier-commercial");
      const parsed = await readJsonSafe<CommercialState & { ok?: boolean }>(res);
      setLoading(false);
      if (!parsed.ok || !res.ok) {
        setError(parsed.ok ? "Не удалось загрузить настройки" : parsed.message);
        return;
      }
      setState(parsed.data);
    })();
  }, []);

  const save = async () => {
    if (!state || !canEdit) return;
    setSaving(true);
    setError(null);
    setSaved(false);
    const res = await fetch("/api/admin/product-card/classifier-commercial", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        accessMode: state.accessMode,
        costCredits: state.costCredits,
        dailyLimit: state.dailyLimit,
        cooldownSeconds: state.cooldownSeconds,
      }),
    });
    const parsed = await readJsonSafe<{ ok?: boolean; error?: string }>(res);
    setSaving(false);
    if (!parsed.ok || !res.ok) {
      setError(parsed.ok ? (parsed.data.error ?? "Ошибка сохранения") : parsed.message);
      return;
    }
    setSaved(true);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Classifier access &amp; pricing</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        <Alert>
          <AlertTitle>Runtime gate в .env — главный выключатель</AlertTitle>
          <AlertDescription className="text-xs leading-relaxed">
            AppSettings управляют доступом и стоимостью, но не могут включить real Kie classifier,
            если <span className="font-mono">PRODUCT_CLASSIFIER_ALLOW_REAL_KIE</span> выключен в
            .env.
          </AlertDescription>
        </Alert>

        {loading ? (
          <p className="text-muted-foreground flex items-center gap-2 text-xs">
            <Loader2 className="size-4 animate-spin" />
            Загрузка…
          </p>
        ) : state ? (
          <>
            <dl className="grid gap-2 sm:grid-cols-2">
              <div className="rounded-lg border border-border/80 bg-muted/20 p-3">
                <dt className="text-muted-foreground text-xs">Runtime gate</dt>
                <dd className="font-semibold">
                  {state.runtimeGateEnabled ? "enabled" : "disabled"}
                </dd>
              </div>
              <div className="rounded-lg border border-border/80 bg-muted/20 p-3">
                <dt className="text-muted-foreground text-xs">Cost per recognition</dt>
                <dd className="font-semibold tabular-nums">{state.costCredits} токен(ов)</dd>
              </div>
            </dl>

            {canEdit ? (
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5 sm:col-span-2">
                  <Label htmlFor="pc-classifier-access">Access mode</Label>
                  <select
                    id="pc-classifier-access"
                    className="border-input w-full rounded-xl border bg-card px-3 py-2 text-sm"
                    value={state.accessMode}
                    onChange={(e) =>
                      setState({
                        ...state,
                        accessMode: e.target.value as ProductClassifierAccessMode,
                      })
                    }
                  >
                    {PRODUCT_CLASSIFIER_ACCESS_MODES.map((mode) => (
                      <option key={mode} value={mode}>
                        {ACCESS_LABELS[mode]}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="pc-classifier-cost">Cost credits</Label>
                  <input
                    id="pc-classifier-cost"
                    type="number"
                    min={0}
                    className="border-input w-full rounded-xl border bg-card px-3 py-2 text-sm tabular-nums"
                    value={state.costCredits}
                    onChange={(e) =>
                      setState({ ...state, costCredits: Number(e.target.value) })
                    }
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="pc-classifier-daily">Daily limit</Label>
                  <input
                    id="pc-classifier-daily"
                    type="number"
                    min={1}
                    className="border-input w-full rounded-xl border bg-card px-3 py-2 text-sm tabular-nums"
                    value={state.dailyLimit}
                    onChange={(e) =>
                      setState({ ...state, dailyLimit: Number(e.target.value) })
                    }
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="pc-classifier-cooldown">Cooldown (seconds)</Label>
                  <input
                    id="pc-classifier-cooldown"
                    type="number"
                    min={1}
                    className="border-input w-full rounded-xl border bg-card px-3 py-2 text-sm tabular-nums"
                    value={state.cooldownSeconds}
                    onChange={(e) =>
                      setState({ ...state, cooldownSeconds: Number(e.target.value) })
                    }
                  />
                </div>
              </div>
            ) : (
              <ul className="text-muted-foreground space-y-1 text-xs">
                <li>
                  Access mode: <span className="font-mono">{state.accessMode}</span>
                </li>
                <li>Daily limit: {state.dailyLimit}</li>
                <li>Cooldown: {state.cooldownSeconds}s</li>
              </ul>
            )}

            {canEdit ? (
              <Button type="button" size="sm" disabled={saving} onClick={() => void save()}>
                {saving ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
                Сохранить commercial settings
              </Button>
            ) : null}
            {saved ? (
              <p className="text-xs text-green-600 dark:text-green-400">Сохранено.</p>
            ) : null}
          </>
        ) : null}

        {error ? (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}
      </CardContent>
    </Card>
  );
}
