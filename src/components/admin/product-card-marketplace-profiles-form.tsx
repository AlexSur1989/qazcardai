"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";

import type { ProductCardMarketplaceProfile } from "@/config/product-card-marketplace-profiles";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const SETTING_KEY = "PRODUCT_CARD_MARKETPLACE_PROFILES";

export function ProductCardMarketplaceProfilesForm({
  initialMergedProfiles,
  canPatchSettings,
}: {
  initialMergedProfiles: ProductCardMarketplaceProfile[];
  canPatchSettings: boolean;
}) {
  const baseline = useMemo(() => JSON.stringify(initialMergedProfiles, null, 2), [initialMergedProfiles]);

  const [text, setText] = useState(baseline);
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!canPatchSettings) {
      toast.error("Нужно право «Настройки — изменение» (settings.manage).");
      return;
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(text.trim() || "[]") as unknown;
    } catch {
      toast.error("Некорректный JSON. Проверьте синтаксис.");
      return;
    }
    if (!Array.isArray(parsed)) {
      toast.error("Ожидался JSON-массив профилей.");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/settings/${encodeURIComponent(SETTING_KEY)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ value: parsed }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(typeof data.error === "string" ? data.error : "Не удалось сохранить");
        return;
      }
      toast.success("Профили маркетплейсов сохранены в AppSetting.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Маркетплейсы «Создать карточку»</CardTitle>
        <CardDescription>
          JSON-массив полных профилей: при сохранении каждый объект с полем <code className="text-xs">id</code>{" "}
          накладывается на кодовые defaults. Пустой массив <code className="text-xs">[]</code> — только defaults из
          репозитория. Не выкладывайте в публичный доступ чувствительные данные.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <textarea
          className="bg-muted/40 font-mono text-xs field-sizing-content min-h-[420px] w-full rounded-xl border border-border p-3"
          value={text}
          onChange={(e) => setText(e.target.value)}
          spellCheck={false}
        />
        <div className="flex flex-wrap gap-2">
          <Button type="button" className="rounded-xl" disabled={saving} onClick={() => void save()}>
            {saving ? "Сохраняем…" : `Сохранить ${SETTING_KEY}`}
          </Button>
          <Button
            type="button"
            variant="outline"
            className="rounded-xl"
            disabled={saving}
            onClick={() => {
              setText(baseline);
              toast.message("Текст сброшен к текущему снимку с сервера (session).");
            }}
          >
            Сбросить к загруженному
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
