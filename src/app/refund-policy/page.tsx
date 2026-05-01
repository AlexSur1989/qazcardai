import type { Metadata } from "next";

import { PublicLegalPageFromDb } from "@/components/legal/public-legal-page-from-db";
import { RefundPolicyStaticFallback } from "@/components/legal/static-fallbacks";
import { getPublicLegalPage } from "@/server/services/legalPages";

export const dynamic = "force-dynamic";

const fallbackMeta: Metadata = {
  title: "Возвраты и кредиты — QazCard AI",
  description: "Черновик политики возвратов и внутриигровых кредитов.",
};

export async function generateMetadata(): Promise<Metadata> {
  const row = await getPublicLegalPage("refund-policy");
  if (row) {
    return {
      title: `${row.title} — QazCard AI`,
      description: "Политика возвратов QazCard AI.",
    };
  }
  return fallbackMeta;
}

export default async function RefundPolicyPage() {
  const row = await getPublicLegalPage("refund-policy");
  if (row) {
    return (
      <PublicLegalPageFromDb
        title={row.title}
        content={row.content}
        publishedAt={row.publishedAt}
      />
    );
  }
  return <RefundPolicyStaticFallback />;
}
