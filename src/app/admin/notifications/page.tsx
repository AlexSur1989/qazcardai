import { AdminNotificationsPage } from "@/components/admin/admin-notifications-page";
import { PageHeader } from "@/components/layout/page-header";
import { adminTerm } from "@/lib/admin-terms";
import { isSuperAdmin } from "@/lib/auth";
import { getEmailTemplates } from "@/server/services/emailTemplates";
import { getNotificationAdminState } from "@/server/services/notificationSettings";
import { getFreshAdminSessionUser } from "@/server/services/fresh-session-user";

export const metadata = { title: "Уведомления — QazCard AI" };

export default async function AdminNotificationsPageRoute() {
  const session = await getFreshAdminSessionUser();
  if (!session.ok) {
    return (
      <p className="text-muted-foreground text-sm">Нет доступа</p>
    );
  }
  const canEdit = isSuperAdmin(session.user.role);
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
