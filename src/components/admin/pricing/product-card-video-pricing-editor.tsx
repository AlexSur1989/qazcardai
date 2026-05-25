"use client";

import { useCallback, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

import {
  buildProductCardVideoFormulaText,
  productCardVideoPricingSoftWarnings,
  type ProductCardVideoMatrixCell,
  type ProductCardVideoMatrixCellPreview,
  type ProductCardVideoPricingApi,
} from "@/lib/pricing-admin/product-card-video";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type Props = {
  initialPricing: ProductCardVideoPricingApi | null;
  initialFormula: string;
  initialCellPreviews: ProductCardVideoMatrixCellPreview[];
  canEdit: boolean;
};

function formatDurationLabel(seconds: number): string {
  return `${seconds} секунд`;
}

function formatResolutionLabel(resolution: string): string {
  return resolution;
}

function cellKey(duration: number, resolution: string): string {
  return `${duration}|${resolution}`;
}

export function ProductCardVideoPricingEditor({
  initialPricing,
  initialFormula,
  initialCellPreviews,
  canEdit,
}: Props) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<ProductCardVideoMatrixCell[]>(
    initialPricing?.matrix ?? [],
  );
  const [saved, setSaved] = useState<ProductCardVideoMatrixCell[]>(
    initialPricing?.matrix ?? [],
  );
  const [pricingMeta, setPricingMeta] = useState(initialPricing);
  const [formula, setFormula] = useState(initialFormula);
  const cellPreviews = initialCellPreviews;
  const [previewCellKey, setPreviewCellKey] = useState<string | null>(
    initialCellPreviews[0]
      ? cellKey(initialCellPreviews[0].duration, initialCellPreviews[0].resolution)
      : null,
  );
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);

  const durationOptions = pricingMeta?.durationOptions ?? [5, 10];
  const resolutionOptions = pricingMeta?.resolutionOptions ?? ["720p", "1080p"];

  const draftMap = useMemo(() => {
    const m = new Map<string, number>();
    for (const c of draft) {
      m.set(cellKey(c.duration, c.resolution), c.credits);
    }
    return m;
  }, [draft]);

  const localPreviews = useMemo(() => {
    if (!pricingMeta) return [];
    return cellPreviews.map((p) => {
      const credits = draftMap.get(cellKey(p.duration, p.resolution)) ?? p.credits;
      const finalCredits = Math.max(pricingMeta.minVideoTokens, credits);
      return { ...p, credits, matrixPrice: credits, finalCredits };
    });
  }, [cellPreviews, draftMap, pricingMeta]);

  const softWarnings = useMemo(() => {
    if (!pricingMeta) return ["Модель видео товара не найдена."];
    return productCardVideoPricingSoftWarnings({
      cells: localPreviews,
      minVideoTokens: pricingMeta.minVideoTokens,
      durationOptions,
      resolutionOptions,
      modelFound: true,
      modelActive: pricingMeta.isActive,
      multipleActiveModels: false,
      resolverModelSlug: pricingMeta.modelSlug,
    });
  }, [localPreviews, pricingMeta, durationOptions, resolutionOptions]);

  const previewCell = localPreviews.find(
    (p) => cellKey(p.duration, p.resolution) === previewCellKey,
  );

  const updateCell = (duration: number, resolution: string, value: string) => {
    const n = Number.parseInt(value, 10);
    const credits = Number.isFinite(n) ? n : 0;
    setDraft((prev) => {
      const next = [...prev];
      const idx = next.findIndex((c) => c.duration === duration && c.resolution === resolution);
      if (idx >= 0) {
        next[idx] = { duration, resolution, credits };
      } else {
        next.push({ duration, resolution, credits });
      }
      return next;
    });
  };

  const save = useCallback(async () => {
    if (!pricingMeta) return;
    setLoading(true);
    setErr(null);
    setOkMsg(null);
    try {
      const res = await fetch("/api/admin/pricing/product-card-video", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ modelId: pricingMeta.modelId, matrix: draft }),
      });
      const data = (await res.json()) as {
        error?: string;
        pricing?: ProductCardVideoPricingApi;
        formula?: string;
        cellPreviews?: ProductCardVideoMatrixCellPreview[];
      };
      if (!res.ok) {
        setErr(data.error ?? `Ошибка ${res.status}`);
        return;
      }
      if (data.pricing) {
        setPricingMeta(data.pricing);
        setSaved(data.pricing.matrix);
        setDraft(data.pricing.matrix);
        setFormula(
          data.formula ??
            buildProductCardVideoFormulaText({
              hasMultipliers: data.pricing.hasMultipliers,
              minVideoTokens: data.pricing.minVideoTokens,
            }),
        );
      }
      setOkMsg("Матрица сохранена");
      setEditing(false);
      router.refresh();
    } catch {
      setErr("Сеть: не удалось сохранить");
    } finally {
      setLoading(false);
    }
  }, [draft, pricingMeta, router]);

  const resetCurrent = useCallback(async () => {
    if (!pricingMeta) return;
    setLoading(true);
    setErr(null);
    try {
      const res = await fetch("/api/admin/pricing/product-card-video?action=reset-current", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ modelId: pricingMeta.modelId }),
      });
      const data = (await res.json()) as {
        error?: string;
        pricing?: ProductCardVideoPricingApi;
        formula?: string;
      };
      if (!res.ok) {
        setErr(data.error ?? `Ошибка ${res.status}`);
        return;
      }
      if (data.pricing) {
        setPricingMeta(data.pricing);
        setDraft(data.pricing.matrix);
        setSaved(data.pricing.matrix);
        setFormula(data.formula ?? initialFormula);
      }
      setEditing(false);
      setOkMsg("Отменено — загружены текущие значения из БД");
      router.refresh();
    } catch {
      setErr("Сеть: не удалось сбросить");
    } finally {
      setLoading(false);
    }
  }, [initialFormula, pricingMeta, router]);

  const cancelEdit = () => {
    setDraft(saved);
    setEditing(false);
    setErr(null);
  };

  if (!pricingMeta) {
    return (
      <Alert variant="destructive">
        <AlertTitle>Модель не найдена</AlertTitle>
        <AlertDescription>
          Активная модель PRODUCT_VIDEO не настроена. Проверьте seed и slug в настройках Product
          Card.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Видео товара</CardTitle>
        <CardDescription>Цена по длительности и качеству (Product Card video)</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid gap-2 text-sm sm:grid-cols-2">
          <p>
            Модель: <strong>{pricingMeta.modelName}</strong>
          </p>
          <p>
            Статус:{" "}
            <Badge variant={pricingMeta.isActive ? "default" : "secondary"}>
              {pricingMeta.isActive ? "Активна" : "Не активна"}
            </Badge>
          </p>
          <p>
            Источник цены:{" "}
            <span className="text-muted-foreground">product_card_matrix модели PRODUCT_VIDEO</span>
          </p>
          <p>
            Мин. токенов видео: <strong>{pricingMeta.minVideoTokens}</strong>
          </p>
        </div>

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

        {softWarnings.length > 0 ? (
          <div className="space-y-2">
            {softWarnings.map((w) => (
              <Alert key={w} variant={w.includes("не найдена") ? "destructive" : "default"}>
                <AlertDescription>{w}</AlertDescription>
              </Alert>
            ))}
          </div>
        ) : null}

        <div>
          <h3 className="mb-2 text-sm font-medium">Матрица duration × resolution</h3>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Длительность</TableHead>
                  {resolutionOptions.map((res) => (
                    <TableHead key={res} className="text-right">
                      {formatResolutionLabel(res)}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {durationOptions.map((dur) => (
                  <TableRow key={dur}>
                    <TableCell>{formatDurationLabel(dur)}</TableCell>
                    {resolutionOptions.map((res) => {
                      const credits =
                        draftMap.get(cellKey(dur, res)) ??
                        localPreviews.find((p) => p.duration === dur && p.resolution === res)
                          ?.credits ??
                        0;
                      return (
                        <TableCell key={res} className="text-right">
                          {editing && canEdit ? (
                            <Input
                              type="number"
                              min={1}
                              className="ml-auto w-24 text-right tabular-nums"
                              value={credits}
                              onChange={(e) => updateCell(dur, res, e.target.value)}
                              onFocus={() => setPreviewCellKey(cellKey(dur, res))}
                            />
                          ) : (
                            <button
                              type="button"
                              className="tabular-nums hover:underline"
                              onClick={() => setPreviewCellKey(cellKey(dur, res))}
                            >
                              {credits}
                            </button>
                          )}
                        </TableCell>
                      );
                    })}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>

        <div className="rounded-md border p-4 text-sm">
          <p className="mb-2 font-medium">Формула</p>
          <pre className="text-muted-foreground whitespace-pre-wrap font-mono text-xs">{formula}</pre>
          {previewCell ? (
            <div className="mt-4 space-y-1 border-t pt-3">
              <p className="font-medium">Preview выбранной ячейки</p>
              <p>Duration: {previewCell.duration}s</p>
              <p>Resolution: {previewCell.resolution}</p>
              <p>Matrix price: {previewCell.matrixPrice} tokens</p>
              <p>Min video tokens: {pricingMeta.minVideoTokens}</p>
              <p>
                Final: <strong>{previewCell.finalCredits} tokens</strong>
              </p>
            </div>
          ) : null}
        </div>

        <details className="text-muted-foreground text-xs">
          <summary className="cursor-pointer">Технические детали</summary>
          <div className="mt-2 space-y-1 font-mono">
            <p>modelId: {pricingMeta.modelId}</p>
            <p>slug: {pricingMeta.modelSlug}</p>
            <p>productCardModelType: {pricingMeta.productCardModelType}</p>
            <p>pricingSchema.type: {pricingMeta.pricingSchemaType}</p>
            {localPreviews.map((p) => (
              <p key={cellKey(p.duration, p.resolution)}>
                {p.duration}s/{p.resolution} → key {p.matrixKey}
                {p.matchedKey ? ` (matched: ${p.matchedKey})` : ""}
              </p>
            ))}
          </div>
        </details>

        {canEdit ? (
          <div className="flex flex-wrap gap-2">
            {!editing ? (
              <Button type="button" onClick={() => setEditing(true)}>
                Редактировать
              </Button>
            ) : (
              <>
                <Button type="button" onClick={save} disabled={loading}>
                  {loading ? <Loader2 className="size-4 animate-spin" /> : "Сохранить"}
                </Button>
                <Button type="button" variant="outline" onClick={cancelEdit} disabled={loading}>
                  Отмена
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={resetCurrent}
                  disabled={loading}
                >
                  Сбросить к текущим
                </Button>
              </>
            )}
          </div>
        ) : (
          <p className="text-muted-foreground text-xs">Нет прав models.pricing.manage</p>
        )}
      </CardContent>
    </Card>
  );
}
