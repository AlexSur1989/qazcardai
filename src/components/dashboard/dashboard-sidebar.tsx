import { DashboardSidebarNav } from "@/components/dashboard/dashboard-sidebar-nav";
import { getAppName } from "@/lib/app-name";
import { cn } from "@/lib/utils";

type DashboardSidebarProps = {
  userEmail: string;
};

/**
 * Сайдбар: блок бренда/email на сервере, навигация в клиентском поддереве для подсветки текущего раздела.
 */
export function DashboardSidebar({ userEmail }: DashboardSidebarProps) {
  return (
    <aside
      className={cn(
        "border-border bg-white/90 text-sidebar-foreground flex w-full shrink-0 flex-col border-b backdrop-blur-md supports-[backdrop-filter]:bg-white/80",
        "md:sticky md:top-0 md:h-screen md:w-56 md:shrink-0 md:overflow-y-auto md:border-r md:border-b-0",
      )}
    >
      <div className="border-border flex flex-col gap-0.5 border-b px-3 py-2.5 md:border-b-0 md:px-2 md:pt-3">
        <span className="text-foreground text-sm font-semibold tracking-tight">
          {getAppName()}
        </span>
        <span className="text-muted-foreground text-xs md:hidden">
          Личный кабинет
        </span>
      </div>
      <p className="text-sidebar-foreground/80 hidden px-3 py-1 text-xs break-all md:block md:px-2">
        {userEmail}
      </p>
      <DashboardSidebarNav />
    </aside>
  );
}
