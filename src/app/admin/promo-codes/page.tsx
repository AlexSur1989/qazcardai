import { AdminEmpty } from "@/components/admin/admin-empty";
import { PromoCodesClientTable } from "@/components/admin/promo-codes-client";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { getAdminPromoCodesList } from "@/lib/admin-data";
import { requireAdminPagePermission } from "@/server/guards/admin-page-guard";
import { AlertCircle } from "lucide-react";

export const metadata = { title: "Промокоды — QazCard AI" };

export default async function AdminPromoCodesPage() {
  await requireAdminPagePermission("promocodes.manage");
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
  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">Промокоды</h1>
      <p className="text-muted-foreground mt-1 text-sm">
        Создание и правка пишут аудит <code className="text-xs">promo_code.*</code>.
      </p>
      {res.rows.length === 0 ? (
        <div className="mt-6">
          <AdminEmpty
            title="Промокодов нет"
            description="Создайте первую запись формой ниже."
          />
        </div>
      ) : null}
      <div className="mt-6">
        <PromoCodesClientTable rows={res.rows} />
      </div>
    </div>
  );
}
