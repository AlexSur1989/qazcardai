import Link from "next/link";

import type { AdminPricingTabId } from "@/server/services/adminPricingOverview";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";

const TABS: { id: AdminPricingTabId; label: string }[] = [
  { id: "overview", label: "Обзор" },
  { id: "models", label: "AI-модели" },
  { id: "card-builder", label: "Создать карточку" },
  { id: "marketplace", label: "Карточка товара" },
  { id: "video", label: "Видео" },
  { id: "concepts", label: "Фото / концепты" },
  { id: "topup", label: "Пополнение" },
  { id: "warnings", label: "Warnings" },
];

type Props = {
  active: AdminPricingTabId;
  warningCount?: number;
};

export function AdminPricingTabNav({ active, warningCount = 0 }: Props) {
  return (
    <nav
      className="flex flex-wrap gap-1 border-b pb-2"
      aria-label="Разделы цен"
    >
      {TABS.map((t) => (
        <Link
          key={t.id}
          href={`/admin/pricing?tab=${t.id}`}
          className={cn(
            buttonVariants({
              variant: active === t.id ? "secondary" : "ghost",
              size: "sm",
            }),
            "relative",
          )}
        >
          {t.label}
          {t.id === "warnings" && warningCount > 0 ? (
            <span className="bg-destructive text-destructive-foreground ml-1.5 rounded-full px-1.5 py-0 text-[10px] font-medium">
              {warningCount}
            </span>
          ) : null}
        </Link>
      ))}
    </nav>
  );
}

export function isAdminPricingTab(v: string | undefined): v is AdminPricingTabId {
  return TABS.some((t) => t.id === v);
}
