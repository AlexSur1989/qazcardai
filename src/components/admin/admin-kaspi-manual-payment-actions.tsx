"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { KASPI_MANUAL_PAYMENT_PROVIDER } from "@/lib/kaspi-manual-config";
import type { PaymentStatus } from "@/generated/prisma/enums";

type Props = {
  paymentId: string;
  provider: string;
  status: PaymentStatus;
  canManagePayments: boolean;
};

export function AdminKaspiManualPaymentActions({
  paymentId,
  provider,
  status,
  canManagePayments,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [rejectReason, setRejectReason] = useState("");
  const [msg, setMsg] = useState<string | null>(null);

  if (provider !== KASPI_MANUAL_PAYMENT_PROVIDER) return null;

  const open = status === "PENDING" || status === "PROCESSING";
  if (!open) return null;

  async function post(url: string, body?: object) {
    setMsg(null);
    const res = await fetch(url, {
      method: "POST",
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
    const j = (await res.json().catch(() => ({}))) as { error?: string };
    if (!res.ok) {
      setMsg(j.error ?? `HTTP ${res.status}`);
      return;
    }
    startTransition(() => router.refresh());
  }

  if (!canManagePayments) {
    return (
      <p className="text-muted-foreground text-sm">
        Действия по ручному Kaspi доступны пользователям с правом payments.manage.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {msg && (
        <p className="text-destructive text-sm" role="alert">
          {msg}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        {status === "PENDING" ? (
          <Button
            type="button"
            size="sm"
            variant="secondary"
            disabled={pending}
            onClick={() =>
              void post(`/api/admin/payments/${encodeURIComponent(paymentId)}/manual-claim`)
            }
          >
            Взять в проверку
          </Button>
        ) : null}
        <Button
          type="button"
          size="sm"
          disabled={pending}
          onClick={() =>
            void post(
              `/api/admin/payments/${encodeURIComponent(paymentId)}/manual-confirm`,
            )
          }
        >
          Подтвердить оплату
        </Button>
      </div>
      <div className="space-y-2">
        <label className="text-muted-foreground text-xs">Причина отказа</label>
        <Textarea
          value={rejectReason}
          onChange={(e) => setRejectReason(e.target.value)}
          rows={2}
          className="text-sm"
          placeholder="Коротко, для журнала"
        />
        <Button
          type="button"
          size="sm"
          variant="destructive"
          disabled={pending || rejectReason.trim().length === 0}
          onClick={() =>
            void post(`/api/admin/payments/${encodeURIComponent(paymentId)}/manual-reject`, {
              rejectReason: rejectReason.trim(),
            })
          }
        >
          Отклонить
        </Button>
      </div>
    </div>
  );
}
