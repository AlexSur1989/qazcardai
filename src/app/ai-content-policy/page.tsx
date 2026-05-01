import type { Metadata } from "next";

import { PublicLegalPageFromDb } from "@/components/legal/public-legal-page-from-db";
import { AiContentPolicyStaticFallback } from "@/components/legal/static-fallbacks";
import { getPublicLegalPage } from "@/server/services/legalPages";

export const dynamic = "force-dynamic";

const fallbackMeta: Metadata = {
  title: "Политика в отношении ИИ-контента — QazCard AI",
  description:
    "Правила в отношении контента, создаваемого с помощью ИИ, и запрещённого контента (шаблон).",
};

export async function generateMetadata(): Promise<Metadata> {
  const row = await getPublicLegalPage("ai-content-policy");
  if (row) {
    return {
      title: `${row.title} — QazCard AI`,
      description: "Политика AI-контента QazCard AI.",
    };
  }
  return fallbackMeta;
}

export default async function AiContentPolicyPage() {
  const row = await getPublicLegalPage("ai-content-policy");
  if (row) {
    return (
      <PublicLegalPageFromDb
        title={row.title}
        content={row.content}
        publishedAt={row.publishedAt}
      />
    );
  }
  return <AiContentPolicyStaticFallback />;
}
