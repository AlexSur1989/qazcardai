import type { Metadata } from "next";

import { PublicLegalPageFromDb } from "@/components/legal/public-legal-page-from-db";
import { CopyrightPolicyStaticFallback } from "@/components/legal/static-fallbacks";
import { getPublicLegalPage } from "@/server/services/legalPages";

export const dynamic = "force-dynamic";

const fallbackMeta: Metadata = {
  title: "Политика в отношении авторского права — QazCard AI",
  description: "Черновик политики в отношении авторских прав и обращений (шаблон).",
};

export async function generateMetadata(): Promise<Metadata> {
  const row = await getPublicLegalPage("copyright-policy");
  if (row) {
    return {
      title: `${row.title} — QazCard AI`,
      description: "Политика авторских прав QazCard AI.",
    };
  }
  return fallbackMeta;
}

export default async function CopyrightPolicyPage() {
  const row = await getPublicLegalPage("copyright-policy");
  if (row) {
    return (
      <PublicLegalPageFromDb
        title={row.title}
        content={row.content}
        publishedAt={row.publishedAt}
      />
    );
  }
  return <CopyrightPolicyStaticFallback />;
}
