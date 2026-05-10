

import { SeoManagerForm } from "@/components/admin/seo-manager-form";
import { PageHeader } from "@/components/layout/page-header";
import { adminTerm } from "@/lib/admin-terms";
import { getSeoChecklist, getSeoSettings } from "@/server/services/seoSettings";
import { requireAdminPagePermission } from "@/server/guards/admin-page-guard";

export const metadata = { title: "SEO — QazCard AI" };

export default async function AdminSeoPage() {
  await requireAdminPagePermission("seo.manage");
  const canEdit = true;
  const [settings, checklist] = await Promise.all([getSeoSettings(), getSeoChecklist()]);
  const initial = { ...settings } as Record<string, unknown>;

  return (
    <div className="space-y-8">
      <PageHeader
        title={adminTerm("seoPageTitle")}
        description={adminTerm("seoPageDescription")}
        breadcrumbs={[
          { label: "Админ", href: "/admin" },
          { label: adminTerm("seoNav") },
        ]}
      />
      <SeoManagerForm initial={initial} checklist={checklist} canEdit={canEdit} />
    </div>
  );
}
