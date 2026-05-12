"use client";

import { useCallback, useEffect, useState, startTransition } from "react";
import { Loader2 } from "lucide-react";

import type { KaspiManualBillingPublic } from "@/lib/kaspi-manual-config";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { formatKzt } from "@/lib/format-kzt";

type PackageRow = {
  id: string;
  name: string;
  priceKzt: number;
};

type ActivePayment = {
  id: string;
  status: string;
  amount: number;
  credits: number;
  providerPaymentId: string | null;
  instructionCode: string;
  recipientName: string;
  kaspiRecipientPhoneMasked: string;
  instructionText: string;
  expiresAt: string | null;
  expired: boolean;
  userComment: string;
  userReceiptUrl: string;
  tokenPackageName: string;
};

type Props = {
  packages: PackageRow[];
  publicSettings: KaspiManualBillingPublic;
};

export function KaspiManualBillingPanel({ packages, publicSettings }: Props) {
  const [active, setActive] = useState<ActivePayment | null>(null);
  const [settings, setSettings] = useState<KaspiManualBillingPublic>(publicSettings);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [creating, setCreating] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [comment, setComment] = useState("");
  const [receiptUrl, setReceiptUrl] = useState("");
  const [uploading, setUploading] = useState(false);

  const refresh = useCallback(async () => {
    setErr(null);
    try {
      const res = await fetch("/api/billing/payments/kaspi-manual/active", {
        cache: "no-store",
      });
      const data = (await res.json()) as {
        enabled?: boolean;
        settings?: KaspiManualBillingPublic;
        payment?: ActivePayment | null;
        error?: string;
      };
      if (!res.ok) {
        setErr(data.error ?? "Не удалось загрузить статус");
        return;
      }
      if (data.settings) setSettings(data.settings);
      setActive(data.payment ?? null);
    } catch {
      setErr("Сеть: не удалось загрузить заявку");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    startTransition(() => {
      void refresh();
    });
  }, [refresh]);

  async function createManual(packageId: string) {
    setErr(null);
    setCreating(packageId);
    try {
      const res = await fetch("/api/billing/payments/kaspi-manual/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tokenPackageId: packageId }),
      });
      const data = (await res.json()) as {
        error?: string;
        existingPaymentId?: string;
      };
      if (!res.ok) {
        setErr(data.error ?? `Ошибка ${res.status}`);
        return;
      }
      await refresh();
    } catch {
      setErr("Сеть: не удалось создать заявку");
    } finally {
      setCreating(null);
    }
  }

  async function markPaid() {
    if (!active) return;
    setBusyId("mark");
    setErr(null);
    try {
      const res = await fetch(
        `/api/billing/payments/kaspi-manual/${encodeURIComponent(active.id)}/mark-paid`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userComment: comment.trim() || undefined,
            userReceiptUrl: receiptUrl.trim() || undefined,
          }),
        },
      );
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setErr(data.error ?? `Ошибка ${res.status}`);
        return;
      }
      setComment("");
      setReceiptUrl("");
      await refresh();
    } catch {
      setErr("Сеть: не удалось отправить");
    } finally {
      setBusyId(null);
    }
  }

  async function cancelPayment() {
    if (!active) return;
    setBusyId("cancel");
    setErr(null);
    try {
      const res = await fetch(
        `/api/billing/payments/kaspi-manual/${encodeURIComponent(active.id)}/cancel`,
        { method: "POST" },
      );
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setErr(data.error ?? `Ошибка ${res.status}`);
        return;
      }
      await refresh();
    } catch {
      setErr("Сеть: не удалось отменить");
    } finally {
      setBusyId(null);
    }
  }

  async function onPickReceipt(file: File | null) {
    if (!file) return;
    setUploading(true);
    setErr(null);
    try {
      const form = new FormData();
      form.set("file", file);
      form.set("purpose", "kaspi_manual_receipt");
      const res = await fetch("/api/uploads", { method: "POST", body: form });
      const data = (await res.json()) as { url?: string; error?: string };
      if (!res.ok) {
        setErr(data.error ?? "Не удалось загрузить файл");
        return;
      }
      if (data.url) setReceiptUrl(data.url);
    } catch {
      setErr("Сеть: загрузка не удалась");
    } finally {
      setUploading(false);
    }
  }

  if (loading) {
    return (
      <div className="text-muted-foreground flex items-center gap-2 text-sm">
        <Loader2 className="size-4 animate-spin" aria-hidden />
        Загрузка…
      </div>
    );
  }

  if (!settings.enabled) return null;

  return (
    <div className="space-y-4">
      {err && (
        <Alert variant="destructive">
          <AlertTitle>Ошибка</AlertTitle>
          <AlertDescription>{err}</AlertDescription>
        </Alert>
      )}

      {active && (
        <Alert className={active.expired ? "border-amber-500/50" : undefined}>
          <AlertTitle>
            {active.expired ? "Заявка просрочена" : "Перевод Kaspi (ожидает проверки)"}
          </AlertTitle>
          <AlertDescription className="space-y-2 text-sm">
            <p>
              Пакет: <strong>{active.tokenPackageName}</strong>
            </p>
            <p>
              Сумма: <strong>{formatKzt(active.amount)}</strong> · токенов:{" "}
              <strong>{active.credits}</strong>
            </p>
            <p>
              Kaspi: <strong>{active.kaspiRecipientPhoneMasked}</strong>
            </p>
            <p>
              Получатель: <strong>{active.recipientName}</strong>
            </p>
            <p>
              Код в комментарии:{" "}
              <code className="bg-muted rounded px-1.5 py-0.5 text-xs font-mono">
                {active.instructionCode}
              </code>
            </p>
            <p className="text-muted-foreground">{active.instructionText}</p>
            {active.expiresAt && (
              <p className="text-muted-foreground text-xs">
                Действует до: {new Date(active.expiresAt).toLocaleString("ru-RU")}
              </p>
            )}
            {active.status === "PENDING" && !active.expired && (
              <div className="space-y-2 pt-2">
                <label className="text-muted-foreground text-xs">
                  Комментарий (необязательно)
                </label>
                <Textarea
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  rows={2}
                  className="text-sm"
                  placeholder="Например, время перевода или ФИО отправителя"
                />
                {settings.requireReceiptUpload && (
                  <div className="space-y-1">
                    <label className="text-muted-foreground text-xs">
                      Скрин или квитанция обязательны
                    </label>
                    <input
                      type="file"
                      accept="image/*"
                      disabled={uploading}
                      onChange={(e) => void onPickReceipt(e.target.files?.[0] ?? null)}
                      className="text-xs"
                    />
                    {receiptUrl && (
                      <p className="text-xs">
                        <a
                          className="text-primary underline"
                          href={receiptUrl}
                          target="_blank"
                          rel="noreferrer"
                        >
                          Открыть загруженный файл
                        </a>
                      </p>
                    )}
                  </div>
                )}
                {!settings.requireReceiptUpload && (
                  <div className="space-y-1">
                    <label className="text-muted-foreground text-xs">
                      Скрин или квитанция (по желанию)
                    </label>
                    <input
                      type="file"
                      accept="image/*"
                      disabled={uploading}
                      onChange={(e) => void onPickReceipt(e.target.files?.[0] ?? null)}
                      className="text-xs"
                    />
                    {receiptUrl && (
                      <p className="text-xs">
                        <a
                          className="text-primary underline"
                          href={receiptUrl}
                          target="_blank"
                          rel="noreferrer"
                        >
                          Открыть загруженный файл
                        </a>
                      </p>
                    )}
                  </div>
                )}
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    size="sm"
                    disabled={busyId !== null || uploading}
                    onClick={() => void markPaid()}
                  >
                    {busyId === "mark" ? (
                      <>
                        <Loader2 className="size-3.5 animate-spin" />
                        Отправляем…
                      </>
                    ) : (
                      "Я оплатил"
                    )}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    disabled={busyId !== null}
                    onClick={() => void cancelPayment()}
                  >
                    {busyId === "cancel" ? (
                      <>
                        <Loader2 className="size-3.5 animate-spin" />
                        Отмена…
                      </>
                    ) : (
                      "Отменить заявку"
                    )}
                  </Button>
                </div>
              </div>
            )}
            {active.status === "PROCESSING" && (
              <p className="text-muted-foreground pt-2 text-xs">
                Заявка передана на проверку. Токены начислятся после подтверждения администратором.
              </p>
            )}
          </AlertDescription>
        </Alert>
      )}

      {!active && packages.length > 0 && (
        <div className="space-y-2">
          <p className="text-foreground text-sm font-medium">Kaspi перевод</p>
          <p className="text-muted-foreground text-xs">
            После создания заявки вы получите код для поля комментария к переводу. Токены начисляются
            только после проверки администратором.
          </p>
          <ul className="flex flex-col gap-2">
            {packages.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center gap-2">
                <span className="text-sm">
                  {p.name} — {formatKzt(p.priceKzt)}
                </span>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={creating !== null}
                  onClick={() => void createManual(p.id)}
                >
                  {creating === p.id ? (
                    <>
                      <Loader2 className="size-3.5 animate-spin" />
                      Создаём…
                    </>
                  ) : (
                    "Оплатить через Kaspi перевод"
                  )}
                </Button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
