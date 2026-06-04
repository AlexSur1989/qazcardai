"use client";

import { useCallback, useEffect, useState, startTransition } from "react";

import type { KaspiManualBillingPublic } from "@/lib/kaspi-manual-config";

export type ManualPaymentRow = {
  requestId: string;
  paymentCode: string;
  status: string;
  statusLabel: string;
  amountKzt: number;
  creditsAmount: number;
  packageLabel: string;
  kaspiRecipientPhoneMasked?: string;
  kaspiPhoneDisplay: string;
  recipientName: string;
  instructionText: string;
  whatsappUrl: string | null;
  whatsappEnabled: boolean;
  whatsappPhoneDisplay: string;
  whatsappUnavailable?: boolean;
  createdAt: string;
  expiresAt: string | null;
  expired: boolean;
  canCancel: boolean;
  canOpenWhatsApp: boolean;
};

export function useKaspiManualBilling(publicSettings: KaspiManualBillingPublic) {
  const settings = publicSettings;
  const [active, setActive] = useState<ManualPaymentRow | null>(null);
  const [history, setHistory] = useState<ManualPaymentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [creating, setCreating] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!settings.enabled) {
      setActive(null);
      setHistory([]);
      setLoading(false);
      return;
    }
    setErr(null);
    try {
      const res = await fetch("/api/billing/manual-payments", { cache: "no-store" });
      const data = (await res.json()) as {
        enabled?: boolean;
        activeRequest?: ManualPaymentRow | null;
        requests?: ManualPaymentRow[];
        error?: string;
      };
      if (!res.ok) {
        setErr(data.error ?? "Не удалось загрузить заявки");
        return;
      }
      if (data.enabled === false) {
        setActive(null);
        setHistory([]);
        return;
      }
      setActive(data.activeRequest ?? null);
      setHistory(data.requests ?? []);
    } catch {
      setErr("Сеть: не удалось загрузить заявки");
    } finally {
      setLoading(false);
    }
  }, [settings.enabled]);

  useEffect(() => {
    startTransition(() => {
      void refresh();
    });
  }, [refresh]);

  async function createRequest(packageId: string) {
    setErr(null);
    setCreating(packageId);
    try {
      const res = await fetch("/api/billing/manual-payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          packageId,
          contactChannel: settings.whatsappEnabled ? "whatsapp" : "kaspi",
        }),
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

  async function cancelRequest(requestId: string) {
    setBusyId(requestId);
    setErr(null);
    try {
      const res = await fetch(
        `/api/billing/manual-payments/${encodeURIComponent(requestId)}/cancel`,
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

  return {
    settings,
    active,
    history,
    loading,
    err,
    setErr,
    creating,
    busyId,
    createRequest,
    cancelRequest,
    refresh,
  };
}
