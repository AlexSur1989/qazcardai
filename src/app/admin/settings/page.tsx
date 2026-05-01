import { AlertCircle } from "lucide-react";

import { AdminSettingsCenter } from "@/components/admin/admin-settings-center";
import { PageHeader } from "@/components/layout/page-header";
import { Alert, AlertTitle } from "@/components/ui/alert";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { isSuperAdmin } from "@/lib/auth";
import { MODERATION_APP_SETTING_KEY } from "@/lib/moderation-defaults";
import { getAllAppSettingsForAdminResponse } from "@/server/services/appSettings";
import { getFreshAdminSessionUser } from "@/server/services/fresh-session-user";

export const metadata = { title: "Настройки / Settings — QazCard AI" };

export default async function AdminSettingsPage() {
  const session = await getFreshAdminSessionUser();
  if (!session.ok) {
    return (
      <Alert variant="destructive">
        <AlertCircle />
        <AlertTitle>Нет доступа</AlertTitle>
      </Alert>
    );
  }
  const canEdit = isSuperAdmin(session.user.role);

  const data = await getAllAppSettingsForAdminResponse();

  const settingsSnapshotKey = JSON.stringify(data.groups);

  return (
    <div className="space-y-8">
      <PageHeader
        title="Настройки / Settings"
        description="Управление параметрами приложения QazCard AI."
        breadcrumbs={[
          { label: "Админ", href: "/admin" },
          { label: "Настройки" },
        ]}
      />

      <Card className="border-border/80 shadow-sm">
        <CardHeader>
          <CardTitle className="text-base">Модерация промптов</CardTitle>
          <CardDescription>
            Системная запись с ключом{" "}
            <code className="text-xs">{MODERATION_APP_SETTING_KEY}</code> — JSON в
            AppSetting. Управляется отдельно от реестра ниже; удаление из панели
            отключено.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <pre className="bg-muted/60 overflow-x-auto rounded-md border p-3 font-mono text-xs">
{`{
  "enabled": true,
  "bannedSubstrings": ["..."]
}`}
          </pre>
        </CardContent>
      </Card>

      <AdminSettingsCenter
        key={settingsSnapshotKey}
        initialGroups={data.groups}
        canEdit={canEdit}
      />
    </div>
  );
}
