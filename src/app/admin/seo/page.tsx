import { AlertCircle } from "lucide-react";

import { SeoManagerForm } from "@/components/admin/seo-manager-form";
import { PageHeader } from "@/components/layout/page-header";
import { adminTerm } from "@/lib/admin-terms";
import { isSuperAdmin } from "@/lib/auth";
import { getSeoChecklist, getSeoSettings } from "@/server/services/seoSettings";
import { getFreshAdminSessionUser } from "@/server/services/fresh-session-user";

export const metadata = { title: "SEO — QazCard AI" };

export default async function AdminSeoPage() {
  const session = await getFreshAdminSessionUser();
  if (!session.ok) {
    return (
      <div className="text-muted-foreground flex items-center gap-2 text-sm">
        <AlertCircle className="size-4" />
        Нет доступа
      </div>
    );
  }
  const canEdit = isSuperAdmin(session.user.role);
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
