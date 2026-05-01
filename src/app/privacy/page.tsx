import type { Metadata } from "next";

import { PublicLegalPageFromDb } from "@/components/legal/public-legal-page-from-db";
import { PrivacyStaticFallback } from "@/components/legal/static-fallbacks";
import { getPublicLegalPage } from "@/server/services/legalPages";

export const dynamic = "force-dynamic";

const fallbackMeta: Metadata = {
  title: "Политика конфиденциальности — QazCard AI",
  description: "Черновик политики обработки данных (шаблон).",
};

export async function generateMetadata(): Promise<Metadata> {
  const row = await getPublicLegalPage("privacy");
  if (row) {
    return {
      title: `${row.title} — QazCard AI`,
      description: "Политика конфиденциальности QazCard AI.",
    };
  }
  return fallbackMeta;
}

export default async function PrivacyPage() {
  const row = await getPublicLegalPage("privacy");
  if (row) {
    return (
      <PublicLegalPageFromDb
        title={row.title}
        content={row.content}
        publishedAt={row.publishedAt}
      />
    );
  }
  return <PrivacyStaticFallback />;
}
