import Link from "next/link";

import { ClipboardList } from "lucide-react";

import { PageHeader } from "@/components/layout/page-header";
import { LaunchChecklistClient } from "@/components/admin/launch-checklist-client";
import { buildLaunchChecklist } from "@/server/services/launchChecklist";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Чек-лист запуска — QazCard AI",
};

export default async function AdminLaunchChecklistPage() {
  const initial = await buildLaunchChecklist();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Чек-лист запуска / Launch Checklist"
        description={
          <>
            Статус готовности сервиса к запуску. Только просмотр; изменения — в{" "}
            <Link className="text-primary underline-offset-4 hover:underline" href="/admin/settings">
              настройках
            </Link>
            ,{" "}
            <Link className="text-primary underline-offset-4 hover:underline" href="/admin/models">
              моделях
            </Link>{" "}
            и связанных разделах.
          </>
        }
      />

      <LaunchChecklistClient initial={initial} />

      <p className="text-muted-foreground flex items-start gap-2 text-xs">
        <ClipboardList className="mt-0.5 size-3.5 shrink-0" aria-hidden />
        Доступно ролям ADMIN и SUPER_ADMIN. Секреты и значения переменных окружения не
        отображаются.
      </p>
    </div>
  );
}
