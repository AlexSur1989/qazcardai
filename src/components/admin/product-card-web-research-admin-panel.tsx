"use client";

import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ProductCardWebResearchSettings } from "@/lib/product-card-web-research-config";
import { readJsonSafe } from "@/lib/fetch-json-safe";

type Props = {
  initialSettings: ProductCardWebResearchSettings;
  canEdit: boolean;
};

export function ProductCardWebResearchAdminPanel({ initialSettings, canEdit }: Props) {
  const [settings, setSettings] = useState(initialSettings);
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!canEdit) return;
    setSaving(true);
    try {
      const res = await fetch("/api/admin/product-card/web-research-settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      const parsed = await readJsonSafe(res);
      if (!parsed.ok || !res.ok) {
        toast.error(parsed.ok ? "Не удалось сохранить" : parsed.message);
        return;
      }
      toast.success("Настройки Web Research сохранены");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card className="border-border/80">
      <CardHeader>
        <CardTitle className="text-base">Web Research для характеристик</CardTitle>
        <CardDescription>
          Поиск характеристик в интернете после Vision-анализа. Клиент подтверждает данные перед
          генерацией. Требуется TAVILY_API_KEY на сервере (или mock-режим).
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <label className="flex cursor-pointer items-center gap-2 text-sm">
          <input
            type="checkbox"
            className="size-4 rounded border"
            checked={settings.enabled}
            disabled={!canEdit}
            onChange={(e) => setSettings((s) => ({ ...s, enabled: e.target.checked }))}
          />
          Включено
        </label>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <Label>Макс. источников</Label>
            <Input
              type="number"
              min={1}
              max={10}
              value={settings.maxSources}
              disabled={!canEdit}
              onChange={(e) =>
                setSettings((s) => ({
                  ...s,
                  maxSources: Math.min(10, Math.max(1, parseInt(e.target.value, 10) || 1)),
                }))
              }
            />
          </div>
          <div className="space-y-1">
            <Label>Timeout поиска (мс)</Label>
            <Input
              type="number"
              min={5000}
              max={60000}
              value={settings.searchTimeoutMs}
              disabled={!canEdit}
              onChange={(e) =>
                setSettings((s) => ({
                  ...s,
                  searchTimeoutMs: Math.min(
                    60_000,
                    Math.max(5000, parseInt(e.target.value, 10) || 25_000),
                  ),
                }))
              }
            />
          </div>
        </div>
        <div className="space-y-1">
          <Label>Разрешённые домены (через запятую, пусто = все)</Label>
          <Input
            value={settings.allowedDomains.join(", ")}
            disabled={!canEdit}
            onChange={(e) =>
              setSettings((s) => ({
                ...s,
                allowedDomains: e.target.value
                  .split(",")
                  .map((d) => d.trim())
                  .filter(Boolean),
              }))
            }
          />
        </div>
        <label className="flex cursor-pointer items-center gap-2 text-sm">
          <input
            type="checkbox"
            className="size-4 rounded border"
            checked={settings.riskyCategoriesRequireManualConfirmation}
            disabled={!canEdit}
            onChange={(e) =>
              setSettings((s) => ({
                ...s,
                riskyCategoriesRequireManualConfirmation: e.target.checked,
              }))
            }
          />
          Risky categories требуют ручного подтверждения web-facts
        </label>
        {canEdit ? (
          <Button type="button" size="sm" disabled={saving} onClick={() => void save()}>
            Сохранить
          </Button>
        ) : null}
      </CardContent>
    </Card>
  );
}
