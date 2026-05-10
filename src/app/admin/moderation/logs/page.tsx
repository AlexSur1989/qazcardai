import { AdminModerationCenter } from "@/components/admin/admin-moderation-center";
import { PageHeader } from "@/components/layout/page-header";
import { requireAdminPagePermission } from "@/server/guards/admin-page-guard";

export const metadata = { title: "Логи модерации — QazCard AI" };

export default async function AdminModerationLogsPage() {
  const user = await requireAdminPagePermission("moderation.logs_view");

  return (
    <div className="space-y-8">
      <PageHeader
        title="Логи модерации / Moderation logs"
        description="История блокировок и срабатываний правил."
        breadcrumbs={[
          { label: "Админ", href: "/admin" },
          { label: "Модерация", href: "/admin/moderation" },
          { label: "Логи" },
        ]}
      />
      <AdminModerationCenter
        initialRole={user.role}
        initialSettings={{}}
        logsOnly
      />
    </div>
  );
}
