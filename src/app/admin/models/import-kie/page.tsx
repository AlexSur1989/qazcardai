import { PageHeader } from "@/components/layout/page-header";
import { KieImportWizard } from "@/components/admin/kie-import-wizard";
import { requireAdminPagePermission } from "@/server/guards/admin-page-guard";

export const metadata = { title: "Import Kie.ai — QazCard AI" };

export default async function AdminImportKieModelPage() {
  await requireAdminPagePermission("models.manage");

  return (
    <div className="space-y-6">
      <PageHeader
        title="Добавить модель Kie.ai"
        description="Wizard: payload из docs → auto settingsSchema + payloadMapping → inactive модель."
        breadcrumbs={[
          { label: "Админ", href: "/admin" },
          { label: "Модели", href: "/admin/models" },
          { label: "Import Kie.ai" },
        ]}
      />
      <KieImportWizard />
    </div>
  );
}
