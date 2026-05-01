"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { isRecord, type CalculatedPricingRow, type PerSecondMotionPreviewRow } from "@/lib/model-pricing-shared";
import { adminTerm } from "@/lib/admin-terms";
import { cn } from "@/lib/utils";

type StudioModel = {
  id: string;
  name: string;
  slug: string;
  apiModelId: string;
  provider: string;
  type: string;
  costCredits: number;
  pricingSchema: unknown;
};

type PreviewResponse = {
  rows: CalculatedPricingRow[] | PerSecondMotionPreviewRow[];
  summary: { minTokens: number; maxTokens: number; avgMarginPercent: number };
  pricingSchema?: Record<string, unknown>;
  previewKind?: "matrix" | "per_second";
};

function cloneSchema(v: unknown): Record<string, unknown> {
  if (!isRecord(v)) {
    return {};
  }
  return JSON.parse(JSON.stringify(v)) as Record<string, unknown>;
}

function asNum(s: string, fallback: number): number {
  const n = Number.parseFloat(s.replace(",", "."));
  if (!Number.isFinite(n)) return fallback;
  return n;
}

type Props = {
  model: StudioModel;
  canEdit: boolean;
};

export function ModelPricingStudio({ model, canEdit }: Props) {
  const [schema, setSchema] = useState<Record<string, unknown>>(() =>
    cloneSchema(model.pricingSchema),
  );
  const [rows, setRows] = useState<CalculatedPricingRow[] | null>(null);
  const [perSecondRows, setPerSecondRows] = useState<PerSecondMotionPreviewRow[] | null>(
    null,
  );
  const [summary, setSummary] = useState<PreviewResponse["summary"] | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const isMatrix = String(schema.type) === "matrix";
  const isPerSecond = String(schema.type) === "per_second";

  const setGlobal = useCallback(
    (key: string, v: string, parse: (s: string) => unknown) => {
      if (!canEdit) return;
      setSchema((s) => {
        const n = { ...s };
        n[key] = parse(v) as never;
        return n;
      });
    },
    [canEdit],
  );

  const runPreview = useCallback(
    async (recalculate: boolean) => {
      setError(null);
      setMessage(null);
      setLoading(true);
      try {
        const r = await fetch(
          `/api/admin/models/${model.id}/pricing/preview`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              pricingSchema: schema,
              recalculate,
            }),
          },
        );
        const data = (await r.json().catch(() => ({}))) as PreviewResponse & {
          error?: string;
        };
        if (!r.ok) {
          setError(data.error ?? "Ошибка предпросмотра");
          setRows(null);
          setPerSecondRows(null);
          setSummary(null);
          return;
        }
        if (data.pricingSchema && isRecord(data.pricingSchema)) {
          setSchema(data.pricingSchema);
        }
        if (data.previewKind === "per_second") {
          setPerSecondRows((data.rows ?? []) as PerSecondMotionPreviewRow[]);
          setRows(null);
        } else {
          setRows((data.rows ?? []) as CalculatedPricingRow[]);
          setPerSecondRows(null);
        }
        setSummary(data.summary ?? null);
        if (!recalculate) {
          setMessage("Предпросмотр обновлён.");
        } else {
          setMessage("Матрица пересчитана (manualOverrides сохранены).");
        }
      } catch {
        setError("Сеть недоступна");
      } finally {
        setLoading(false);
      }
    },
    [model.id, schema],
  );

  useEffect(() => {
    if (!isMatrix && !isPerSecond) return;
    const ac = new AbortController();
    void (async () => {
      setLoading(true);
      try {
        const r = await fetch(
          `/api/admin/models/${model.id}/pricing/preview`,
          {
            method: "POST",
            signal: ac.signal,
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              pricingSchema: schema,
              recalculate: false,
            }),
          },
        );
        const data = (await r.json().catch(() => ({}))) as PreviewResponse;
        if (!r.ok || !data.rows) return;
        if (data.pricingSchema && isRecord(data.pricingSchema)) {
          setSchema(data.pricingSchema);
        }
        if (data.previewKind === "per_second") {
          setPerSecondRows(data.rows as PerSecondMotionPreviewRow[]);
          setRows(null);
        } else {
          setRows(data.rows as CalculatedPricingRow[]);
          setPerSecondRows(null);
        }
        setSummary(data.summary ?? null);
      } catch {
        /* прервано или сеть */
      } finally {
        setLoading(false);
      }
    })();
    return () => ac.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- стартовая подгрузка 1 раз от props
  }, [model.id]);

  const save = useCallback(async () => {
    if (!canEdit) return;
    setError(null);
    setMessage(null);
    setLoading(true);
    try {
      const r = await fetch(`/api/admin/models/${model.id}/pricing`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pricingSchema: schema }),
      });
      const data = (await r.json().catch(() => ({}))) as { error?: string };
      if (!r.ok) {
        setError(data.error ?? "Ошибка сохранения");
        return;
      }
      setMessage("Сохранено.");
    } catch {
      setError("Сеть недоступна");
    } finally {
      setLoading(false);
    }
  }, [canEdit, model.id, schema]);

  const resetManual = useCallback(async () => {
    if (!canEdit || !isMatrix) return;
    if (
      !window.confirm(
        "Сбросить все ручные значения токенов? matrix и videoInputMatrix пересчитаются по формуле. Сохраните, чтобы применить в БД.",
      )
    ) {
      return;
    }
    setError(null);
    setMessage(null);
    setLoading(true);
    const cleared = {
      ...schema,
      manualOverrides: { matrix: {}, videoInputMatrix: {} },
    };
    setSchema(cleared);
    try {
      const r = await fetch(
        `/api/admin/models/${model.id}/pricing/preview`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            pricingSchema: cleared,
            recalculate: true,
          }),
        },
      );
      const data = (await r.json().catch(() => ({}))) as PreviewResponse & {
        error?: string;
      };
      if (!r.ok) {
        setError(data.error ?? "Ошибка пересчёта");
        return;
      }
      if (data.pricingSchema && isRecord(data.pricingSchema)) {
        setSchema(data.pricingSchema);
      }
      if (data.previewKind === "per_second") {
        setPerSecondRows((data.rows ?? []) as PerSecondMotionPreviewRow[]);
        setRows(null);
      } else {
        setRows((data.rows ?? []) as CalculatedPricingRow[]);
        setPerSecondRows(null);
      }
      setSummary(data.summary ?? null);
      setMessage("Ручные значения сброены, матрица пересчитана. Сохраните, чтобы применить.");
    } catch {
      setError("Сеть недоступна");
    } finally {
      setLoading(false);
    }
  }, [canEdit, model.id, schema, isMatrix]);

  const inputLabel = useCallback((row: CalculatedPricingRow) => {
    if (row.inputType === "noVideo") return "matrix";
    if (row.inputType === "withVideo") return "videoInputMatrix";
    return row.inputType;
  }, []);

  const onEditProvider = useCallback(
    (
      inputType: "noVideo" | "withVideo",
      resolution: string,
      field: "kieCreditsPerSecond" | "usdPerSecond",
      raw: string,
    ) => {
      if (!canEdit) return;
      const key = inputType === "noVideo" ? "noVideo" : "withVideo";
      setSchema((s) => {
        const n = { ...s };
        const pc = isRecord(n.providerCost) ? { ...n.providerCost } : {};
        const br = isRecord(pc[key]) ? { ...pc[key] } : {};
        const cell = isRecord(br[resolution]) ? { ...br[resolution] } : {};
        const val =
          field === "kieCreditsPerSecond"
            ? asNum(raw, 0)
            : asNum(raw, 0);
        (cell as Record<string, number>)[field] = val;
        br[resolution] = cell;
        pc[key] = br;
        n.providerCost = pc;
        return n;
      });
    },
    [canEdit],
  );

  const onEditManual = useCallback(
    (
      matrixKey: string,
      resolution: string,
      duration: number,
      raw: string,
    ) => {
      if (!canEdit) return;
      const trimmed = raw.trim();
      setSchema((s) => {
        const n = { ...s };
        const mo = (isRecord(n.manualOverrides)
          ? { ...n.manualOverrides }
          : { matrix: {}, videoInputMatrix: {} }) as Record<string, unknown>;
        const branch = mo[matrixKey];
        const b = isRecord(branch) ? { ...branch } : {};
        const prevRow = b[resolution];
        const row = isRecord(prevRow) ? { ...prevRow } : {};
        if (trimmed === "") {
          delete row[String(duration)];
        } else {
          const v = Math.max(0, Math.floor(asNum(trimmed, 0)));
          row[String(duration)] = v;
        }
        b[resolution] = row;
        mo[matrixKey] = b;
        n.manualOverrides = mo;
        return n;
      });
    },
    [canEdit],
  );

  const fmt = (n: number, d = 2) =>
    Number.isFinite(n) ? n.toFixed(d) : "—";

  const warnings = useMemo(() => {
    if (!rows?.length) return [] as string[];
    const w: string[] = [];
    for (const r of rows) {
      if (r.marginKzt < 0) {
        w.push("Маржа отрицательная (есть строки).");
        break;
      }
    }
    for (const r of rows) {
      if (r.finalClientTokens === 0) {
        w.push("Клиентская цена равна 0 (есть строки).");
        break;
      }
    }
    return w;
  }, [rows]);

  if (!isMatrix && !isPerSecond) {
    return (
      <Alert>
        <AlertTitle>Pricing Studio</AlertTitle>
        <AlertDescription>
          Для этой модели <code>pricingSchema.type</code> не <code>matrix</code> и не{" "}
          <code>per_second</code> — таблицу предпросмотра не показываем. Рабочие цены остаются в{" "}
          {adminTerm("pricingSchema")} в БД.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      {!canEdit ? (
        <Alert>
          <AlertTitle>Просмотр</AlertTitle>
          <AlertDescription>
            Изменение цен доступно только роли SUPER_ADMIN. Вы можете
            просматривать и использовать предпросмотр.
          </AlertDescription>
        </Alert>
      ) : null}
      <div className="space-y-3 rounded-lg border p-4">
        <h3 className="text-foreground text-sm font-medium">Пояснения</h3>
        <ul className="text-muted-foreground space-y-2 text-xs leading-relaxed">
          <li>
            <strong className="text-foreground">{adminTerm("kieCreditsPerSecond")}</strong>{" "}
            — сколько Kie.ai списывает за одну секунду генерации.
          </li>
          <li>
            <strong className="text-foreground">{adminTerm("usdPerSecond")}</strong> —{" "}
            себестоимость генерации у Kie.ai в долларах за секунду.
          </li>
          <li>
            <strong className="text-foreground">{adminTerm("providerCost")}</strong> —{" "}
            реальные расходы сервиса на генерацию.
          </li>
          <li>
            <strong className="text-foreground">{adminTerm("tokenValueKzt")}</strong>{" "}
            — сколько тенге мы считаем за 1 внутренний токен QazCard AI.
          </li>
          <li>
            <strong className="text-foreground">{adminTerm("markupPercent")}</strong> —{" "}
            процент наценки поверх себестоимости.
          </li>
          <li>
            <strong className="text-foreground">{adminTerm("autoClientTokens")}</strong> —{" "}
            количество токенов, рассчитанное автоматически по курсу, себестоимости и
            наценке.
          </li>
          <li>
            <strong className="text-foreground">{adminTerm("manualClientTokens")}</strong> —{" "}
            значение, которое SUPER_ADMIN может задать вручную. Оно имеет приоритет над
            автоматическим расчётом.
          </li>
          <li>
            <strong className="text-foreground">{adminTerm("finalClientTokens")}</strong> —{" "}
            сколько токенов реально будет списано у пользователя.
          </li>
          <li>
            <strong className="text-foreground">{adminTerm("estimate")}</strong> и
            фактическое списание используют те же значения, что и{" "}
            <strong className="text-foreground">{adminTerm("finalClientTokens")}</strong>.
          </li>
          <li>
            <strong className="text-foreground">Margin / Маржа</strong> — разница между
            ценой клиента и себестоимостью провайдера.
          </li>
        </ul>
      </div>

      <div className="grid gap-2 rounded-lg border p-4 text-sm">
        <h3 className="text-foreground font-medium">Сводка модели</h3>
        <p>
          <span className="text-muted-foreground">Название:</span> {model.name}
        </p>
        <p>
          <span className="text-muted-foreground">slug:</span>{" "}
          <span className="font-mono">{model.slug}</span>
        </p>
        <p>
          <span className="text-muted-foreground">{adminTerm("apiModelId")}:</span>{" "}
          <span className="font-mono">{model.apiModelId}</span>
        </p>
        <p>
          <span className="text-muted-foreground">{adminTerm("provider")}:</span>{" "}
          {model.provider}
        </p>
        <p>
          <span className="text-muted-foreground">type:</span> {model.type}
        </p>
        <p>
          <span className="text-muted-foreground">{adminTerm("pricingSource")}:</span>{" "}
          {String(schema.pricingSource ?? "—")}
        </p>
        <p>
          <span className="text-muted-foreground">pricingSchema.type:</span>{" "}
          {String(schema.type)}
        </p>
        <p>
          <span className="text-muted-foreground">
            {adminTerm("internalTokenValueKzt")}:
          </span>{" "}
          {String(schema.internalTokenValueKzt ?? "—")}
        </p>
        <p>
          <span className="text-muted-foreground">{adminTerm("usdToKzt")}:</span>{" "}
          {String(schema.usdToKzt ?? "—")}
        </p>
        <p>
          <span className="text-muted-foreground">{adminTerm("markupPercent")}:</span>{" "}
          {String(schema.markupPercent ?? "—")}
        </p>
        <p>
          <span className="text-muted-foreground">{adminTerm("defaultCredits")}:</span>{" "}
          {String(schema.defaultCredits ?? "—")}
        </p>
        <p>
          <span className="text-muted-foreground">{adminTerm("fallbackCredits")}:</span>{" "}
          {String(schema.fallbackCredits ?? "—")}
        </p>
        <p>
          <span className="text-muted-foreground">
            {adminTerm("costCredits")} (fallback, модель):
          </span>{" "}
          {model.costCredits}
        </p>
        <p className="text-muted-foreground border-t pt-2">
          Итоговая цена, которую списываем с пользователя, определяется{" "}
          <strong className="text-foreground">{adminTerm("finalClientTokens")}</strong>.
          Ручное значение ({adminTerm("manualClientTokens")}) имеет приоритет над
          автоматическим расчётом.
        </p>
      </div>

      <div className="space-y-2 rounded-lg border p-4">
        <h3 className="text-foreground text-sm font-medium">Формула (справка)</h3>
        <ul className="text-muted-foreground list-inside list-disc space-y-1 text-xs">
          <li>
            {adminTerm("kieCreditsTotal")} = {adminTerm("kieCreditsPerSecond")} ×
            duration (сек.)
          </li>
          <li>Provider USD cost = {adminTerm("usdPerSecond")} × duration</li>
          <li>Provider KZT cost = Provider USD cost × {adminTerm("usdToKzt")}</li>
          <li>
            Client KZT (до токенов) = Provider KZT × (1 + {adminTerm("markupPercent")})
          </li>
          <li>Auto tokens = ceil(Client KZT / token value in ₸)</li>
          <li>
            {adminTerm("finalClientTokens")} = {adminTerm("manualClientTokens")} или auto
          </li>
          <li>
            {adminTerm("marginKzt")} = {adminTerm("finalClientTokens")} × token value −
            Provider KZT
          </li>
          <li>
            {adminTerm("marginPercent")} = {adminTerm("marginKzt")} / Provider KZT × 100
          </li>
        </ul>
      </div>

      <section className="space-y-3">
        <h3 className="text-foreground text-sm font-medium">Глобальные поля</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label className="text-xs leading-snug">
              {adminTerm("usdToKzt")} (поле usdToKzt)
            </Label>
            <Input
              type="number"
              min={0.0001}
              step="any"
              readOnly={!canEdit}
              value={
                schema.usdToKzt != null && typeof schema.usdToKzt === "number"
                  ? String(schema.usdToKzt)
                  : ""
              }
              onChange={(e) =>
                setGlobal("usdToKzt", e.target.value, (t) => asNum(t, 500))
              }
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs leading-snug">
              {adminTerm("internalTokenValueKzt")}
            </Label>
            <Input
              type="number"
              min={0.0001}
              step="any"
              readOnly={!canEdit}
              value={
                schema.internalTokenValueKzt != null &&
                typeof schema.internalTokenValueKzt === "number"
                  ? String(schema.internalTokenValueKzt)
                  : ""
              }
              onChange={(e) =>
                setGlobal("internalTokenValueKzt", e.target.value, (t) =>
                  asNum(t, 10),
                )
              }
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs leading-snug">{adminTerm("markupPercent")}</Label>
            <Input
              type="number"
              min={0}
              step="any"
              readOnly={!canEdit}
              value={
                schema.markupPercent != null &&
                typeof schema.markupPercent === "number"
                  ? String(schema.markupPercent)
                  : ""
              }
              onChange={(e) =>
                setGlobal("markupPercent", e.target.value, (t) => asNum(t, 0))
              }
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs leading-snug">{adminTerm("defaultCredits")}</Label>
            <Input
              type="number"
              min={0}
              step={1}
              readOnly={!canEdit}
              value={
                schema.defaultCredits != null &&
                typeof schema.defaultCredits === "number"
                  ? String(schema.defaultCredits)
                  : ""
              }
              onChange={(e) =>
                setGlobal("defaultCredits", e.target.value, (t) =>
                  Math.max(0, Math.floor(asNum(t, 0))),
                )
              }
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs leading-snug">{adminTerm("fallbackCredits")}</Label>
            <Input
              type="number"
              min={0}
              step={1}
              readOnly={!canEdit}
              value={
                schema.fallbackCredits != null &&
                typeof schema.fallbackCredits === "number"
                  ? String(schema.fallbackCredits)
                  : ""
              }
              onChange={(e) =>
                setGlobal("fallbackCredits", e.target.value, (t) =>
                  Math.max(0, Math.floor(asNum(t, 0))),
                )
              }
            />
          </div>
        </div>
      </section>

      {error ? (
        <Alert variant="destructive">
          <AlertTitle>Ошибка</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
      {message ? (
        <Alert>
          <AlertTitle>Действие</AlertTitle>
          <AlertDescription>{message}</AlertDescription>
        </Alert>
      ) : null}
      {warnings.map((w) => (
        <Alert key={w} variant="destructive">
          <AlertTitle>Предупреждение</AlertTitle>
          <AlertDescription>{w}</AlertDescription>
        </Alert>
      ))}

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className={cn(buttonVariants())}
          disabled={loading}
          onClick={() => void runPreview(false)}
        >
          Предпросмотр
        </button>
        <button
          type="button"
          className={cn(buttonVariants())}
          disabled={loading || !isMatrix}
          onClick={() => void runPreview(true)}
        >
          Пересчитать
        </button>
        {canEdit ? (
          <button
            type="button"
            className={cn(buttonVariants())}
            disabled={loading}
            onClick={() => void save()}
          >
            Сохранить цены
          </button>
        ) : null}
        {canEdit ? (
          <button
            type="button"
            className={cn(buttonVariants({ variant: "outline" }))}
            disabled={loading}
            onClick={() => void resetManual()}
          >
            Сбросить ручные значения
          </button>
        ) : null}
      </div>

      {summary ? (
        <p className="text-muted-foreground text-xs">
          min tokens: {summary.minTokens}, max: {summary.maxTokens}, ср. маржа %:{" "}
          {summary.avgMarginPercent}
        </p>
      ) : null}

      {isMatrix && rows && rows.length > 0 ? (
        <Table className="min-w-[1780px] table-fixed">
          <TableHeader>
            <TableRow>
              <TableHead className="w-[220px] whitespace-normal break-words py-3 align-top text-xs leading-snug">
                {adminTerm("psTableInput")}
              </TableHead>
              <TableHead className="w-[140px] whitespace-normal break-words py-3 align-top text-xs leading-snug">
                {adminTerm("psTableResolution")}
              </TableHead>
              <TableHead className="w-[110px] whitespace-normal break-words py-3 align-top text-xs leading-snug">
                {adminTerm("psTableDuration")}
              </TableHead>
              <TableHead className="w-[140px] whitespace-normal break-words py-3 align-top text-xs leading-snug">
                {adminTerm("kieCreditsPerSecond")}
              </TableHead>
              <TableHead className="w-[140px] whitespace-normal break-words py-3 align-top text-xs leading-snug">
                {adminTerm("kieCreditsTotal")}
              </TableHead>
              <TableHead className="w-[140px] whitespace-normal break-words py-3 align-top text-xs leading-snug">
                {adminTerm("usdPerSecond")}
              </TableHead>
              <TableHead className="w-[140px] whitespace-normal break-words py-3 align-top text-xs leading-snug">
                {adminTerm("providerUsdTotal")}
              </TableHead>
              <TableHead className="w-[140px] whitespace-normal break-words py-3 align-top text-xs leading-snug">
                {adminTerm("providerKztTotal")}
              </TableHead>
              <TableHead className="w-[110px] whitespace-normal break-words py-3 align-top text-xs leading-snug">
                {adminTerm("markupPercent")}
              </TableHead>
              <TableHead className="w-[140px] whitespace-normal break-words py-3 align-top text-xs leading-snug">
                {adminTerm("autoClientTokens")}
              </TableHead>
              <TableHead className="w-[150px] whitespace-normal break-words py-3 align-top text-xs leading-snug">
                {adminTerm("manualClientTokens")}
              </TableHead>
              <TableHead className="w-[150px] whitespace-normal break-words py-3 align-top text-xs leading-snug">
                {adminTerm("finalClientTokens")}
              </TableHead>
              <TableHead className="w-[130px] whitespace-normal break-words py-3 align-top text-xs leading-snug">
                {adminTerm("clientKztPrice")}
              </TableHead>
              <TableHead className="w-[120px] whitespace-normal break-words py-3 align-top text-xs leading-snug">
                {adminTerm("marginKzt")}
              </TableHead>
              <TableHead className="w-[120px] whitespace-normal break-words py-3 align-top text-xs leading-snug">
                {adminTerm("marginPercent")}
              </TableHead>
              <TableHead className="w-[130px] whitespace-normal break-words py-3 align-top text-xs leading-snug">
                {adminTerm("psTableMarginBadge")}
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row, i) => (
              <TableRow key={`${row.matrixKey}-${row.resolution}-${row.duration}-${row.inputType}-${i}`}>
                <TableCell className="whitespace-normal break-words text-xs leading-snug">
                  {inputLabel(row)}
                </TableCell>
                <TableCell className="whitespace-normal break-words font-mono text-xs">
                  {row.resolution}
                </TableCell>
                <TableCell className="text-xs">{row.duration}</TableCell>
                <TableCell>
                  {isRecord(schema.providerCost) &&
                  isRecord(
                    schema.providerCost[
                      row.inputType === "noVideo" ? "noVideo" : "withVideo"
                    ],
                  ) ? (
                    <Input
                      className="h-8 w-20 font-mono text-xs"
                      readOnly={!canEdit}
                      defaultValue={String(row.kieCreditsPerSecond)}
                      key={`kie-${i}-${row.kieCreditsPerSecond}`}
                      onBlur={(e) =>
                        onEditProvider(
                          row.inputType === "noVideo" ? "noVideo" : "withVideo",
                          row.resolution,
                          "kieCreditsPerSecond",
                          e.target.value,
                        )
                      }
                    />
                  ) : (
                    fmt(row.kieCreditsPerSecond, 2)
                  )}
                </TableCell>
                <TableCell className="text-xs">{row.kieCreditsTotal}</TableCell>
                <TableCell>
                  {isRecord(schema.providerCost) ? (
                    <Input
                      className="h-8 w-20 font-mono text-xs"
                      readOnly={!canEdit}
                      defaultValue={String(row.usdPerSecond)}
                      key={`usd-${i}-${row.usdPerSecond}`}
                      onBlur={(e) =>
                        onEditProvider(
                          row.inputType === "noVideo" ? "noVideo" : "withVideo",
                          row.resolution,
                          "usdPerSecond",
                          e.target.value,
                        )
                      }
                    />
                  ) : (
                    fmt(row.usdPerSecond, 4)
                  )}
                </TableCell>
                <TableCell className="text-xs">
                  {fmt(row.providerUsdTotal, 3)}
                </TableCell>
                <TableCell className="text-xs">
                  {fmt(row.providerKztTotal, 1)}
                </TableCell>
                <TableCell className="text-xs">{row.markupPercent}</TableCell>
                <TableCell className="text-xs">{row.autoClientTokens}</TableCell>
                <TableCell>
                  <Input
                    className="h-8 w-16 font-mono text-xs"
                    readOnly={!canEdit}
                    defaultValue={
                      row.manualClientTokens == null
                        ? ""
                        : String(row.manualClientTokens)
                    }
                    key={`man-${i}-${row.manualClientTokens}`}
                    onBlur={(e) =>
                      onEditManual(
                        row.matrixKey,
                        row.resolution,
                        row.duration,
                        e.target.value,
                      )
                    }
                    placeholder="—"
                  />
                </TableCell>
                <TableCell className="font-medium">{row.finalClientTokens}</TableCell>
                <TableCell className="text-xs">
                  {fmt(row.clientKztPrice, 0)}
                </TableCell>
                <TableCell className="text-xs">{fmt(row.marginKzt, 1)}</TableCell>
                <TableCell>
                  <span
                    className={cn(
                      "rounded px-1.5 py-0.5 text-xs",
                      row.isManual
                        ? "bg-amber-500/15 text-amber-800 dark:text-amber-200"
                        : "bg-emerald-500/15 text-emerald-800 dark:text-emerald-200",
                    )}
                  >
                    {row.isManual ? "Ручная цена" : "Авто"}
                  </span>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      ) : isPerSecond && perSecondRows && perSecondRows.length > 0 ? (
        <Table className="min-w-[980px] table-fixed">
          <TableHeader>
            <TableRow>
              <TableHead className="w-[120px] whitespace-normal py-3 align-top text-xs leading-snug">Разрешение</TableHead>
              <TableHead className="w-[130px] whitespace-normal py-3 align-top text-xs leading-snug">Kie credits/s</TableHead>
              <TableHead className="w-[110px] whitespace-normal py-3 align-top text-xs leading-snug">USD/s</TableHead>
              <TableHead className="w-[150px] whitespace-normal py-3 align-top text-xs leading-snug">Авто токенов/s</TableHead>
              <TableHead className="w-[150px] whitespace-normal py-3 align-top text-xs leading-snug">Ручные токенов/s</TableHead>
              <TableHead className="w-[110px] whitespace-normal py-3 align-top text-xs leading-snug">Пример 5 с</TableHead>
              <TableHead className="w-[110px] whitespace-normal py-3 align-top text-xs leading-snug">Пример 10 с</TableHead>
              <TableHead className="w-[100px] whitespace-normal py-3 align-top text-xs leading-snug">Маржа % (≈)</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {perSecondRows.map((row) => (
              <TableRow key={row.resolution}>
                <TableCell className="font-mono text-xs">{row.resolution}</TableCell>
                <TableCell className="text-xs">{fmt(row.kieCreditsPerSecond, 2)}</TableCell>
                <TableCell className="text-xs">{fmt(row.usdPerSecond, 4)}</TableCell>
                <TableCell className="text-xs">{fmt(row.autoTokensPerSecond, 4)}</TableCell>
                <TableCell className="text-xs">
                  {row.manualTokensPerSecond != null ? row.manualTokensPerSecond : "—"}
                </TableCell>
                <TableCell className="font-medium">{row.example5SecTokens}</TableCell>
                <TableCell className="font-medium">{row.example10SecTokens}</TableCell>
                <TableCell className="text-xs">{fmt(row.marginPercentApprox, 2)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      ) : (
        <p className="text-muted-foreground text-sm">
          Нажмите «Предпросмотр» — таблица строится на сервере по{" "}
          <span className="font-medium text-foreground">
            {adminTerm("providerCostSchema")}
          </span>{" "}
          и{" "}
          <span className="font-medium text-foreground">{adminTerm("manualOverrides")}</span>
          .
        </p>
      )}
    </div>
  );
}
