import Link from "next/link";

import {
  AdminPricingTabNav,
  isAdminPricingTab,
} from "@/components/admin/pricing/admin-pricing-tab-nav";
import { AdminPricingTabPanels } from "@/components/admin/pricing/admin-pricing-tab-panels";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { hasPermission } from "@/lib/permissions";
import { requireAdminPagePermission } from "@/server/guards/admin-page-guard";
import { buildAdminPricingOverview } from "@/server/services/adminPricingOverview";
import {
  loadCardBuilderPricingForAdmin,
  loadKaspiManualForAdmin,
} from "@/server/services/adminPricingEditor";
import { loadProductCardVideoPricingForAdmin } from "@/server/services/adminProductCardVideoPricingEditor";

export const metadata = {
  title: "Цены и тарифы — админка QazCard AI",
  description: "Обзор цен, inline-редактирование тарифов и warnings.",
};

type PageProps = {
  searchParams?: Promise<{ tab?: string }>;
};

export default async function AdminPricingHubPage({ searchParams }: PageProps) {
  const adminUser = await requireAdminPagePermission("models.pricing.manage");

  const sp = (await searchParams) ?? {};
  const tabRaw = sp.tab?.trim();
  const tab = isAdminPricingTab(tabRaw) ? tabRaw : "overview";

  const [data, cardBuilderEditor, kaspiEditor, productCardVideoEditor] = await Promise.all([
    buildAdminPricingOverview(),
    loadCardBuilderPricingForAdmin(),
    loadKaspiManualForAdmin(),
    loadProductCardVideoPricingForAdmin(),
  ]);

  const editPermissions = {
    cardBuilder: hasPermission(adminUser.role, "models.pricing.manage"),
    tokenPackages: hasPermission(adminUser.role, "token_packages.manage"),
    manualTopUp: hasPermission(adminUser.role, "settings.manage"),
    productCardVideo: hasPermission(adminUser.role, "models.pricing.manage"),
  };

  const errorWarnings = data.warnings.filter((w) => w.severity === "error").length;
  const warningCount = data.warnings.length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Цены и тарифы</h1>
        <p className="text-muted-foreground mt-1 text-sm max-w-3xl">
          Здесь меняются цены, которые видит клиент.
        </p>
        {errorWarnings > 0 ? (
          <p className="text-destructive mt-2 text-sm font-medium">
            {errorWarnings} критичных предупреждений — см. вкладку Warnings.
          </p>
        ) : null}
      </div>

      <Alert>
        <AlertTitle>Подсказки по разделам</AlertTitle>
        <AlertDescription className="space-y-1 text-sm">
          <p>AI-модели — технические цены и себестоимость.</p>
          <p>
            <Link href="/admin/pricing?tab=card-builder" className="underline">
              Создать карточку
            </Link>{" "}
            — тарифы слайдов и галерей.
          </p>
          <p>
            <Link href="/admin/pricing?tab=topup" className="underline">
              Пополнение
            </Link>{" "}
            — пакеты токенов, Kaspi и WhatsApp.
          </p>
        </AlertDescription>
      </Alert>

      <AdminPricingTabNav active={tab} warningCount={warningCount} />
      <AdminPricingTabPanels
        tab={tab}
        data={data}
        editPermissions={editPermissions}
        editor={{
          cardBuilder: cardBuilderEditor,
          kaspi: kaspiEditor,
          productCardVideo: productCardVideoEditor,
        }}
      />
    </div>
  );
}
