"use client";

import { useCallback, useMemo, useState } from "react";

import { DynamicModelSettingsFields } from "@/components/dashboard/dynamic-model-settings-fields";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  defaultsFromSchema,
  getSchemaFields,
} from "@/lib/generation-form-settings-schema";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { cn } from "@/lib/utils";

export type AdminModelTestPanelModel = {
  id: string;
  name: string;
  slug: string;
  provider: string;
  type: string;
  apiModelId: string;
  endpoint: string | null;
  statusEndpoint: string | null;
  isActive: boolean;
  settingsSchema: unknown;
  productCardModelType?: string | null;
};

type Props = {
  model: AdminModelTestPanelModel;
  canRunRealKie: boolean;
  mockKieEnabled: boolean;
  kieApiKeyConfigured: boolean;
};

function JsonBlock({
  title,
  value,
  className,
}: {
  title: string;
  value: unknown;
  className?: string;
}) {
  const text =
    value === undefined || value === null
      ? ""
      : typeof value === "string"
        ? value
        : JSON.stringify(value, null, 2);
  return (
    <details
      className={cn(
        "group rounded-md border border-border/80 bg-card/30",
        className,
      )}
    >
      <summary className="cursor-pointer list-none px-3 py-2 text-sm font-medium [&::-webkit-details-marker]:hidden">
        <span className="text-muted-foreground group-open:hidden">▶</span>
        <span className="text-muted-foreground hidden group-open:inline">▼</span>{" "}
        {title}
      </summary>
      <pre className="max-h-96 overflow-auto border-t border-border/60 p-3 font-mono text-xs leading-relaxed whitespace-pre-wrap">
        {text || "—"}
      </pre>
    </details>
  );
}

function InfoRow({
  en,
  ru,
  value,
}: {
  en: string;
  ru: string;
  value: string | boolean | null;
}) {
  const display =
    typeof value === "boolean" ? (value ? "true" : "false") : (value ?? "—");
  return (
    <div className="space-y-0.5 border-b border-border/40 py-2 last:border-0">
      <p className="text-muted-foreground text-xs">
        {en} / {ru}
      </p>
      <p className="font-mono text-sm break-all">{String(display)}</p>
    </div>
  );
}

export function ModelTestPanel({
  model,
  canRunRealKie,
  mockKieEnabled,
  kieApiKeyConfigured,
}: Props) {
  const [prompt, setPrompt] = useState("");
  const [dynSettings, setDynSettings] = useState<Record<string, unknown>>(() =>
    defaultsFromSchema(model.settingsSchema),
  );
  const [loading, setLoading] = useState<
    "preview" | "mock" | "real" | "dryRun" | null
  >(null);
  const [error, setError] = useState<string | null>(null);
  const [previewData, setPreviewData] = useState<{
    model: { id: string; name: string; apiModelId: string; endpoint: string | null };
    costCredits: number;
    pricing: {
      costCredits: number;
      pricingSource: string;
      note?: string;
    };
    payload: unknown;
    kieBody?: unknown;
    warnings: string[];
  } | null>(null);
  const [mockData, setMockData] = useState<{
    ok: boolean;
    costCredits: number;
    mockProviderTaskId: string;
    payload: unknown;
    message: string;
  } | null>(null);
  const [realConfirmOpen, setRealConfirmOpen] = useState(false);
  const [dryRunData, setDryRunData] = useState<{
    ok: boolean;
    payload: unknown;
    warnings: string[];
    costCredits?: number;
  } | null>(null);
  const [realData, setRealData] = useState<{
    ok?: boolean;
    providerTaskId?: string | null;
    status?: string;
    error?: string;
    statusCode?: number;
    payload?: unknown;
    providerResponse?: unknown;
  } | null>(null);

  const schemaFields = useMemo(
    () => getSchemaFields(model.settingsSchema),
    [model.settingsSchema],
  );

  const isClassifierModel = model.productCardModelType === "PRODUCT_CLASSIFIER";

  const setDynField = useCallback((name: string, value: unknown) => {
    setDynSettings((prev) => ({ ...prev, [name]: value }));
  }, []);

  const bodyPayload = useMemo(
    () => ({
      prompt: prompt.trim(),
      settings: dynSettings,
    }),
    [prompt, dynSettings],
  );

  const runDryRun = async () => {
    setError(null);
    setLoading("dryRun");
    setDryRunData(null);
    try {
      const res = await fetch(
        `/api/admin/models/${model.id}/test/payload-dry-run`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(
            prompt.trim()
              ? bodyPayload
              : { settings: dynSettings },
          ),
        },
      );
      const data = (await res.json()) as {
        ok?: boolean;
        error?: string;
        payload?: unknown;
        warnings?: string[];
        costCredits?: number;
      };
      if (!res.ok || !data.ok) {
        setError(
          typeof data.error === "string" ? data.error : `HTTP ${res.status}`,
        );
        return;
      }
      setDryRunData({
        ok: true,
        payload: data.payload,
        warnings: data.warnings ?? [],
        costCredits: data.costCredits,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка запроса");
    } finally {
      setLoading(null);
    }
  };

  const runPreview = async () => {
    setError(null);
    setLoading("preview");
    setPreviewData(null);
    try {
      const res = await fetch(`/api/admin/models/${model.id}/test/preview`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(bodyPayload),
      });
      const data = (await res.json()) as { error?: string; costCredits?: number };
      if (!res.ok) {
        setError(
          typeof data.error === "string" ? data.error : `HTTP ${res.status}`,
        );
        return;
      }
      setPreviewData(data as typeof previewData);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка запроса");
    } finally {
      setLoading(null);
    }
  };

  const runMock = async () => {
    setError(null);
    setLoading("mock");
    setMockData(null);
    try {
      const res = await fetch(`/api/admin/models/${model.id}/test/mock`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(bodyPayload),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        error?: string;
        costCredits?: number;
        mockProviderTaskId?: string;
        payload?: unknown;
        message?: string;
      };
      if (!res.ok || !data.ok) {
        setError(
          typeof data.error === "string" ? data.error : `HTTP ${res.status}`,
        );
        return;
      }
      setMockData(
        data as {
          ok: boolean;
          costCredits: number;
          mockProviderTaskId: string;
          payload: unknown;
          message: string;
        },
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка запроса");
    } finally {
      setLoading(null);
    }
  };

  const runReal = async () => {
    if (!canRunRealKie || !kieApiKeyConfigured) return;
    setError(null);
    setLoading("real");
    setRealData(null);
    try {
      const res = await fetch(`/api/admin/models/${model.id}/test/real`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(bodyPayload),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        error?: string;
        statusCode?: number;
        providerTaskId?: string | null;
        status?: string;
        payload?: unknown;
        providerResponse?: unknown;
      };
      if (res.status === 403) {
        setError("Только для SUPER_ADMIN");
        return;
      }
      if (!res.ok) {
        setError(
          typeof data.error === "string"
            ? data.error
            : `HTTP ${res.status}`,
        );
        return;
      }
      if (!data.ok) {
        const errText =
          data.error ??
          (typeof data.statusCode === "number"
            ? `Kie: ${data.statusCode}`
            : "Ошибка");
        const low = String(data.error || "").toLowerCase();
        if (low.includes("credit") || low.includes("insufficient")) {
          setError(
            `${errText}. Проверьте баланс счёта Kie.ai (insufficient credits).`,
          );
        } else {
          setError(errText);
        }
        setRealData(data);
        return;
      }
      setRealData(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка запроса");
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="space-y-6">
      <Alert>
        <AlertTitle>Тест модели / Model test</AlertTitle>
        <AlertDescription>
          Используйте этот раздел, чтобы проверить payload, стоимость и ответ
          Kie.ai перед включением модели пользователям. / Use this section to
          verify payload, pricing, and Kie responses before users see the
          model.
        </AlertDescription>
      </Alert>

      <div className="space-y-3 rounded-lg border border-border/80 p-4">
        <h3 className="text-sm font-semibold">Информация о модели</h3>
        <InfoRow en="name" ru="Название" value={model.name} />
        <InfoRow en="slug" ru="Slug" value={model.slug} />
        <InfoRow en="provider" ru="Провайдер" value={model.provider} />
        <InfoRow en="type" ru="Тип" value={model.type} />
        <InfoRow
          en="apiModelId"
          ru="ID модели у провайдера"
          value={model.apiModelId}
        />
        <InfoRow en="endpoint" ru="Endpoint запуска задачи" value={model.endpoint} />
        <InfoRow
          en="statusEndpoint"
          ru="Endpoint проверки статуса"
          value={model.statusEndpoint}
        />
        <InfoRow en="isActive" ru="Активна" value={model.isActive} />
      </div>

      <div className="space-y-3">
        <h3 className="text-sm font-semibold">Проверка модели</h3>
        {!model.isActive ? (
          <Alert>
            <AlertTitle>Модель выключена</AlertTitle>
            <AlertDescription>
              Модель выключена для пользователей, но тест можно выполнить вручную.
            </AlertDescription>
          </Alert>
        ) : null}
        <div className="space-y-2">
          <Label htmlFor="admin-model-test-prompt">Prompt</Label>
          <Textarea
            id="admin-model-test-prompt"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            rows={4}
            className="font-mono text-sm"
            placeholder="Описание сцены…"
          />
        </div>
        {schemaFields.length > 0 ? (
          <DynamicModelSettingsFields
            schemaFields={schemaFields}
            dynSettings={dynSettings}
            setDynField={setDynField}
          />
        ) : (
          <p className="text-muted-foreground text-sm">
            У модели нет settingsSchema — используются только prompt и
            встроенные поля API.
          </p>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="secondary"
          disabled={!!loading}
          onClick={() => void runDryRun()}
        >
          {loading === "dryRun"
            ? "…"
            : isClassifierModel
              ? "Проверить classifier payload без запуска"
              : "Проверить payload без запуска"}
        </Button>
        <Button
          type="button"
          variant="secondary"
          disabled={!!loading}
          onClick={() => void runPreview()}
        >
          {loading === "preview" ? "…" : "Предпросмотр payload"}
        </Button>
        <Button
          type="button"
          variant="secondary"
          disabled={!!loading}
          onClick={() => void runMock()}
        >
          {loading === "mock" ? "…" : "Mock test / Тест без Kie"}
        </Button>
        {canRunRealKie && (
          <Button
            type="button"
            variant="default"
            disabled={!!loading || !kieApiKeyConfigured}
            title={
              !kieApiKeyConfigured
                ? "KIE_API_KEY не настроен"
                : undefined
            }
            onClick={() => setRealConfirmOpen(true)}
          >
            {loading === "real" ? "…" : "Real Kie test / Реальный тест Kie"}
          </Button>
        )}
      </div>

      <ConfirmDialog
        open={realConfirmOpen}
        onOpenChange={setRealConfirmOpen}
        title="Реальный тест Kie.ai"
        description={
          mockKieEnabled
            ? "MOCK_KIE=true: запрос к Kie не уйдёт, тест будет эмулирован. Токены приложения не списываются."
            : "Тестовая генерация отправит запрос в Kie.ai и может списать средства на стороне провайдера. Продолжить?"
        }
        confirmLabel="Продолжить"
        variant="destructive"
        onConfirm={() => void runReal()}
      />

      {mockKieEnabled && canRunRealKie ? (
        <Alert>
          <AlertTitle>MOCK_KIE включён</AlertTitle>
          <AlertDescription>
            Real test будет выполнен в mock-режиме без реального списания у Kie.ai.
          </AlertDescription>
        </Alert>
      ) : null}

      {canRunRealKie && !kieApiKeyConfigured ? (
        <Alert variant="destructive">
          <AlertTitle>KIE_API_KEY не настроен</AlertTitle>
          <AlertDescription>Real test недоступен до настройки KIE_API_KEY в env.</AlertDescription>
        </Alert>
      ) : null}

      {canRunRealKie && kieApiKeyConfigured && !mockKieEnabled ? (
        <Alert variant="destructive" className="border-destructive/40">
          <AlertTitle>Реальный тест / Real test</AlertTitle>
          <AlertDescription>
            Реальный тест отправит запрос в Kie.ai и может списать баланс Kie. /
            A real test will call Kie.ai and may consume Kie account balance.
            Токены пользователей приложения не списываются. / App user credits
            are not debited.
          </AlertDescription>
        </Alert>
      ) : null}

      {!canRunRealKie && (
        <p className="text-muted-foreground text-xs">
          Real Kie test доступен с правом providers.manage.
        </p>
      )}

      {error && (
        <Alert variant="destructive">
          <AlertTitle>Ошибка</AlertTitle>
          <AlertDescription className="font-mono text-xs whitespace-pre-wrap">
            {error}
          </AlertDescription>
        </Alert>
      )}

      {dryRunData && (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold">Payload dry-run (без Kie.ai)</h3>
          {dryRunData.warnings.length > 0 ? (
            <ul className="list-inside list-disc text-xs text-amber-700">
              {dryRunData.warnings.map((w) => (
                <li key={w}>{w}</li>
              ))}
            </ul>
          ) : null}
          {typeof dryRunData.costCredits === "number" ? (
            <p className="text-sm">
              costCredits: <strong>{dryRunData.costCredits}</strong>
            </p>
          ) : null}
          <JsonBlock
            title={
              isClassifierModel
                ? "Classifier chat/completions payload"
                : "Итоговый Kie payload"
            }
            value={dryRunData.payload}
          />
        </div>
      )}

      {previewData && (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold">Оценка и предпросмотр</h3>
          <div className="rounded-md border border-border/80 p-3 text-sm">
            <p>
              <span className="text-muted-foreground">costCredits / Токены:</span>{" "}
              <strong>{previewData.costCredits}</strong>
            </p>
            <p className="mt-1 text-muted-foreground text-xs">
              pricing source: {previewData.pricing.pricingSource}
            </p>
            {previewData.pricing.note && (
              <p className="text-muted-foreground mt-0.5 text-xs">
                {previewData.pricing.note}
              </p>
            )}
            {previewData.warnings.length > 0 && (
              <ul className="mt-2 list-inside list-disc text-xs text-amber-700">
                {previewData.warnings.map((w) => (
                  <li key={w}>{w}</li>
                ))}
              </ul>
            )}
          </div>
          <JsonBlock
            title="Итоговый Kie body / Final Kie body (sanitized)"
            value={previewData.kieBody ?? previewData.payload}
          />
        </div>
      )}

      {mockData && (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold">Mock test</h3>
          <p className="text-sm">{mockData.message}</p>
          <p className="text-muted-foreground text-xs">
            {mockData.mockProviderTaskId}
          </p>
          <JsonBlock title="Payload JSON" value={mockData.payload} />
        </div>
      )}

      {realData && (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold">Real Kie</h3>
          {realData.ok === true && (
            <p className="text-sm">
              task:{" "}
              <span className="font-mono text-xs">
                {realData.providerTaskId ?? "—"}
              </span>{" "}
              · {realData.status}
            </p>
          )}
          {realData.payload !== undefined && (
            <JsonBlock title="Request payload (sanitized)" value={realData.payload} />
          )}
          {realData.providerResponse !== undefined && (
            <JsonBlock
              title="Provider response (sanitized)"
              value={realData.providerResponse}
            />
          )}
        </div>
      )}
    </div>
  );
}
