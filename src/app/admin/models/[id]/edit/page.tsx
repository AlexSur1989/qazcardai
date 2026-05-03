import { notFound, redirect } from "next/navigation";

import { AdminModelEditTabs } from "@/components/admin/admin-model-edit-tabs";
import { fromDbModelToFormFields } from "@/lib/ai-model-form-mappers";
import { getAdminAiModelById } from "@/lib/ai-model-admin-queries";
import { getFreshAdminSessionUser } from "@/server/services/fresh-session-user";

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
  const session = await getFreshAdminSessionUser();
  if (!session.ok) {
    if (session.reason === "forbidden") {
      redirect("/dashboard");
    }
    redirect("/login?next=/admin/models");
  }
  const m = await getAdminAiModelById(id);
  if (!m) {
    notFound();
  }
  const canEditPricing = session.user.role === "SUPER_ADMIN";
  const canRunRealKie = session.user.role === "SUPER_ADMIN";
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
        }}
        canRunRealKie={canRunRealKie}
      />
    </div>
  );
}
