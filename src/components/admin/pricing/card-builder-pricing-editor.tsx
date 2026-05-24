"use client";

import { useCallback, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

import { AdminCardBuilderPricingCalculator } from "@/components/admin/pricing/card-builder-calculator";
import {
  buildCardBuilderPricingPreview,
  cardBuilderPricingSoftWarnings,
  cardBuilderPricingToProductCardShape,
  DEFAULT_CARD_BUILDER_PRICING_API,
  type CardBuilderPricingApi,
} from "@/lib/pricing-admin/card-builder";
import type { AppSettingMeta } from "@/server/services/adminPricingEditor";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const INPUT_CLS = "text-sm";

type Props = {
  initialPricing: CardBuilderPricingApi;
  meta: AppSettingMeta | null;
  canEdit: boolean;
};

function formatMeta(meta: AppSettingMeta | null): string | null {
  if (!meta?.updatedAt) return null;
  const when = new Date(meta.updatedAt).toLocaleString("ru-RU");
  return meta.updatedByEmail
    ? `Последнее изменение: ${meta.updatedByEmail}, ${when}`
    : `Последнее изменение: ${when}`;
}

export function CardBuilderPricingEditor({ initialPricing, meta, canEdit }: Props) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<CardBuilderPricingApi>(initialPricing);
  const [saved, setSaved] = useState<CardBuilderPricingApi>(initialPricing);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);

  const preview = useMemo(() => {
    return buildCardBuilderPricingPreview(cardBuilderPricingToProductCardShape(draft));
  }, [draft]);

  const softWarnings = useMemo(() => cardBuilderPricingSoftWarnings(draft), [draft]);

  const save = useCallback(async () => {
    setLoading(true);
    setErr(null);
    setOkMsg(null);
    try {
      const res = await fetch("/api/admin/pricing/card-builder", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft),
      });
      const data = (await res.json()) as { error?: string; pricing?: CardBuilderPricingApi };
      if (!res.ok) {
        setErr(data.error ?? `Ошибка ${res.status}`);
        return;
      }
      if (data.pricing) {
        setSaved(data.pricing);
        setDraft(data.pricing);
      }
      setOkMsg("Тарифы сохранены");
      setEditing(false);
      router.refresh();
    } catch {
      setErr("Сеть: не удалось сохранить");
    } finally {
      setLoading(false);
    }
  }, [draft, router]);

  const resetDefault = useCallback(async () => {
    if (!confirm("Сбросить тарифы к значениям по умолчанию?")) return;
    setLoading(true);
    setErr(null);
    try {
      const res = await fetch("/api/admin/pricing/card-builder?action=reset-default", {
        method: "POST",
      });
      const data = (await res.json()) as { error?: string; pricing?: CardBuilderPricingApi };
      if (!res.ok) {
        setErr(data.error ?? `Ошибка ${res.status}`);
        return;
      }
      const p = data.pricing ?? DEFAULT_CARD_BUILDER_PRICING_API;
      setDraft(p);
      setSaved(p);
      setOkMsg("Сброшено к default");
      router.refresh();
    } catch {
      setErr("Сеть: не удалось сбросить");
    } finally {
      setLoading(false);
    }
  }, [router]);

  const metaLine = formatMeta(meta);

  return (
    <div className="space-y-6">
      {metaLine ? <p className="text-muted-foreground text-xs">{metaLine}</p> : null}
      {err ? (
        <Alert variant="destructive">
          <AlertDescription>{err}</AlertDescription>
        </Alert>
      ) : null}
      {okMsg ? (
        <Alert>
          <AlertDescription>{okMsg}</AlertDescription>
        </Alert>
      ) : null}
      {softWarnings.map((w) => (
        <Alert key={w}>
          <AlertDescription>{w}</AlertDescription>
        </Alert>
      ))}

      <Card>
        <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-2">
          <div>
            <CardTitle className="text-base">Тарифы «Создать карточку»</CardTitle>
            <CardDescription>PRODUCT_CARD_CARD_BUILDER_PRICING</CardDescription>
          </div>
          {canEdit ? (
            <Button
              type="button"
              variant={editing ? "secondary" : "outline"}
              size="sm"
              onClick={() => {
                setEditing((v) => !v);
                setDraft(saved);
                setErr(null);
              }}
            >
              {editing ? "Закрыть редактор" : "Редактировать тарифы"}
            </Button>
          ) : null}
        </CardHeader>
        <CardContent className="space-y-4">
          {editing ? (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <div>
                <Label>План структуры</Label>
                <Input
                  className={INPUT_CLS}
                  type="number"
                  min={0}
                  value={draft.planCredits}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, planCredits: Number(e.target.value) }))
                  }
                />
              </div>
              <div>
                <Label>1 слайд</Label>
                <Input
                  className={INPUT_CLS}
                  type="number"
                  min={1}
                  value={draft.singleSlideCredits}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, singleSlideCredits: Number(e.target.value) }))
                  }
                />
              </div>
              <div>
                <Label>Галерея 6</Label>
                <Input
                  className={INPUT_CLS}
                  type="number"
                  min={1}
                  value={draft.gallery6Credits}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, gallery6Credits: Number(e.target.value) }))
                  }
                />
              </div>
              <div>
                <Label>Галерея 8</Label>
                <Input
                  className={INPUT_CLS}
                  type="number"
                  min={1}
                  value={draft.gallery8Credits}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, gallery8Credits: Number(e.target.value) }))
                  }
                />
              </div>
              <div>
                <Label>Premium стиль (×)</Label>
                <Input
                  className={INPUT_CLS}
                  type="number"
                  min={1}
                  max={5}
                  step={0.05}
                  value={draft.multipliers.premiumStyle}
                  onChange={(e) =>
                    setDraft((d) => ({
                      ...d,
                      multipliers: {
                        ...d.multipliers,
                        premiumStyle: Number(e.target.value),
                      },
                    }))
                  }
                />
              </div>
              <div>
                <Label>Много текста / инфографика (×)</Label>
                <Input
                  className={INPUT_CLS}
                  type="number"
                  min={1}
                  max={5}
                  step={0.05}
                  value={draft.multipliers.heavyTextInfographic}
                  onChange={(e) =>
                    setDraft((d) => ({
                      ...d,
                      multipliers: {
                        ...d.multipliers,
                        heavyTextInfographic: Number(e.target.value),
                      },
                    }))
                  }
                />
              </div>
            </div>
          ) : (
            <div className="grid gap-2 text-sm sm:grid-cols-2">
              <p>План: <strong>{saved.planCredits}</strong></p>
              <p>1 слайд: <strong>{saved.singleSlideCredits}</strong> ток.</p>
              <p>Галерея 6: <strong>{saved.gallery6Credits}</strong> ток.</p>
              <p>Галерея 8: <strong>{saved.gallery8Credits}</strong> ток.</p>
              <p>Premium × <strong>{saved.multipliers.premiumStyle}</strong></p>
              <p>Heavy × <strong>{saved.multipliers.heavyTextInfographic}</strong></p>
            </div>
          )}

          <div className="space-y-1">
            <p className="text-sm font-medium">Preview (до сохранения — черновик)</p>
            <ul className="text-muted-foreground space-y-1 text-xs">
              {preview.map((line) => (
                <li key={line.label}>
                  <strong className="text-foreground">{line.credits} ток.</strong> — {line.label}:{" "}
                  <span className="font-mono">{line.formula}</span>
                </li>
              ))}
            </ul>
          </div>

          {editing ? (
            <div className="flex flex-wrap gap-2">
              <Button type="button" disabled={loading} onClick={() => void save()}>
                {loading ? <Loader2 className="size-4 animate-spin" /> : "Сохранить"}
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={loading}
                onClick={() => {
                  setDraft(saved);
                  setEditing(false);
                }}
              >
                Отменить
              </Button>
              <Button
                type="button"
                variant="ghost"
                disabled={loading}
                onClick={() => void resetDefault()}
              >
                Сбросить к default
              </Button>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <AdminCardBuilderPricingCalculator key={JSON.stringify(saved)} />
    </div>
  );
}
