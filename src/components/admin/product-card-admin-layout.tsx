"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";

import { Button } from "@/components/ui/button";
import {
  PRODUCT_CARD_ADVANCED_TABS,
  PRODUCT_CARD_MAIN_TABS,
  type ProductCardTabId,
} from "@/lib/product-card-admin-meta";
import { cn } from "@/lib/utils";

type Props = {
  activeTab: ProductCardTabId;
  showAdvanced: boolean;
  canToggleAdvanced: boolean;
};

function tabHref(tab: string, advanced: boolean): string {
  const params = new URLSearchParams();
  params.set("tab", tab);
  if (advanced) params.set("advanced", "1");
  return `/admin/product-card?${params.toString()}`;
}

export function ProductCardAdminLayout({
  activeTab,
  showAdvanced,
  canToggleAdvanced,
}: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function toggleAdvanced() {
    const next = !showAdvanced;
    const params = new URLSearchParams(searchParams.toString());
    if (next) {
      params.set("advanced", "1");
      if (!PRODUCT_CARD_ADVANCED_TABS.some((t) => t.id === activeTab)) {
        params.set("tab", "settings");
      }
    } else {
      params.delete("advanced");
      if (PRODUCT_CARD_ADVANCED_TABS.some((t) => t.id === activeTab)) {
        params.set("tab", "overview");
      }
    }
    router.push(`/admin/product-card?${params.toString()}`);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {PRODUCT_CARD_MAIN_TABS.map(({ id, label }) => (
          <Link
            key={id}
            href={tabHref(id, false)}
            className={cn(
              "rounded-full border px-3 py-1 text-xs",
              activeTab === id && !showAdvanced
                ? "bg-primary text-primary-foreground border-primary"
                : activeTab === id && showAdvanced
                  ? "border-primary/40 bg-primary/10 text-foreground"
                  : "border-border bg-background text-foreground",
            )}
          >
            {label}
          </Link>
        ))}
        {canToggleAdvanced ? (
          <Button
            type="button"
            size="sm"
            variant={showAdvanced ? "secondary" : "outline"}
            className="ml-auto h-7 text-xs"
            onClick={toggleAdvanced}
          >
            {showAdvanced ? "Скрыть расширенные" : "Расширенные настройки"}
          </Button>
        ) : null}
      </div>

      {showAdvanced && canToggleAdvanced ? (
        <div className="rounded-lg border border-dashed border-amber-300/80 bg-amber-50/40 p-3 dark:bg-amber-950/20">
          <p className="text-muted-foreground mb-2 text-xs font-medium uppercase tracking-wide">
            Расширенные настройки для разработчика
          </p>
          <div className="flex flex-wrap gap-2">
            {PRODUCT_CARD_ADVANCED_TABS.map(({ id, label }) => (
              <Link
                key={id}
                href={tabHref(id, true)}
                className={cn(
                  "rounded-full border px-3 py-1 text-xs",
                  activeTab === id
                    ? "bg-secondary text-secondary-foreground border-secondary"
                    : "border-border bg-background text-foreground",
                )}
              >
                {label}
              </Link>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
