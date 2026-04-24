import "server-only";

import { Prisma } from "@/generated/prisma/client";

/**
 * Каталог пакетов. Цены в Stripe — через Price id в Dashboard; в БД (Payment) дублируем для отчётов.
 * Позже список можно вынести в AppSetting (JSON) с теми же полями.
 */
export type CreditPackageDef = {
  id: string;
  name: string;
  description: string;
  credits: number;
  /** Сумма для Payment / UI (должна соответствовать Price в Stripe) */
  amount: string;
  currency: string;
  /** env: Stripe Price id, например price_xxx */
  stripePriceEnvKey: string;
};

export const CREDIT_PACKAGE_CATALOG: readonly CreditPackageDef[] = [
  {
    id: "pack_100",
    name: "100 кредитов",
    description: "Для разового теста и небольших задач",
    credits: 100,
    amount: "4.99",
    currency: "usd",
    stripePriceEnvKey: "STRIPE_PRICE_ID_PACK_100",
  },
  {
    id: "pack_500",
    name: "500 кредитов",
    description: "Оптом выгоднее",
    credits: 500,
    amount: "19.99",
    currency: "usd",
    stripePriceEnvKey: "STRIPE_PRICE_ID_PACK_500",
  },
  {
    id: "pack_1500",
    name: "1500 кредитов",
    description: "Максимум для активной работы",
    credits: 1500,
    amount: "49.99",
    currency: "usd",
    stripePriceEnvKey: "STRIPE_PRICE_ID_PACK_1500",
  },
];

export type ResolvedCreditPackage = CreditPackageDef & {
  stripePriceId: string;
  amountDecimal: Prisma.Decimal;
};

function envStripePriceId(key: string): string | undefined {
  const v = process.env[key]?.trim();
  return v && v.length > 0 ? v : undefined;
}

/** Пакеты, для которых задана переменная с Stripe Price id. */
export function getResolvableCreditPackages(): ResolvedCreditPackage[] {
  const out: ResolvedCreditPackage[] = [];
  for (const p of CREDIT_PACKAGE_CATALOG) {
    const stripePriceId = envStripePriceId(p.stripePriceEnvKey);
    if (!stripePriceId) continue;
    out.push({
      ...p,
      stripePriceId,
      amountDecimal: new Prisma.Decimal(p.amount),
    });
  }
  return out;
}

export function getCreditPackageById(
  id: string,
): ResolvedCreditPackage | undefined {
  return getResolvableCreditPackages().find((p) => p.id === id);
}
