"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PRODUCT_CARD_SCENARIO_CATALOG } from "@/lib/product-card-admin-meta";
import type { ProductCardScenarioKey } from "@/server/services/productCardSettings";

type ScenarioToggle = { enabled: boolean; label: string };

const DEFAULT_BY_KEY = Object.fromEntries(
  PRODUCT_CARD_SCENARIO_CATALOG.map((m) => [
    m.id,
    { enabled: true, label: m.title },
  ]),
) as Record<ProductCardScenarioKey, ScenarioToggle>;

function readToggle(raw: unknown, fb: ScenarioToggle): ScenarioToggle {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return fb;
  const o = raw as Record<string, unknown>;
  const enabled =
    typeof o.enabled === "boolean"
      ? o.enabled
      : typeof o.disabled === "boolean"
        ? !o.disabled
        : fb.enabled;
  const label =
    typeof o.label === "string" && o.label.trim().length > 0 ? o.label.trim() : fb.label;
  return { enabled, label };
}

function normalizeScenarios(initial: unknown): Record<ProductCardScenarioKey, ScenarioToggle> {
  const out = { ...DEFAULT_BY_KEY };
  if (!initial || typeof initial !== "object" || Array.isArray(initial)) return out;
  const root = initial as Record<string, unknown>;
  for (const meta of PRODUCT_CARD_SCENARIO_CATALOG) {
    out[meta.id] = readToggle(root[meta.id], DEFAULT_BY_KEY[meta.id]);
  }
  return out;
}

export function ProductCardScenariosForm({
  initialJson,
  canPatch,
}: {
  initialJson: unknown;
  canPatch: boolean;
}) {
  const start = useMemo(() => normalizeScenarios(initialJson), [initialJson]);
  const [state, setState] = useState<Record<ProductCardScenarioKey, ScenarioToggle>>(start);
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!canPatch) {
      toast.error("Нужно право «Настройки — изменение» (settings.manage).");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(
        `/api/admin/settings/${encodeURIComponent("PRODUCT_CARD_SCENARIOS")}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ value: state }),
        },
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(typeof data.error === "string" ? data.error : "Не удалось сохранить");
        return;
      }
      toast.success("Сценарии обновлены");
    } finally {
      setSaving(false);
    }
  }

  const ordered = [...PRODUCT_CARD_SCENARIO_CATALOG].sort(
    (a, b) => a.overviewOrder - b.overviewOrder,
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>Сценарии AI-карточек товара</CardTitle>
        <CardDescription>
          Включение сценариев, названия для клиента и видимость вкладок в кабинете. Цены — в{" "}
          <Link href="/admin/pricing" className="underline">
            Цены и тарифы
          </Link>
          .
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!canPatch ? (
          <p className="text-muted-foreground text-sm">
            Для сохранения нужно право settings.manage. Включение/выключение без смены подписей —
            через API сценариев ниже на странице или у администратора с правом настроек.
          </p>
        ) : null}
        <div className="space-y-4">
          {ordered.map((meta, index) => (
            <div
              key={meta.id}
              className="flex flex-col gap-3 rounded-xl border border-border bg-background p-4"
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
                <div className="flex flex-1 items-start gap-3">
                  <input
                    id={`scenario-${meta.id}`}
                    type="checkbox"
                    className="border-input mt-1 size-4 shrink-0 rounded border"
                    checked={state[meta.id].enabled}
                    disabled={!canPatch}
                    onChange={(e) =>
                      setState((prev) => ({
                        ...prev,
                        [meta.id]: { ...prev[meta.id], enabled: e.target.checked },
                      }))
                    }
                  />
                  <div className="min-w-0 flex-1 space-y-2">
                    <div>
                      <Label htmlFor={`scenario-${meta.id}`} className="text-sm font-semibold">
                        {meta.title}
                      </Label>
                      <p className="text-muted-foreground mt-1 text-sm">{meta.description}</p>
                      <p className="text-muted-foreground mt-1 text-xs">{meta.clientHint}</p>
                    </div>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
                      <Link href={meta.pricingHref} className="text-primary underline">
                        {meta.pricingLabel}
                      </Link>
                    </div>
                    <details className="text-muted-foreground text-xs">
                      <summary className="cursor-pointer select-none">Технические детали</summary>
                      <p className="mt-1 font-mono">internal id: {meta.id}</p>
                      <p className="font-mono">AppSetting: PRODUCT_CARD_SCENARIOS.{meta.id}</p>
                      <p>Порядок в обзоре: {index + 1}</p>
                    </details>
                  </div>
                </div>
                <div className="w-full space-y-1 sm:w-56">
                  <Label className="text-xs text-muted-foreground">Название для клиента</Label>
                  <Input
                    value={state[meta.id].label}
                    disabled={!canPatch}
                    onChange={(e) =>
                      setState((prev) => ({
                        ...prev,
                        [meta.id]: {
                          ...prev[meta.id],
                          label: e.target.value,
                        },
                      }))
                    }
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
        <Button type="button" disabled={!canPatch || saving} onClick={() => void save()}>
          {saving ? "Сохраняем…" : "Сохранить сценарии"}
        </Button>
      </CardContent>
    </Card>
  );
}
