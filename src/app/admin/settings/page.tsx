import { AppSettingsClientSection } from "@/components/admin/app-settings-client";
import { AdminEmpty } from "@/components/admin/admin-empty";
import { PageHeader } from "@/components/layout/page-header";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getAdminAppSettingsList } from "@/lib/admin-data";
import { MODERATION_APP_SETTING_KEY } from "@/lib/moderation-defaults";
import { AlertCircle } from "lucide-react";

export const metadata = { title: "Настройки — админ" };

export default async function AdminSettingsPage() {
  const res = await getAdminAppSettingsList();
  if (!res.ok) {
    return (
      <div className="space-y-4">
        <PageHeader
          title="Настройки приложения"
          breadcrumbs={[{ label: "Админ", href: "/admin" }, { label: "Настройки" }]}
        />
        <Alert variant="destructive">
          <AlertCircle />
          <AlertTitle>Ошибка загрузки</AlertTitle>
          <AlertDescription>Проверьте подключение к базе.</AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Настройки приложения"
        description={
          <>
            AppSetting: типы string, number, boolean, json. Поле{" "}
            <code className="text-xs">updatedBy</code> заполняется при изменениях через эту страницу.
          </>
        }
        breadcrumbs={[{ label: "Админ", href: "/admin" }, { label: "Настройки" }]}
      />

      <Card className="border-border/80 shadow-sm">
        <CardHeader>
          <CardTitle className="text-base">Модерация промптов</CardTitle>
          <CardDescription>
            Системная запись с ключом{" "}
            <code className="text-xs">{MODERATION_APP_SETTING_KEY}</code> — редактируйте как JSON
            (удаление из панели отключено). Пример value:
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

      {res.rows.length === 0 ? (
        <AdminEmpty
          title="Нет настроек"
          description="Создайте вручную или нажмите «Добавить отсутствующие примеры»."
        />
      ) : null}
      <AppSettingsClientSection
        rows={res.rows.map((r) => ({
          id: r.id,
          key: r.key,
          type: r.type,
          value: r.value,
          description: r.description,
          updatedAt: r.updatedAt.toISOString(),
          editor: r.editor,
        }))}
      />
    </div>
  );
}
