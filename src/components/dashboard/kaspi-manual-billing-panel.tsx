"use client";

import { ExternalLink, Loader2, MessageCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatKzt } from "@/lib/format-kzt";
import { formatAdminDateTime } from "@/lib/admin-format";
import type { ManualPaymentRow } from "@/components/dashboard/use-kaspi-manual-billing";

type PackageRow = {
  id: string;
  name: string;
  priceKzt: number;
};

type BillingState = {
  settings: { enabled: boolean; whatsappEnabled: boolean };
  active: ManualPaymentRow | null;
  history: ManualPaymentRow[];
  loading: boolean;
  err: string | null;
  creating: string | null;
  busyId: string | null;
  createRequest: (packageId: string) => Promise<void>;
  cancelRequest: (requestId: string) => Promise<void>;
};

type Props = {
  packages: PackageRow[];
  billing: BillingState;
  /** Не дублировать список пакетов — кнопки на карточках каталога */
  hidePackagePicker?: boolean;
};

export function KaspiManualBillingPanel({
  packages,
  billing,
  hidePackagePicker = false,
}: Props) {
  const {
    settings,
    active,
    history,
    loading,
    err,
    creating,
    busyId,
    createRequest,
    cancelRequest,
  } = billing;

  function openWhatsApp(url: string) {
    window.open(url, "_blank", "noopener,noreferrer");
  }

  function renderWhatsAppBlock(row: ManualPaymentRow) {
    if (!row.whatsappEnabled) return null;

    if (row.whatsappUnavailable || !row.whatsappPhoneDisplay) {
      return (
        <div className="space-y-1 rounded-md border border-amber-500/30 bg-amber-500/5 p-3">
          <p className="text-sm font-medium">WhatsApp для отправки чека</p>
          <p className="text-muted-foreground text-xs">
            WhatsApp временно недоступен. Используйте инструкцию по Kaspi выше.
          </p>
        </div>
      );
    }

    return (
      <div className="space-y-2 rounded-md border p-3">
        <p className="text-sm font-medium">WhatsApp для отправки чека</p>
        <p className="text-base font-semibold tracking-wide">{row.whatsappPhoneDisplay}</p>
        <p className="text-muted-foreground text-xs">
          После оплаты отправьте чек в WhatsApp.
        </p>
        {row.canOpenWhatsApp && row.whatsappUrl ? (
          <Button
            type="button"
            size="sm"
            className="gap-1.5"
            onClick={() => openWhatsApp(row.whatsappUrl!)}
          >
            <MessageCircle className="size-3.5" aria-hidden />
            Написать в WhatsApp
          </Button>
        ) : null}
      </div>
    );
  }

  function renderActiveCard(row: ManualPaymentRow) {
    return (
      <Alert className={row.expired ? "border-amber-500/50" : undefined}>
        <AlertTitle>
          {row.expired ? "Заявка просрочена" : "Заявка на пополнение"}
        </AlertTitle>
        <AlertDescription className="space-y-3 text-sm">
          <div className="space-y-1">
            <p>
              Пакет: <strong>{row.packageLabel}</strong>
            </p>
            <p>
              Сумма: <strong>{formatKzt(row.amountKzt)}</strong>
            </p>
            <p>
              Токены: <strong>{row.creditsAmount}</strong>
            </p>
          </div>

          <div className="space-y-1 rounded-md border p-3">
            <p className="font-medium">Kaspi для перевода</p>
            <p className="text-base font-semibold tracking-wide">{row.kaspiPhoneDisplay}</p>
            <p>
              Получатель: <strong>{row.recipientName}</strong>
            </p>
            <p className="text-muted-foreground text-xs">
              Переведите сумму на Kaspi и укажите код заявки в комментарии.
            </p>
          </div>

          <div className="space-y-1">
            <p className="font-medium">Код заявки</p>
            <code className="bg-muted inline-block rounded px-2 py-1 font-mono text-sm">
              {row.paymentCode}
            </code>
          </div>

          {renderWhatsAppBlock(row)}

          {row.instructionText ? (
            <p className="text-muted-foreground text-xs">{row.instructionText}</p>
          ) : null}

          {row.expiresAt ? (
            <p className="text-muted-foreground text-xs">
              Действует до: {new Date(row.expiresAt).toLocaleString("ru-RU")}
            </p>
          ) : null}

          <p className="text-muted-foreground text-xs">
            Статус: <strong>{row.statusLabel}</strong>
          </p>

          {row.canCancel ? (
            <div className="flex flex-wrap gap-2 pt-1">
              <Button
                type="button"
                size="sm"
                variant="secondary"
                disabled={busyId !== null}
                onClick={() => void cancelRequest(row.requestId)}
              >
                {busyId === row.requestId ? (
                  <>
                    <Loader2 className="size-3.5 animate-spin" />
                    Отмена…
                  </>
                ) : (
                  "Отменить заявку"
                )}
              </Button>
            </div>
          ) : null}
        </AlertDescription>
      </Alert>
    );
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

      {active ? renderActiveCard(active) : null}

      {!hidePackagePicker && !active && packages.length > 0 && (
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
                onClick={() => void createRequest(p.id)}
              >
                {creating === p.id ? (
                  <>
                    <Loader2 className="size-3.5 animate-spin" />
                    Создаём…
                  </>
                ) : (
                  "Создать заявку"
                )}
              </Button>
            </li>
          ))}
        </ul>
      )}

      {history.length > 0 && (
        <div className="space-y-2">
          <p className="text-foreground text-sm font-medium">Мои заявки на пополнение</p>
          <div className="overflow-x-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Код</TableHead>
                  <TableHead>Сумма</TableHead>
                  <TableHead>Токены</TableHead>
                  <TableHead>Статус</TableHead>
                  <TableHead>Дата</TableHead>
                  <TableHead className="text-right">Действия</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {history.map((row) => (
                  <TableRow key={row.requestId}>
                    <TableCell className="font-mono text-xs">{row.paymentCode}</TableCell>
                    <TableCell>{formatKzt(row.amountKzt)}</TableCell>
                    <TableCell>{row.creditsAmount}</TableCell>
                    <TableCell>{row.statusLabel}</TableCell>
                    <TableCell className="text-muted-foreground text-xs whitespace-nowrap">
                      {formatAdminDateTime(new Date(row.createdAt))}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex flex-wrap justify-end gap-1">
                        {row.canOpenWhatsApp && row.whatsappUrl ? (
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="h-8 gap-1 text-xs"
                            onClick={() => openWhatsApp(row.whatsappUrl!)}
                          >
                            <ExternalLink className="size-3" aria-hidden />
                            WhatsApp
                          </Button>
                        ) : null}
                        {row.canCancel ? (
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            className="h-8 text-xs"
                            disabled={busyId !== null}
                            onClick={() => void cancelRequest(row.requestId)}
                          >
                            Отменить
                          </Button>
                        ) : null}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}
    </div>
  );
}
