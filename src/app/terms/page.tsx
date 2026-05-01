import type { Metadata } from "next";

import { PublicLegalPageFromDb } from "@/components/legal/public-legal-page-from-db";
import { TermsStaticFallback } from "@/components/legal/static-fallbacks";
import { getPublicLegalPage } from "@/server/services/legalPages";

export const dynamic = "force-dynamic";

const fallbackMeta: Metadata = {
  title: "Условия использования — QazCard AI",
  description: "Черновик пользовательского соглашения (шаблон).",
};

export async function generateMetadata(): Promise<Metadata> {
  const row = await getPublicLegalPage("terms");
  if (row) {
    return {
      title: `${row.title} — QazCard AI`,
      description: "Пользовательское соглашение QazCard AI.",
    };
  }
  return fallbackMeta;
}

export default async function TermsPage() {
  const row = await getPublicLegalPage("terms");
  if (row) {
    return (
      <PublicLegalPageFromDb
        title={row.title}
        content={row.content}
        publishedAt={row.publishedAt}
      />
    );
  }
  return <TermsStaticFallback />;
}
