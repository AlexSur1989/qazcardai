import { redirect } from "next/navigation";
import { Suspense } from "react";

import { CreateFormSkeleton } from "@/components/dashboard/create-form-skeleton";
import { ProductCardPage } from "@/components/dashboard/product-card/product-card-page";
import { PageHeader } from "@/components/layout/page-header";
import { canAccessAdminPanel } from "@/lib/auth";
import { getBalance } from "@/server/services/credits";
import { getFreshSessionUser } from "@/server/services/fresh-session-user";
import { getProductCardScenarios } from "@/server/services/productCardScenarios";
import { getProductCardSettings } from "@/server/services/productCardSettings";

export const metadata = {
  title: "Создать карточку товара — QazCard AI",
};

export default async function ProductCardCreatePage() {
  const current = await getFreshSessionUser();
  if (!current.ok) {
    redirect("/login?next=/dashboard/create/product-card");
  }

  const [balanceCredits, productCardSettings, scenarios] = await Promise.all([
    getBalance(current.user.id),
    getProductCardSettings(),
    getProductCardScenarios(),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        variant="qaz"
        title="Создать карточку товара"
        description="Загрузите фото товара, уточните категорию, затем сгенерируйте фото с концепциями, карточку для витрин и видео."
        breadcrumbs={[
          { label: "Кабинет", href: "/dashboard" },
          { label: "Создать карточку товара" },
        ]}
      />
      <Suspense fallback={<CreateFormSkeleton />}>
        <ProductCardPage
          balanceCredits={balanceCredits}
          conceptImageSizes={productCardSettings.conceptImageSizes}
          marketplaceCardSizes={productCardSettings.marketplaceCardSizes}
          videoPresets={productCardSettings.videoPresets}
          scenarios={scenarios}
          canMarketplaceLayoutDebug={canAccessAdminPanel(current.user.role)}
        />
      </Suspense>
    </div>
  );
}
