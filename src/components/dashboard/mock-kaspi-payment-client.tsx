"use client";

import { useCallback, useState } from "react";

import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { formatKzt } from "@/lib/format-kzt";

export type MockKaspiPaymentApi = {
  id: string;
  status: string;
  amount: number;
  currency: string;
  credits: number;
  tokenPackageName: string | null;
};

type Props = {
  paymentId: string;
  initial: MockKaspiPaymentApi;
  canConfirm: boolean;
};

export function MockKaspiPaymentClient({ paymentId, initial, canConfirm }: Props) {
  const [payment, setPayment] = useState<MockKaspiPaymentApi>(initial);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [doneMsg, setDoneMsg] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setError(null);
    setRefreshing(true);
    try {
      const res = await fetch(`/api/billing/payments/${paymentId}`);
      const data = (await res.json()) as MockKaspiPaymentApi & { error?: string };
      if (!res.ok) {
        setError(data.error ?? `Ошибка ${res.status}`);
        return;
      }
      setPayment(data);
    } catch {
      setError("Не удалось загрузить платёж");
    } finally {
      setRefreshing(false);
    }
  }, [paymentId]);

  async function confirm() {
    setConfirming(true);
    setError(null);
    setDoneMsg(null);
    try {
      const res = await fetch(`/api/admin/payments/${paymentId}/mock-confirm`, {
        method: "POST",
      });
      const data = (await res.json()) as { ok?: boolean; alreadyConfirmed?: boolean; error?: string };
      if (!res.ok) {
        setError(data.error ?? `Ошибка ${res.status}`);
        return;
      }
      setDoneMsg(
        data.alreadyConfirmed
          ? "Платёж уже был подтверждён ранее (идемпотентно)."
          : "Тестовая оплата подтверждена. Баланс обновится после перехода в биллинг.",
      );
      await refresh();
      setTimeout(() => {
        window.location.assign("/dashboard/billing?checkout=kaspi_success");
      }, 1200);
    } catch {
      setError("Сеть: не удалось подтвердить");
    } finally {
      setConfirming(false);
    }
  }

  return (
    <div className="space-y-6">
      {error && (
        <Alert variant="destructive">
          <AlertTitle>Ошибка</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      {doneMsg && (
        <Alert>
          <AlertTitle>Готово</AlertTitle>
          <AlertDescription>{doneMsg}</AlertDescription>
        </Alert>
      )}

      <div className="qaz-surface space-y-3 p-5 text-sm">
        <p>
          <span className="text-muted-foreground">paymentId:</span>{" "}
          <span className="font-mono text-xs break-all">{payment.id}</span>
        </p>
        <p>
          <span className="text-muted-foreground">Пакет:</span>{" "}
          {payment.tokenPackageName ?? "—"}
        </p>
        <p>
          <span className="text-muted-foreground">Сумма:</span>{" "}
          {formatKzt(payment.amount)} {payment.currency}
        </p>
        <p>
          <span className="text-muted-foreground">Токены:</span> {payment.credits}
        </p>
        <p>
          <span className="text-muted-foreground">Статус:</span> {payment.status}
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" size="sm" disabled={refreshing} onClick={() => void refresh()}>
          {refreshing ? "Обновление…" : "Обновить статус"}
        </Button>
      </div>

      {canConfirm ? (
        <Button type="button" disabled={confirming} onClick={() => void confirm()}>
          {confirming ? "Подтверждаем…" : "Подтвердить тестовую оплату"}
        </Button>
      ) : (
        <Alert>
          <AlertTitle>Тестовый режим</AlertTitle>
          <AlertDescription>
            В production подтверждение mock-платежа доступно только супер-администратору. Обычно
            токены начисляются после вызова webhook на сервере.
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}
