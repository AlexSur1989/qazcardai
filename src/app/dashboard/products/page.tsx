import Link from "next/link";
import { redirect } from "next/navigation";
import { Plus } from "lucide-react";

import { ProductsList, type ProductListItem } from "@/components/dashboard/product-card/products-list";
import { PageHeader } from "@/components/layout/page-header";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { getFreshSessionUser } from "@/server/services/fresh-session-user";
import { listProductCardProjectsForUser } from "@/server/services/productCardProjects";

export const metadata = {
  title: "Мои товары — QazCard AI",
};

export default async function ProductsPage() {
  const current = await getFreshSessionUser();
  if (!current.ok) {
    redirect("/login?next=/dashboard/products");
  }

  const rows = await listProductCardProjectsForUser(current.user.id);
  const items: ProductListItem[] = rows.map((p) => ({
    id: p.id,
    title: p.title,
    sourceImageUrl: p.sourceImageUrl,
    sourceImages: p.sourceImages,
    metadata: p.metadata,
    updatedAt: p.updatedAt.toISOString(),
    createdAt: p.createdAt.toISOString(),
  }));

  return (
    <div className="min-w-0 space-y-6">
      <PageHeader
        variant="qaz"
        title="Мои товары"
        description="Каждый товар — отдельная рабочая область: фото, карточки, концепции и видео хранятся вместе."
        breadcrumbs={[
          { label: "Кабинет", href: "/dashboard" },
          { label: "Мои товары" },
        ]}
      />

      <div className="flex justify-end">
        <Link
          href="/dashboard/create/product-card"
          className={cn(buttonVariants({ size: "sm" }))}
        >
          <Plus className="size-3.5" />
          Создать товар
        </Link>
      </div>

      <ProductsList items={items} />
    </div>
  );
}
