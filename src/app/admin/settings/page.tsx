
import { Suspense } from "react";

import { AdminSettingsCenter } from "@/components/admin/admin-settings-center";
import { PageHeader } from "@/components/layout/page-header";
import { hasPermission } from "@/lib/permissions";
import type { Permission } from "@/lib/permissions";
import { getAllAppSettingsForAdminResponse } from "@/server/services/appSettings";
import { requireAdminPagePermission } from "@/server/guards/admin-page-guard";

export const metadata = { title: "Настройки проекта — QazCard AI" };

export default async function AdminSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ advanced?: string }>;
}) {
  const user = await requireAdminPagePermission("settings.view");
  const canEdit = hasPermission(user.role, "settings.manage");
  const canEditCritical = hasPermission(user.role, "settings.critical.manage");
  const params = await searchParams;
  const showAdvanced = params.advanced === "1";

  const data = await getAllAppSettingsForAdminResponse();

  const linkPermissions: Partial<Record<Permission, boolean>> = {
    "models.pricing.manage": hasPermission(user.role, "models.pricing.manage"),
    "models.product_card.manage": hasPermission(user.role, "models.product_card.manage"),
    "seo.manage": hasPermission(user.role, "seo.manage"),
    "notifications.manage": hasPermission(user.role, "notifications.manage"),
    "legal.manage": hasPermission(user.role, "legal.manage"),
    "moderation.access": hasPermission(user.role, "moderation.access"),
  };

  const settingsSnapshotKey = JSON.stringify(data.groups);

  return (
    <div className="space-y-8">
      <PageHeader
        title={showAdvanced ? "Расширенные настройки" : "Настройки проекта"}
        description={
          showAdvanced
            ? "Все AppSettings с техническими параметрами. Меняйте только если понимаете последствия."
            : "Здесь собраны безопасные настройки. Технические параметры доступны в расширенном режиме."
        }
        breadcrumbs={[
          { label: "Админ", href: "/admin" },
          { label: showAdvanced ? "Расширенные настройки" : "Настройки проекта" },
        ]}
      />

      <Suspense fallback={null}>
        <AdminSettingsCenter
          key={settingsSnapshotKey}
          initialGroups={data.groups}
          canEdit={canEdit}
          canEditCritical={canEditCritical}
          linkPermissions={linkPermissions}
        />
      </Suspense>
    </div>
  );
}
