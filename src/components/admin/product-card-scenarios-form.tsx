"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type ScenarioKey = "conceptPhoto" | "marketplaceCard" | "cardBuilder" | "productVideo";

type ScenarioToggle = { enabled: boolean; label: string };

const DEFAULT_SCENARIOS: Record<ScenarioKey, ScenarioToggle> = {
  conceptPhoto: { enabled: true, label: "Фото с концепциями" },
  marketplaceCard: { enabled: true, label: "Карточка товара" },
  cardBuilder: { enabled: true, label: "Создать карточку" },
  productVideo: { enabled: true, label: "Видео" },
};

const KEYS: ScenarioKey[] = [
  "conceptPhoto",
  "marketplaceCard",
  "cardBuilder",
  "productVideo",
];

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

function normalizeScenarios(initial: unknown): Record<ScenarioKey, ScenarioToggle> {
  const out = { ...DEFAULT_SCENARIOS };
  if (!initial || typeof initial !== "object" || Array.isArray(initial)) return out;
  const root = initial as Record<string, unknown>;
  for (const k of KEYS) {
    out[k] = readToggle(root[k], DEFAULT_SCENARIOS[k]);
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
  const [state, setState] = useState<Record<ScenarioKey, ScenarioToggle>>(start);
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
      toast.success("Видимость сценариев обновлена");
    } finally {
      setSaving(false);
    }
  }

  const rows: Array<{ key: ScenarioKey; title: string; hint: string }> = [
    { key: "conceptPhoto", title: "Фото с концепциями", hint: "Вкладка концептов в кабинете." },
    { key: "marketplaceCard", title: "Карточка товара", hint: "Витринная карточка маркетплейса." },
    { key: "cardBuilder", title: "Создать карточку", hint: "Мастер продающей галереи (отдельный сценарий)." },
    { key: "productVideo", title: "Видео", hint: "Видео по исходному фото." },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Видимость сценариев Product Card</CardTitle>
        <CardDescription>
          Управляет вкладками в разделе «Создать карточку товара». Отключённые сценарии не резервируют
          токены через соответствующие API.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!canPatch ? (
          <p className="text-muted-foreground text-sm">
            Недостаточно прав для записи ключей приложения — посмотрите значение ниже или откройте{" "}
            <span className="font-medium">Общие настройки</span> под учёткой с правом управления настройками.
          </p>
        ) : null}
        <div className="space-y-4">
          {rows.map((row) => (
            <div
              key={row.key}
              className="flex flex-col gap-3 rounded-xl border border-border bg-background p-3 sm:flex-row sm:items-start"
            >
              <div className="flex flex-1 items-start gap-3">
                <input
                  id={`scenario-${row.key}`}
                  type="checkbox"
                  className="border-input mt-0.5 size-4 shrink-0 rounded border"
                  checked={state[row.key].enabled}
                  disabled={!canPatch}
                  onChange={(e) =>
                    setState((prev) => ({
                      ...prev,
                      [row.key]: { ...prev[row.key], enabled: e.target.checked },
                    }))
                  }
                />
                <div className="min-w-0 space-y-1">
                  <Label htmlFor={`scenario-${row.key}`} className="text-sm font-medium">
                    {row.title}
                  </Label>
                  <p className="text-muted-foreground text-xs">{row.hint}</p>
                </div>
              </div>
              <div className="w-full space-y-1 sm:w-56">
                <Label className="text-xs text-muted-foreground">Подпись вкладки</Label>
                <Input
                  value={state[row.key].label}
                  disabled={!canPatch}
                  onChange={(e) =>
                    setState((prev) => ({
                      ...prev,
                      [row.key]: {
                        ...prev[row.key],
                        label: e.target.value,
                      },
                    }))
                  }
                />
              </div>
            </div>
          ))}
        </div>
        <Button type="button" disabled={!canPatch || saving} onClick={() => void save()}>
          {saving ? "Сохраняем…" : "Сохранить PRODUCT_CARD_SCENARIOS"}
        </Button>
      </CardContent>
    </Card>
  );
}
