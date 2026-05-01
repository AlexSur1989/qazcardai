import { AlertCircle } from "lucide-react";

import { LegalPagesSeedButton } from "@/components/admin/legal-pages-seed-button";
import { LegalPagesTable } from "@/components/admin/legal-pages-table";
import { PageHeader } from "@/components/layout/page-header";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { adminTerm } from "@/lib/admin-terms";
import { isSuperAdmin } from "@/lib/auth";
import { getAdminLegalPages } from "@/server/services/legalPages";
import { getFreshAdminSessionUser } from "@/server/services/fresh-session-user";

export const metadata = { title: "Юридические страницы — QazCard AI" };

export default async function AdminLegalPagesPage() {
  const session = await getFreshAdminSessionUser();
  if (!session.ok) {
    return (
      <Alert variant="destructive">
        <AlertCircle />
        <AlertTitle>Нет доступа</AlertTitle>
        <AlertDescription>Требуется роль администратора.</AlertDescription>
      </Alert>
    );
  }
  const items = await getAdminLegalPages();
  const rows = items.map((i) => ({
    slug: i.slug,
    title: i.title,
    status: i.status,
    version: i.version,
    publishedAt: i.publishedAt ? i.publishedAt.toISOString() : null,
    updatedAt: i.updatedAt.toISOString(),
  }));
  const canSeed = isSuperAdmin(session.user.role);

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <PageHeader
          title={adminTerm("legalPagesTitle")}
          description={adminTerm("legalPagesDescription")}
          breadcrumbs={[
            { label: "Админ", href: "/admin" },
            { label: adminTerm("legalPagesNav") },
          ]}
        />
        {canSeed ? <LegalPagesSeedButton /> : null}
      </div>
      {rows.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          Пока нет записей. {canSeed ? "Создайте страницы по умолчанию — кнопка выше." : "Обратитесь к супер-администратору."}
        </p>
      ) : null}
      <LegalPagesTable rows={rows} role={session.user.role} />
    </div>
  );
}
