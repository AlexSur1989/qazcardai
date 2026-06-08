"use client";

import { AiModelForm } from "@/components/admin/ai-model-form";
import {
  ModelTestPanel,
  type AdminModelTestPanelModel,
} from "@/components/admin/model-test-panel";
import { ModelPricingStudio } from "@/components/admin/model-pricing-studio";
import type { AiModelFormFieldValues } from "@/lib/ai-model-form-mappers";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

type PricingModel = {
  id: string;
  name: string;
  slug: string;
  apiModelId: string;
  provider: string;
  type: string;
  costCredits: number;
  pricingSchema: unknown;
};

type Props = {
  form: {
    modelId: string;
    initialData: AiModelFormFieldValues;
  };
  pricingModel: PricingModel;
  canEditPricing: boolean;
  testModel: AdminModelTestPanelModel;
  canRunRealKie: boolean;
  mockKieEnabled: boolean;
  kieApiKeyConfigured: boolean;
};

export function AdminModelEditTabs({
  form,
  pricingModel,
  canEditPricing,
  testModel,
  canRunRealKie,
  mockKieEnabled,
  kieApiKeyConfigured,
}: Props) {
  return (
    <Tabs defaultValue="form" className="gap-6">
      <TabsList>
        <TabsTrigger value="form">Основное</TabsTrigger>
        <TabsTrigger value="pricing">Цены и токены</TabsTrigger>
        <TabsTrigger value="test">Тест модели</TabsTrigger>
      </TabsList>
      <TabsContent value="form" className="pt-2">
        <AiModelForm
          mode="edit"
          modelId={form.modelId}
          initialData={form.initialData}
        />
      </TabsContent>
      <TabsContent value="pricing" className="pt-2">
        <ModelPricingStudio
          key={pricingModel.id}
          model={pricingModel}
          canEdit={canEditPricing}
        />
      </TabsContent>
      <TabsContent value="test" className="pt-2">
        <ModelTestPanel
          key={testModel.id}
          model={testModel}
          canRunRealKie={canRunRealKie}
          mockKieEnabled={mockKieEnabled}
          kieApiKeyConfigured={kieApiKeyConfigured}
        />
      </TabsContent>
    </Tabs>
  );
}
