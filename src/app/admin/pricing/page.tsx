import {
  AdminPricingTabNav,
  isAdminPricingTab,
} from "@/components/admin/pricing/admin-pricing-tab-nav";
import { AdminPricingTabPanels } from "@/components/admin/pricing/admin-pricing-tab-panels";
import { hasPermission } from "@/lib/permissions";
import { requireAdminPagePermission } from "@/server/guards/admin-page-guard";
import { buildAdminPricingOverview } from "@/server/services/adminPricingOverview";
import {
  loadCardBuilderPricingForAdmin,
  loadKaspiManualForAdmin,
} from "@/server/services/adminPricingEditor";

export const metadata = {
  title: "Цены — админка QazCard AI",
  description: "Scenario-first hub: обзор цен, inline-редактирование тарифов и warnings.",
};

type PageProps = {
  searchParams?: Promise<{ tab?: string }>;
};

export default async function AdminPricingHubPage({ searchParams }: PageProps) {
  const adminUser = await requireAdminPagePermission("models.pricing.manage");

  const sp = (await searchParams) ?? {};
  const tabRaw = sp.tab?.trim();
  const tab = isAdminPricingTab(tabRaw) ? tabRaw : "overview";

  const [data, cardBuilderEditor, kaspiEditor] = await Promise.all([
    buildAdminPricingOverview(),
    loadCardBuilderPricingForAdmin(),
    loadKaspiManualForAdmin(),
  ]);

  const editPermissions = {
    cardBuilder: hasPermission(adminUser.role, "models.pricing.manage"),
    tokenPackages: hasPermission(adminUser.role, "token_packages.manage"),
    manualTopUp: hasPermission(adminUser.role, "settings.manage"),
  };

  const errorWarnings = data.warnings.filter((w) => w.severity === "error").length;
  const warningCount = data.warnings.length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Цены и токены</h1>
        <p className="text-muted-foreground mt-1 text-sm max-w-3xl">
          Единый обзор по сценариям и безопасное редактирование ключевых тарифов: card_builder,
          пакеты пополнения и Kaspi/WhatsApp. AI-модели и matrix pricing — через Pricing Studio.
        </p>
        {errorWarnings > 0 ? (
          <p className="text-destructive mt-2 text-sm font-medium">
            {errorWarnings} критичных предупреждений — см. вкладку Warnings.
          </p>
        ) : null}
      </div>

      <AdminPricingTabNav active={tab} warningCount={warningCount} />
      <AdminPricingTabPanels
        tab={tab}
        data={data}
        editPermissions={editPermissions}
        editor={{
          cardBuilder: cardBuilderEditor,
          kaspi: kaspiEditor,
        }}
      />
    </div>
  );
}
