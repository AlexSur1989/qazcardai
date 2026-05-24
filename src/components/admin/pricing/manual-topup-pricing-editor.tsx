"use client";

import { useCallback, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ExternalLink, Loader2 } from "lucide-react";

import {
  buildWhatsAppTestPreviewUrl,
  kaspiManualSoftWarnings,
  type KaspiManualPricingApi,
} from "@/lib/pricing-admin/kaspi-manual";
import { formatWhatsAppPhoneDisplay } from "@/lib/whatsapp-manual-payment";
import type { AppSettingMeta } from "@/server/services/adminPricingEditor";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const INPUT_CLS = "text-sm";

const PLACEHOLDER_HINT =
  "{{paymentCode}}, {{packageLabel}}, {{amountKzt}}, {{creditsAmount}}, {{userEmail}}, {{userTelegram}}";

type Props = {
  initialSettings: KaspiManualPricingApi;
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

export function ManualTopUpPricingEditor({ initialSettings, meta, canEdit }: Props) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<KaspiManualPricingApi>(initialSettings);
  const [saved, setSaved] = useState<KaspiManualPricingApi>(initialSettings);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);
  const [testUrl, setTestUrl] = useState<string | null>(null);

  const softWarnings = useMemo(() => kaspiManualSoftWarnings(draft), [draft]);
  const metaLine = formatMeta(meta);

  const save = useCallback(async () => {
    setLoading(true);
    setErr(null);
    setOkMsg(null);
    try {
      const res = await fetch("/api/admin/pricing/manual-topup", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft),
      });
      const data = (await res.json()) as { error?: string; settings?: KaspiManualPricingApi };
      if (!res.ok) {
        setErr(data.error ?? `Ошибка ${res.status}`);
        return;
      }
      if (data.settings) {
        setSaved(data.settings);
        setDraft(data.settings);
      }
      setOkMsg("Настройки ручного пополнения сохранены");
      setEditing(false);
      router.refresh();
    } catch {
      setErr("Сеть: не удалось сохранить");
    } finally {
      setLoading(false);
    }
  }, [draft, router]);

  const previewWhatsApp = useCallback(() => {
    const url = buildWhatsAppTestPreviewUrl({
      whatsappPhone: draft.whatsappPhone ?? "",
      template: draft.whatsappMessageTemplate,
    });
    setTestUrl(url);
    if (!url) setErr("Укажите WhatsApp номер для preview");
  }, [draft]);

  const s = editing ? draft : saved;

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-2">
        <div>
          <CardTitle className="text-base">Ручное пополнение</CardTitle>
          <CardDescription>KASPI_MANUAL_SETTINGS</CardDescription>
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
              setTestUrl(null);
            }}
          >
            {editing ? "Закрыть редактор" : "Редактировать"}
          </Button>
        ) : null}
      </CardHeader>
      <CardContent className="space-y-4">
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
        {(editing ? softWarnings : kaspiManualSoftWarnings(saved)).map((w) => (
          <Alert key={w}>
            <AlertDescription>{w}</AlertDescription>
          </Alert>
        ))}

        {editing ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="flex items-center gap-2 text-sm sm:col-span-2">
              <input
                type="checkbox"
                checked={draft.kaspiManualEnabled}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, kaspiManualEnabled: e.target.checked }))
                }
                className="rounded border"
              />
              Ручное пополнение включено
            </label>
            <div>
              <Label>Имя получателя</Label>
              <Input
                className={INPUT_CLS}
                value={draft.recipientName}
                onChange={(e) => setDraft((d) => ({ ...d, recipientName: e.target.value }))}
              />
            </div>
            <div>
              <Label>Kaspi телефон</Label>
              <Input
                className={INPUT_CLS}
                value={draft.recipientPhone}
                onChange={(e) => setDraft((d) => ({ ...d, recipientPhone: e.target.value }))}
                placeholder="+7 700 123 45 67"
              />
            </div>
            <div className="sm:col-span-2">
              <Label>Инструкции для клиента</Label>
              <Textarea
                className={INPUT_CLS}
                rows={4}
                value={draft.instructionText}
                onChange={(e) => setDraft((d) => ({ ...d, instructionText: e.target.value }))}
              />
            </div>
            <label className="flex items-center gap-2 text-sm sm:col-span-2">
              <input
                type="checkbox"
                checked={draft.whatsappEnabled}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, whatsappEnabled: e.target.checked }))
                }
                className="rounded border"
              />
              WhatsApp включён
            </label>
            <div>
              <Label>WhatsApp телефон (только цифры в БД)</Label>
              <Input
                className={INPUT_CLS}
                value={draft.whatsappPhone ?? ""}
                onChange={(e) => setDraft((d) => ({ ...d, whatsappPhone: e.target.value }))}
                placeholder="77001234567"
              />
            </div>
            <div className="sm:col-span-2">
              <Label>Шаблон WhatsApp</Label>
              <Textarea
                className={`font-mono ${INPUT_CLS}`}
                rows={6}
                value={draft.whatsappMessageTemplate}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, whatsappMessageTemplate: e.target.value }))
                }
              />
              <p className="text-muted-foreground mt-1 text-xs">Placeholders: {PLACEHOLDER_HINT}</p>
            </div>
          </div>
        ) : (
          <div className="grid gap-2 text-sm sm:grid-cols-2">
            <p>
              Ручное пополнение:{" "}
              <strong>{s.kaspiManualEnabled ? "включено" : "выключено"}</strong>
            </p>
            <p>
              Получатель: <strong>{s.recipientName}</strong>
            </p>
            <p>
              Kaspi: <strong>{s.recipientPhone}</strong>
            </p>
            <p>
              WhatsApp:{" "}
              <strong>
                {s.whatsappEnabled && s.whatsappPhone
                  ? formatWhatsAppPhoneDisplay(s.whatsappPhone)
                  : "выключен"}
              </strong>
            </p>
          </div>
        )}

        {!editing && s.instructionText ? (
          <details className="text-sm">
            <summary className="cursor-pointer text-muted-foreground">Инструкции (текст)</summary>
            <p className="mt-2 whitespace-pre-wrap">{s.instructionText}</p>
          </details>
        ) : null}

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
                setTestUrl(null);
              }}
            >
              Отменить
            </Button>
            <Button type="button" variant="secondary" onClick={previewWhatsApp}>
              Проверить WhatsApp ссылку
            </Button>
          </div>
        ) : canEdit ? (
          <Button type="button" variant="secondary" size="sm" onClick={previewWhatsApp}>
            Проверить WhatsApp ссылку
          </Button>
        ) : null}

        {testUrl ? (
          <Alert>
            <AlertDescription className="break-all">
              Preview (код QAZCARD-TEST1):{" "}
              <a
                href={testUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary inline-flex items-center gap-1 underline"
              >
                {testUrl}
                <ExternalLink className="size-3" />
              </a>
            </AlertDescription>
          </Alert>
        ) : null}
      </CardContent>
    </Card>
  );
}
