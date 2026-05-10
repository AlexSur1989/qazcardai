import { AdminModerationCenter } from "@/components/admin/admin-moderation-center";
import { PageHeader } from "@/components/layout/page-header";
import { MODERATION_APP_SETTING_KEYS } from "@/lib/moderation-app-settings";
import { getAppSetting } from "@/server/services/appSettings";
import { requireAdminPagePermission } from "@/server/guards/admin-page-guard";

export const metadata = { title: "Модерация / Moderation — QazCard AI" };

export default async function AdminModerationPage() {
  const session = await requireAdminPagePermission("moderation.access");
  const initialSettings: Record<string, unknown> = {};
  for (const k of MODERATION_APP_SETTING_KEYS) {
    initialSettings[k] = await getAppSetting(k);
  }
  return (
    <div className="space-y-8">
      <PageHeader
        title="Модерация / Moderation Center"
        description="Правила проверки prompt и лог заблокированных генераций."
        breadcrumbs={[
          { label: "Админ", href: "/admin" },
          { label: "Модерация" },
        ]}
      />
      <AdminModerationCenter
        initialRole={session.role}
        initialSettings={initialSettings}
      />
    </div>
  );
}
