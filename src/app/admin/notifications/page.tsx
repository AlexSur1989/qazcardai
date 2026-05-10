import { AdminNotificationsPage } from "@/components/admin/admin-notifications-page";
import { PageHeader } from "@/components/layout/page-header";
import { adminTerm } from "@/lib/admin-terms";
import { getEmailTemplates } from "@/server/services/emailTemplates";
import { getNotificationAdminState } from "@/server/services/notificationSettings";
import { requireAdminPagePermission } from "@/server/guards/admin-page-guard";

export const metadata = { title: "Уведомления — QazCard AI" };

export default async function AdminNotificationsPageRoute() {
  await requireAdminPagePermission("notifications.manage");
  const canEdit = true;
  const [state, templates] = await Promise.all([
    getNotificationAdminState(),
    getEmailTemplates(),
  ]);
  return (
    <div className="space-y-8">
      <PageHeader
        title={adminTerm("notifPageTitle")}
        description={adminTerm("notifPageDescription")}
        breadcrumbs={[
          { label: "Админ", href: "/admin" },
          { label: adminTerm("notifNav") },
        ]}
      />
      <AdminNotificationsPage
        canEdit={canEdit}
        initial={{ ...state, templates }}
      />
    </div>
  );
}
