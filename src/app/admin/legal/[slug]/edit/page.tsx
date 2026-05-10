import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { LegalPageEditor } from "@/components/admin/legal-page-editor";
import { PageHeader } from "@/components/layout/page-header";
import { buttonVariants } from "@/components/ui/button";
import { adminTerm } from "@/lib/admin-terms";
import { isLegalPageSlug } from "@/lib/legal-page-config";
import { cn } from "@/lib/utils";
import { requireAdminPagePermission } from "@/server/guards/admin-page-guard";
import { getAdminLegalPage } from "@/server/services/legalPages";

type Props = { params: Promise<{ slug: string }> };

export default async function AdminLegalEditPage({ params }: Props) {
  const { slug } = await params;
  if (!isLegalPageSlug(slug)) {
    notFound();
  }
  await requireAdminPagePermission("legal.manage");
  const page = await getAdminLegalPage(slug);
  if (!page) {
    notFound();
  }
  const canEdit = true;
  const initial = {
    slug: page.slug,
    title: page.title,
    content: page.content,
    status: page.status,
    version: page.version,
    publishedAt: page.publishedAt ? page.publishedAt.toISOString() : null,
    updatedAt: page.updatedAt.toISOString(),
  };

  return (
    <div className="space-y-8">
      <div>
        <Link
          href="/admin/legal"
          className={cn(
            buttonVariants({ variant: "ghost", size: "sm" }),
            "text-muted-foreground -ml-2 mb-2 gap-1",
          )}
        >
          <ArrowLeft className="size-4" aria-hidden />
          {adminTerm("legalPagesNav")}
        </Link>
        <PageHeader
          title={page.title}
          description={slug}
          breadcrumbs={[
            { label: "Админ", href: "/admin" },
            { label: adminTerm("legalPagesNav"), href: "/admin/legal" },
            { label: slug },
          ]}
        />
      </div>
      <LegalPageEditor
        key={`${initial.slug}-${initial.version}-${initial.updatedAt}`}
        initial={initial}
        canEdit={canEdit}
      />
    </div>
  );
}

export async function generateMetadata({ params }: Props) {
  const { slug } = await params;
  if (!isLegalPageSlug(slug)) {
    return { title: "QazCard AI" };
  }
  return {
    title: `Редактирование: ${slug} — QazCard AI`,
  };
}
