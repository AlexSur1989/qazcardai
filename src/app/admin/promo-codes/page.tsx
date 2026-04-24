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
import { getAdminPromoCodesList } from "@/lib/admin-data";
import { formatAdminDateTime } from "@/lib/admin-format";
import { AlertCircle } from "lucide-react";

export const metadata = { title: "Промокоды — админ" };

export default async function AdminPromoCodesPage() {
  const res = await getAdminPromoCodesList();
  if (!res.ok) {
    return (
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Промокоды</h1>
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
        <h1 className="text-2xl font-semibold tracking-tight">Промокоды</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Скидки и бонусные кредиты.
        </p>
        <div className="mt-6">
          <AdminEmpty
            title="Промокодов нет"
            description="CRUD — на этапе с промо и бонусами."
          />
        </div>
      </div>
    );
  }
  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">Промокоды</h1>
      <p className="text-muted-foreground mt-1 text-sm">До 50 записей.</p>
      <div className="mt-6 overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Код</TableHead>
              <TableHead>Тип</TableHead>
              <TableHead>Значение</TableHead>
              <TableHead>Исп. / макс</TableHead>
              <TableHead>Активен</TableHead>
              <TableHead>Истекает</TableHead>
              <TableHead>Создан</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {res.rows.map((p) => (
              <TableRow key={p.id}>
                <TableCell className="font-mono text-xs">{p.code}</TableCell>
                <TableCell className="text-xs">{p.type}</TableCell>
                <TableCell className="text-xs tabular-nums">
                  {p.value.toString()}
                </TableCell>
                <TableCell className="text-xs">
                  {p.usedCount}
                  {p.maxUses != null ? ` / ${p.maxUses}` : ""}
                </TableCell>
                <TableCell className="text-xs">{p.isActive ? "да" : "нет"}</TableCell>
                <TableCell className="whitespace-nowrap text-xs">
                  {p.expiresAt ? formatAdminDateTime(p.expiresAt) : "—"}
                </TableCell>
                <TableCell className="whitespace-nowrap text-xs">
                  {formatAdminDateTime(p.createdAt)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
