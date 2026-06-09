import { redirect } from "next/navigation";

import { Suspense } from "react";



import { CreateFormSkeleton } from "@/components/dashboard/create-form-skeleton";

import { ProductCardPage } from "@/components/dashboard/product-card/product-card-page";

import { PageHeader } from "@/components/layout/page-header";

import { canAccessAdminPanel } from "@/lib/auth";
import { isAdminRole } from "@/lib/permissions";
import { getBalance } from "@/server/services/credits";
import { getFreshSessionUser } from "@/server/services/fresh-session-user";
import { getProductCardSettings } from "@/server/services/productCardSettings";
import { listActiveProductVideoModels } from "@/server/services/productCardModelResolver";
import { getProductCardModelSetupOverview } from "@/server/services/productCardModelSetup";
import {
  getProductClassifierCommercialSettings,
  resolveClassifierAccessForUser,
} from "@/server/services/productClassifierCommercialSettings";



export const metadata = {

  title: "Создать карточку товара — QazCard AI",

};



type Props = {
  searchParams?: Promise<{ classifierMock?: string }>;
};

export default async function ProductCardCreatePage({ searchParams }: Props) {

  const current = await getFreshSessionUser();

  if (!current.ok) {

    redirect("/login?next=/dashboard/create/product-card");

  }



  const [balanceCredits, productCardSettings, productVideoModels, modelSetup, commercial] =
    await Promise.all([
      getBalance(current.user.id),
      getProductCardSettings(),
      listActiveProductVideoModels(),
      getProductCardModelSetupOverview(),
      getProductClassifierCommercialSettings(),
    ]);

  const classifierAccess = resolveClassifierAccessForUser({
    role: current.user.role,
    balanceCredits,
    commercial,
    modelSlot: modelSetup.byType.PRODUCT_CLASSIFIER,
  });

  const showAdminHints = isAdminRole(current.user.role);

  const params = await searchParams;
  const classifierDevMock =
    process.env.NODE_ENV === "development" ? params?.classifierMock?.trim() || null : null;



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
          scenarios={productCardSettings.scenarios}
          conceptImageSizes={productCardSettings.conceptImageSizes}
          marketplaceCardSizes={productCardSettings.marketplaceCardSizes}
          videoPresets={productCardSettings.videoPresets}
          productVideoModels={productVideoModels}
          defaultProductVideoModelSlug={productCardSettings.videoModelSlug}
          canMarketplaceLayoutDebug={canAccessAdminPanel(current.user.role)}
          modelSetupByScenario={modelSetup.byScenario}
          classifierAccess={classifierAccess}
          classifierAdminHint={modelSetup.byType.PRODUCT_CLASSIFIER.adminHint}
          showAdminHints={showAdminHints}
          classifierDevMock={classifierDevMock}
        />

      </Suspense>

    </div>

  );

}


