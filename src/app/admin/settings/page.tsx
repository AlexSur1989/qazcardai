
import { AdminSettingsCenter } from "@/components/admin/admin-settings-center";
import { PageHeader } from "@/components/layout/page-header";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { hasPermission } from "@/lib/permissions";
import { MODERATION_APP_SETTING_KEY } from "@/lib/moderation-defaults";
import { getAllAppSettingsForAdminResponse } from "@/server/services/appSettings";
import { requireAdminPagePermission } from "@/server/guards/admin-page-guard";

export const metadata = { title: "Настройки системы — QazCard AI" };

export default async function AdminSettingsPage() {
  const user = await requireAdminPagePermission("settings.view");
  const canEdit = hasPermission(user.role, "settings.manage");
  const canEditCritical = hasPermission(user.role, "settings.critical.manage");

  const data = await getAllAppSettingsForAdminResponse();

  const settingsSnapshotKey = JSON.stringify(data.groups);

  return (
    <div className="space-y-8">
      <PageHeader
        title="Настройки системы"
        description="Расширенные параметры приложения. Изменение некоторых значений может повлиять на генерации и биллинг."
        breadcrumbs={[
          { label: "Админ", href: "/admin" },
          { label: "Настройки системы" },
        ]}
      />

      <Alert>
        <AlertTitle>Для разработчиков и суперадминов</AlertTitle>
        <AlertDescription>
          Расширенные настройки. Изменение некоторых параметров может сломать генерации.
          Тарифы и цены для клиентов — в разделе{" "}
          <a href="/admin/pricing" className="underline">
            Цены и тарифы
          </a>
          .
        </AlertDescription>
      </Alert>

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
        canEditCritical={canEditCritical}
      />
    </div>
  );
}
