import { AdminEmpty } from "@/components/admin/admin-empty";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getAdminAppSettingsList } from "@/lib/admin-data";
import { formatAdminDateTime, truncate } from "@/lib/admin-format";
import { AlertCircle } from "lucide-react";

export const metadata = { title: "Настройки — админ" };

export default async function AdminSettingsPage() {
  const res = await getAdminAppSettingsList();
  if (!res.ok) {
    return (
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Настройки приложения</h1>
        <Alert className="mt-4" variant="destructive">
          <AlertCircle />
          <AlertTitle>Ошибка загрузки</AlertTitle>
          <AlertDescription>Проверьте подключение к базе.</AlertDescription>
        </Alert>
      </div>
    );
  }
  if (res.rows.length === 0) {
    return (
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Настройки приложения</h1>
        <p className="text-muted-foreground mt-1 text-sm">Ключи и значения AppSetting.</p>
        <div className="mt-6">
          <AdminEmpty
            title="Нет настроек в базе"
            description="Сид и CRUD — на этапе 19 (план)."
          />
        </div>
      </div>
    );
  }
  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">Настройки приложения</h1>
      <p className="text-muted-foreground mt-1 text-sm">
        Просмотр. Редактирование — в следующем этапе.
      </p>
      <div className="mt-6 overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Ключ</TableHead>
              <TableHead>Тип</TableHead>
              <TableHead>Значение (JSON)</TableHead>
              <TableHead>Описание</TableHead>
              <TableHead>Обновлён</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {res.rows.map((s) => (
              <TableRow key={s.id}>
                <TableCell className="font-mono text-xs">{s.key}</TableCell>
                <TableCell className="text-xs">{s.type}</TableCell>
                <TableCell
                  className="text-muted-foreground max-w-xs text-xs"
                  title={JSON.stringify(s.value)}
                >
                  {truncate(JSON.stringify(s.value), 64)}
                </TableCell>
                <TableCell className="text-muted-foreground max-w-xs text-xs">
                  {s.description ? truncate(s.description, 64) : "—"}
                </TableCell>
                <TableCell className="whitespace-nowrap text-xs">
                  {formatAdminDateTime(s.updatedAt)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
