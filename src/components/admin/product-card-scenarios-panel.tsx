"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import type {
  ProductCardScenarioKey,
  ProductCardScenarioToggles,
} from "@/server/services/productCardSettings";

type Props = {
  initial: ProductCardScenarioToggles;
  /** Скрыть internal id (основной режим). */
  hideTechnicalIds?: boolean;
};

const ORDER: ProductCardScenarioKey[] = [
  "conceptPhoto",
  "marketplaceCard",
  "cardBuilder",
  "productVideo",
];

export function ProductCardScenariosPanel({ initial, hideTechnicalIds = false }: Props) {
  const [scenarios, setScenarios] = useState<ProductCardScenarioToggles>(initial);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const patch = (key: ProductCardScenarioKey, enabled: boolean) => {
    setScenarios((prev) => ({
      ...prev,
      [key]: { ...prev[key], enabled },
    }));
    setMessage(null);
    setError(null);
  };

  const save = async () => {
    setSaving(true);
    setMessage(null);
    setError(null);
    try {
      const res = await fetch("/api/admin/product-card/scenarios", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scenarios }),
      });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!res.ok) {
        setError(data.error ?? "Не удалось сохранить");
        return;
      }
      setMessage("Сохранено");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <p className="text-muted-foreground text-sm">
        Отключённый сценарий скрывается в кабинете; запросы к API этого сценария возвращают ошибку, токены не
        резервируются.
      </p>
      <div className="grid max-w-xl gap-4">
        {ORDER.map((key) => (
          <div
            key={key}
            className="flex items-center justify-between gap-4 rounded-xl border border-border px-4 py-3"
          >
            <div className="space-y-0.5">
              <Label className="text-base font-medium" htmlFor={`scenario-${key}`}>
                {scenarios[key].label}
              </Label>
              {hideTechnicalIds ? null : (
                <p className="text-muted-foreground font-mono text-xs">{key}</p>
              )}
            </div>
            <input
              id={`scenario-${key}`}
              type="checkbox"
              checked={scenarios[key].enabled}
              onChange={(e) => patch(key, e.target.checked)}
              className="border-input accent-primary size-4 shrink-0 cursor-pointer rounded border"
              aria-label={scenarios[key].label}
            />
          </div>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Button type="button" onClick={() => void save()} disabled={saving}>
          {saving ? "Сохранение…" : "Сохранить"}
        </Button>
        {message ? <span className="text-sm text-emerald-700">{message}</span> : null}
        {error ? <span className="text-sm text-destructive">{error}</span> : null}
      </div>
    </div>
  );
}
