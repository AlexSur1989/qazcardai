

import { notFound } from "next/navigation";

import { AdminModelEditTabs } from "@/components/admin/admin-model-edit-tabs";
import { fromDbModelToFormFields } from "@/lib/ai-model-form-mappers";
import { getAdminAiModelById } from "@/lib/ai-model-admin-queries";
import { hasPermission } from "@/lib/permissions";
import { isMockKie } from "@/lib/kie-mock";
import { requireAdminPagePermission } from "@/server/guards/admin-page-guard";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props) {
  const { id } = await params;
  const m = await getAdminAiModelById(id);
  if (!m) {
    return { title: "Модель не найдена" };
  }
  return { title: `${m.name} — редактирование` };
}

export default async function AdminEditModelPage({ params }: Props) {
  const { id } = await params;
  const sessionUser = await requireAdminPagePermission("models.manage");

  const m = await getAdminAiModelById(id);
  if (!m) {
    notFound();
  }
  const canEditPricing = hasPermission(sessionUser.role, "models.pricing.manage");
  const canRunRealKie = hasPermission(sessionUser.role, "providers.manage");
  const mockKieEnabled = isMockKie();
  const kieApiKeyConfigured = Boolean(process.env.KIE_API_KEY?.trim());
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Редактирование</h1>
        <p className="text-foreground text-sm font-medium">{m.name}</p>
        <p className="text-muted-foreground mt-1 font-mono text-xs">id: {m.id}</p>
      </div>
      <AdminModelEditTabs
        form={{
          modelId: m.id,
          initialData: fromDbModelToFormFields(m),
        }}
        pricingModel={{
          id: m.id,
          name: m.name,
          slug: m.slug,
          apiModelId: m.apiModelId,
          provider: m.provider,
          type: m.type,
          costCredits: m.costCredits,
          pricingSchema: m.pricingSchema,
        }}
        canEditPricing={canEditPricing}
        testModel={{
          id: m.id,
          name: m.name,
          slug: m.slug,
          provider: m.provider,
          type: m.type,
          apiModelId: m.apiModelId,
          endpoint: m.endpoint,
          statusEndpoint: m.statusEndpoint,
          isActive: m.isActive,
          settingsSchema: m.settingsSchema,
          productCardModelType: m.productCardModelType,
        }}
        canRunRealKie={canRunRealKie}
        mockKieEnabled={mockKieEnabled}
        kieApiKeyConfigured={kieApiKeyConfigured}
      />
    </div>
  );
}
