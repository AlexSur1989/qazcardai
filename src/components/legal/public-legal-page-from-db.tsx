import { LegalPageLayout } from "@/components/layout/legal-page-layout";

type Props = {
  title: string;
  publishedAt: Date;
  content: string;
};

function formatDateRu(d: Date): string {
  try {
    return d.toLocaleDateString("ru-RU", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  } catch {
    return d.toISOString().slice(0, 10);
  }
}

/**
 * Публичный просмотр опубликованной юридической страницы из БД.
 * Контент — plain text, без HTML; React экранирует вывод.
 */
export function PublicLegalPageFromDb({ title, publishedAt, content }: Props) {
  return (
    <LegalPageLayout
      title={title}
      lastUpdatedLabel={`Опубликовано: ${formatDateRu(publishedAt)}`}
    >
      <div className="whitespace-pre-wrap text-muted-foreground text-sm leading-relaxed md:text-base">
        {content}
      </div>
    </LegalPageLayout>
  );
}
