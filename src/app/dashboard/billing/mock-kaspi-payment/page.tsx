import { redirect } from "next/navigation";

import { PageHeader } from "@/components/layout/page-header";
import { MockKaspiPaymentClient } from "@/components/dashboard/mock-kaspi-payment-client";
import { paymentStatusForBillingApi } from "@/lib/billing-payment-api";
import { isSuperAdmin } from "@/lib/auth";
import { KASPI_PAYMENT_PROVIDER } from "@/lib/kaspi-config";
import { prisma } from "@/lib/prisma";
import { getFreshSessionUser } from "@/server/services/fresh-session-user";

export const metadata = {
  title: "Тестовая оплата Kaspi — QazCard AI",
};

function first(v: string | string[] | undefined): string {
  if (Array.isArray(v)) return v[0] ?? "";
  return v ?? "";
}

type PageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function MockKaspiPaymentPage({ searchParams }: PageProps) {
  const current = await getFreshSessionUser();
  if (!current.ok) {
    redirect("/auth/login?callbackUrl=/dashboard/billing");
  }
  const sp = (await searchParams) ?? {};
  const paymentId = first(sp.paymentId).trim();
  if (!paymentId) {
    redirect("/dashboard/billing");
  }

  const payment = await prisma.payment.findFirst({
    where: {
      id: paymentId,
      userId: current.user.id,
      provider: KASPI_PAYMENT_PROVIDER,
    },
    include: { tokenPackage: { select: { name: true } } },
  });

  if (!payment) {
    redirect("/dashboard/billing");
  }

  const initial = {
    id: payment.id,
    status: paymentStatusForBillingApi(payment.status),
    amount: Number(payment.amount.toString()),
    currency: payment.currency,
    credits: payment.credits,
    tokenPackageName: payment.tokenPackage?.name ?? null,
  };

  const canConfirm =
    isSuperAdmin(current.user.role) || process.env.NODE_ENV !== "production";

  return (
    <div className="space-y-6">
      <PageHeader
        variant="qaz"
        title="Mock Kaspi payment"
        description="Тестовая оплата Kaspi. Токены начисляются только после подтверждения на сервере (кнопка ниже в dev или webhook)."
        breadcrumbs={[
          { label: "Кабинет", href: "/dashboard" },
          { label: "Биллинг", href: "/dashboard/billing" },
          { label: "Тест Kaspi" },
        ]}
      />
      <MockKaspiPaymentClient paymentId={paymentId} initial={initial} canConfirm={canConfirm} />
    </div>
  );
}
