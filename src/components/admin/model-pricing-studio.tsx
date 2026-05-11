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
import { Textarea } from "@/components/ui/textarea";
import { ADMIN_PRICING_PINNED_KEY } from "@/lib/admin-pricing-pinned";
import { adminTerm } from "@/lib/admin-terms";
import {
  isRecord,
  type CalculatedPricingRow,
  type PerSecondMotionPreviewRow,
} from "@/lib/model-pricing-shared";
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

export type FormulaFixedPreviewRow = {
  label: string;
  settings?: Record<string, unknown>;
  credits: number;
};

type PreviewSummary = {
  minTokens: number;
  maxTokens: number;
  avgMarginPercent: number;
};

type PreviewResponse = {
  rows:
    | CalculatedPricingRow[]
    | PerSecondMotionPreviewRow[]
    | FormulaFixedPreviewRow[];
  summary: PreviewSummary;
  pricingSchema?: Record<string, unknown>;
  previewKind?: "matrix" | "per_second" | "formula" | "fixed" | "raw";
  unsupportedVisualType?: string;
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
  const [simpleRows, setSimpleRows] = useState<FormulaFixedPreviewRow[] | null>(
    null,
  );
  const [rawJsonDraft, setRawJsonDraft] = useState(() =>
    JSON.stringify(cloneSchema(model.pricingSchema), null, 2),
  );
  const [rawJsonError, setRawJsonError] = useState<string | null>(null);
  const [summary, setSummary] = useState<PreviewResponse["summary"] | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const isMatrix = String(schema.type) === "matrix";
  const isPerSecond = String(schema.type) === "per_second";
  const isFixed = String(schema.type) === "fixed";
  const isFormula = String(schema.type) === "formula";

  const knownVisualTypes = ["matrix", "per_second", "fixed", "formula"] as const;
  const typeStr = String(schema.type ?? "");
  const selectedPricingTypeOption = (
    knownVisualTypes as readonly string[]
  ).includes(typeStr)
    ? typeStr
    : "__custom";
  const isUnknownVisualType =
    selectedPricingTypeOption === "__custom" && Boolean(typeStr);

  function applyPricingType(next: (typeof knownVisualTypes)[number]): void {
    setSchema((s) => ({
      ...s,
      type: next,
      ...(next === "fixed"
        ? {
            credits:
              typeof s.credits === "number" ? s.credits : model.costCredits,
          }
        : {}),
      ...(next === "formula"
        ? {
            baseCredits:
              typeof s.baseCredits === "number"
                ? s.baseCredits
                : model.costCredits,
            rules: Array.isArray(s.rules) ? s.rules : [],
            round: typeof s.round === "string" ? s.round : "ceil",
          }
        : {}),
    }));
  }

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
          setSimpleRows(null);
          setSummary(null);
          return;
        }
        if (data.pricingSchema && isRecord(data.pricingSchema)) {
          setSchema(data.pricingSchema);
        }
        const kind = data.previewKind;
        if (kind === "per_second") {
          setPerSecondRows((data.rows ?? []) as PerSecondMotionPreviewRow[]);
          setRows(null);
          setSimpleRows(null);
        } else if (kind === "matrix") {
          setRows((data.rows ?? []) as CalculatedPricingRow[]);
          setPerSecondRows(null);
          setSimpleRows(null);
        } else if (kind === "formula" || kind === "fixed") {
          setSimpleRows((data.rows ?? []) as FormulaFixedPreviewRow[]);
          setRows(null);
          setPerSecondRows(null);
        } else {
          setRows(null);
          setPerSecondRows(null);
          setSimpleRows(null);
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
    // Сброс JSON-черновика при смене модели из БД (родитель меняет только model.id между страницами).
    // eslint-disable-next-line react-hooks/set-state-in-effect -- намеренная синхронизация при смене записи
    setRawJsonDraft(JSON.stringify(cloneSchema(model.pricingSchema), null, 2));
    setRawJsonError(null);
  // eslint-disable-next-line react-hooks/exhaustive-deps -- черновик сбрасываем только при смене model.id (другая запись админки)
  }, [model.id]);

  function applyPricingJsonDraft(): void {
    if (!canEdit) return;
    try {
      const parsed = JSON.parse(rawJsonDraft) as unknown;
      if (!isRecord(parsed)) {
        setRawJsonError("Корень JSON должен быть объектом.");
        return;
      }
      setRawJsonError(null);
      setSchema(parsed);
    } catch {
      setRawJsonError("Невалидный JSON pricingSchema.");
    }
  }

  useEffect(() => {
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
        if (!r.ok) return;
        if (data.pricingSchema && isRecord(data.pricingSchema)) {
          setSchema(data.pricingSchema);
        }
        const kind = data.previewKind;
        if (kind === "per_second") {
          setPerSecondRows(data.rows as PerSecondMotionPreviewRow[]);
          setRows(null);
          setSimpleRows(null);
        } else if (kind === "matrix") {
          setRows(data.rows as CalculatedPricingRow[]);
          setPerSecondRows(null);
          setSimpleRows(null);
        } else if (kind === "formula" || kind === "fixed") {
          setSimpleRows(data.rows as FormulaFixedPreviewRow[]);
          setRows(null);
          setPerSecondRows(null);
        } else {
          setRows(null);
          setPerSecondRows(null);
          setSimpleRows(null);
        }
        if (kind !== "raw" && data.summary) {
          setSummary(data.summary ?? null);
        }
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
        body: JSON.stringify({
          pricingSchema: schema,
          adminPricingPinned: schema[ADMIN_PRICING_PINNED_KEY] === true,
        }),
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
      const kind = data.previewKind;
      if (kind === "per_second") {
        setPerSecondRows((data.rows ?? []) as PerSecondMotionPreviewRow[]);
        setRows(null);
        setSimpleRows(null);
      } else if (kind === "matrix") {
        setRows((data.rows ?? []) as CalculatedPricingRow[]);
        setPerSecondRows(null);
        setSimpleRows(null);
      } else if (kind === "formula" || kind === "fixed") {
        setSimpleRows((data.rows ?? []) as FormulaFixedPreviewRow[]);
        setRows(null);
        setPerSecondRows(null);
      } else {
        setRows(null);
        setPerSecondRows(null);
        setSimpleRows(null);
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

  const formulaRulesFingerprint = JSON.stringify(schema.rules ?? []);

  const fmt = (n: number, d = 2) =>
    Number.isFinite(n) ? n.toFixed(d) : "—";

  const warnings = useMemo(() => {
    const w: string[] = [];
    if (rows?.length) {
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
    }
    if (simpleRows?.length) {
      for (const r of simpleRows) {
        if (r.credits < 1) {
          w.push("В образцах есть строка с < 1 токена.");
          break;
        }
      }
    }
    return w;
  }, [rows, simpleRows]);

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

      {isUnknownVisualType ? (
        <Alert>
          <AlertTitle>Неизвестный тип pricingSchema</AlertTitle>
          <AlertDescription>
            Тип «
            <code className="text-xs">{typeStr}</code>
            » пока без отдельного визуального редактора. Используйте полный JSON ниже или
            смените type в выпадающем списке.
          </AlertDescription>
        </Alert>
      ) : null}

      {canEdit ? (
        <section className="grid gap-3 rounded-lg border p-4 md:grid-cols-2">
          <div className="space-y-3">
            <div className="space-y-1">
              <Label className="text-xs font-medium">Тип ценообразования</Label>
              <select
                className="border-border bg-background h-9 w-full rounded-md border px-2 text-sm"
                value={selectedPricingTypeOption}
                onChange={(e) => {
                  const v = e.target.value;
                  if (
                    v === "matrix" ||
                    v === "per_second" ||
                    v === "fixed" ||
                    v === "formula"
                  ) {
                    applyPricingType(v);
                  }
                }}
              >
                <option value="matrix">matrix</option>
                <option value="per_second">per_second</option>
                <option value="fixed">fixed</option>
                <option value="formula">formula</option>
              </select>
            </div>
            <label className="flex items-start gap-2 text-xs leading-snug">
              <input
                type="checkbox"
                checked={schema[ADMIN_PRICING_PINNED_KEY] === true}
                onChange={(e) => {
                  const on = e.target.checked;
                  setSchema((prev) => {
                    const n = { ...prev };
                    if (on) {
                      (n as Record<string, unknown>)[ADMIN_PRICING_PINNED_KEY] = true;
                    } else {
                      delete (n as Record<string, unknown>)[ADMIN_PRICING_PINNED_KEY];
                    }
                    return n;
                  });
                }}
                className="mt-1 size-4"
              />
              <span>
                Закрепить цену, чтобы seed не перезаписал (
                <code>{ADMIN_PRICING_PINNED_KEY}</code>)
              </span>
            </label>
          </div>
          {isFixed ? (
            <div className="space-y-1">
              <Label className="text-xs">Токены (fixed)</Label>
              <Input
                type="number"
                min={1}
                step={1}
                value={
                  typeof schema.credits === "number" ? String(schema.credits) : ""
                }
                onChange={(e) =>
                  setSchema((prev) => ({
                    ...prev,
                    credits: Math.max(1, Math.floor(asNum(e.target.value, 1))),
                  }))
                }
              />
            </div>
          ) : null}
          {isFormula ? (
            <div className="grid gap-2 sm:grid-cols-3 md:col-span-2">
              <div className="space-y-1">
                <Label className="text-xs">baseCredits</Label>
                <Input
                  type="number"
                  min={0}
                  value={
                    typeof schema.baseCredits === "number"
                      ? String(schema.baseCredits)
                      : ""
                  }
                  onChange={(e) =>
                    setSchema((prev) => ({
                      ...prev,
                      baseCredits: Math.max(
                        0,
                        Math.floor(asNum(e.target.value, 0)),
                      ),
                    }))
                  }
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">minCredits</Label>
                <Input
                  type="number"
                  min={0}
                  value={
                    typeof schema.minCredits === "number"
                      ? String(schema.minCredits)
                      : ""
                  }
                  onChange={(e) =>
                    setSchema((prev) => ({
                      ...prev,
                      minCredits: Math.max(
                        0,
                        Math.floor(asNum(e.target.value, 0)),
                      ),
                    }))
                  }
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">round</Label>
                <select
                  className="border-border bg-background h-9 w-full rounded-md border px-2 text-xs"
                  value={typeof schema.round === "string" ? schema.round : "ceil"}
                  onChange={(e) =>
                    setSchema((prev) => ({
                      ...prev,
                      round: e.target.value,
                    }))
                  }
                >
                  <option value="ceil">ceil</option>
                  <option value="floor">floor</option>
                  <option value="round">round</option>
                </select>
              </div>
              <div className="space-y-1 sm:col-span-3">
                <Label className="text-xs">rules</Label>
                <Textarea
                  rows={10}
                  className="font-mono text-[11px] leading-snug"
                  spellCheck={false}
                  defaultValue={JSON.stringify(
                    Array.isArray(schema.rules) ? schema.rules : [],
                    null,
                    2,
                  )}
                  key={`${model.id}:rules:${formulaRulesFingerprint}`}
                  onBlur={(e) => {
                    try {
                      const parsed = JSON.parse(e.target.value || "[]") as unknown;
                      setSchema((prev) => ({
                        ...prev,
                        rules: Array.isArray(parsed) ? parsed : [],
                      }));
                      setError(null);
                    } catch {
                      setError("formula.rules: невалидный JSON");
                    }
                  }}
                />
                <p className="text-muted-foreground text-[11px]">
                  Уход с поля применит JSON как <code className="text-[11px]">rules</code>, затем
                  нажмите «Предпросмотр».
                </p>
              </div>
            </div>
          ) : null}
        </section>
      ) : null}

      <div className="space-y-2 rounded-lg border p-4">
        <h3 className="text-foreground text-sm font-medium">{adminTerm("pricingSchema")} (полный JSON)</h3>
        <Textarea
          rows={8}
          className="font-mono text-xs"
          spellCheck={false}
          value={rawJsonDraft}
          onChange={(e) => setRawJsonDraft(e.target.value)}
          readOnly={!canEdit}
        />
        {rawJsonError ? (
          <p className="text-destructive text-xs">{rawJsonError}</p>
        ) : null}
        {canEdit ? (
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
              onClick={() =>
                setRawJsonDraft(JSON.stringify(schema, null, 2))
              }
            >
              Подставить из схемы
            </button>
            <button
              type="button"
              className={cn(buttonVariants({ size: "sm" }))}
              onClick={() => applyPricingJsonDraft()}
            >
              Применить JSON
            </button>
          </div>
        ) : null}
      </div>

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
      {isMatrix &&
      rows != null &&
      rows.length === 0 &&
      !loading &&
      !error ? (
        <Alert>
          <AlertTitle>Таблица пустая</AlertTitle>
          <AlertDescription>
            Не удалось построить строки: в{" "}
            <code className="text-xs">providerCost</code> нет веток{" "}
            <code className="text-xs">noVideo</code> / <code className="text-xs">withVideo</code>{" "}
            со ставками, либо нет верхнеуровневых ключей типа{" "}
            <code className="text-xs">1K</code> с полями{" "}
            <code className="text-xs">kieCreditsPerSecond</code> и{" "}
            <code className="text-xs">usdPerSecond</code>. Если схему повредили при ручном
            редактировании JSON, восстановите из сид-скриптов модели или задайте ветку{" "}
            <code className="text-xs">noVideo</code> в редакторе ставок ниже после появления
            таблицы. Нажмите «Предпросмотр» ещё раз после правок (плоские ставки сервер может
            обернуть в <code className="text-xs">noVideo</code> — сохраните, если предложено).
          </AlertDescription>
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

      {simpleRows && simpleRows.length > 0 ? (
        <div className="space-y-2">
          <h3 className="text-foreground text-sm font-medium">Образцы (formula / fixed)</h3>
          <Table className="min-w-[620px] table-fixed">
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs">Сценарий</TableHead>
                <TableHead className="text-xs">Токены</TableHead>
                <TableHead className="text-xs">Настройки (fixture)</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {simpleRows.map((row) => (
                <TableRow key={row.label}>
                  <TableCell className="text-xs">{row.label}</TableCell>
                  <TableCell className="font-mono text-xs font-medium">{row.credits}</TableCell>
                  <TableCell className="font-mono text-[11px] break-all">
                    {JSON.stringify(row.settings ?? {})}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
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
