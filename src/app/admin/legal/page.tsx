
import { LegalPagesSeedButton } from "@/components/admin/legal-pages-seed-button";
import { LegalPagesTable } from "@/components/admin/legal-pages-table";
import { PageHeader } from "@/components/layout/page-header";
import { adminTerm } from "@/lib/admin-terms";
import { getAdminLegalPages } from "@/server/services/legalPages";
import { requireAdminPagePermission } from "@/server/guards/admin-page-guard";

export const metadata = { title: "Юридические страницы — QazCard AI" };

export default async function AdminLegalPagesPage() {
  const user = await requireAdminPagePermission("legal.manage");

  const items = await getAdminLegalPages();
  const rows = items.map((i) => ({
    slug: i.slug,
    title: i.title,
    status: i.status,
    version: i.version,
    publishedAt: i.publishedAt ? i.publishedAt.toISOString() : null,
    updatedAt: i.updatedAt.toISOString(),
  }));
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
        <LegalPagesSeedButton />
      </div>
      {rows.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          Пока нет записей. Создайте страницы по умолчанию — кнопка выше.
        </p>
      ) : null}
      <LegalPagesTable rows={rows} role={user.role} />
    </div>
  );
}
