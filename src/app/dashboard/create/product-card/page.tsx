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



export const metadata = {

  title: "Создать карточку товара — QazCard AI",

};



export default async function ProductCardCreatePage() {

  const current = await getFreshSessionUser();

  if (!current.ok) {

    redirect("/login?next=/dashboard/create/product-card");

  }



  const [balanceCredits, productCardSettings, productVideoModels, modelSetup] =
    await Promise.all([
      getBalance(current.user.id),
      getProductCardSettings(),
      listActiveProductVideoModels(),
      getProductCardModelSetupOverview(),
    ]);

  const showAdminHints = isAdminRole(current.user.role);



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
          autoClassifyReady={modelSetup.byType.PRODUCT_CLASSIFIER.autoClassifyReady}
          classifierAdminHint={modelSetup.byType.PRODUCT_CLASSIFIER.adminHint}
          showAdminHints={showAdminHints}
        />

      </Suspense>

    </div>

  );

}


