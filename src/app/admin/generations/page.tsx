import { AdminEmpty } from "@/components/admin/admin-empty";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getAdminGenerationsList } from "@/lib/admin-data";
import { formatAdminDateTime, truncate } from "@/lib/admin-format";
import { generationStatusLabel } from "@/lib/generation-labels";
import { AlertCircle } from "lucide-react";

export const metadata = { title: "Генерации — админ" };

export default async function AdminGenerationsPage() {
  const res = await getAdminGenerationsList();
  if (!res.ok) {
    return (
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Генерации</h1>
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
        <h1 className="text-2xl font-semibold tracking-tight">Генерации</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Все запросы пользователей к провайдеру.
        </p>
        <div className="mt-6">
          <AdminEmpty title="Генераций нет" description="Список заполнится после этапа генерации." />
        </div>
      </div>
    );
  }
  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">Генерации</h1>
      <p className="text-muted-foreground mt-1 text-sm">
        До 50 последних, новые сверху.
      </p>
      <div className="mt-6 overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Пользователь</TableHead>
              <TableHead>Модель</TableHead>
              <TableHead>Тип</TableHead>
              <TableHead>Статус</TableHead>
              <TableHead>Промпт</TableHead>
              <TableHead className="text-right">Кр.</TableHead>
              <TableHead>Создана</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {res.rows.map((g) => (
              <TableRow key={g.id}>
                <TableCell className="max-w-[8rem] truncate text-xs">
                  {g.user.email}
                </TableCell>
                <TableCell className="max-w-[6rem] truncate text-xs">
                  {g.model.name}
                </TableCell>
                <TableCell className="text-xs">{g.type}</TableCell>
                <TableCell>
                  <Badge variant="outline" className="text-xs">
                    {generationStatusLabel(g.status)}
                  </Badge>
                </TableCell>
                <TableCell
                  className="text-muted-foreground max-w-[12rem] text-xs"
                  title={g.prompt}
                >
                  {truncate(g.prompt, 48)}
                </TableCell>
                <TableCell className="text-right text-xs tabular-nums">
                  {g.costCredits}
                </TableCell>
                <TableCell className="whitespace-nowrap text-xs">
                  {formatAdminDateTime(g.createdAt)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
