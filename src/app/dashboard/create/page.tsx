import Link from "next/link";
import { redirect } from "next/navigation";
import { Image as ImageIcon, Package, Video } from "lucide-react";

import { PageHeader } from "@/components/layout/page-header";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getFreshSessionUser } from "@/server/services/fresh-session-user";

export const metadata = {
  title: "Создать — QazCard AI",
};

export default async function CreateHubPage() {
  const current = await getFreshSessionUser();
  if (!current.ok) {
    redirect("/login?next=/dashboard/create");
  }

  return (
    <div className="space-y-8">
      <PageHeader
        variant="qaz"
        title="Создать"
        description="Выберите тип генерации."
        breadcrumbs={[
          { label: "Кабинет", href: "/dashboard" },
          { label: "Создать" },
        ]}
      />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Link href="/dashboard/create/video" className="block rounded-lg focus-visible:ring-2">
          <Card className="h-full transition-colors hover:border-primary/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Video className="size-5" aria-hidden />
                Видео
              </CardTitle>
              <CardDescription>Генерация видео по моделям из каталога</CardDescription>
            </CardHeader>
          </Card>
        </Link>
        <Link href="/dashboard/create/image" className="block rounded-lg focus-visible:ring-2">
          <Card className="h-full transition-colors hover:border-primary/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <ImageIcon className="size-5" aria-hidden />
                Изображение
              </CardTitle>
              <CardDescription>Текст в изображение</CardDescription>
            </CardHeader>
          </Card>
        </Link>
        <Link
          href="/dashboard/create/product-card"
          className="block rounded-lg focus-visible:ring-2 sm:col-span-2 lg:col-span-1"
        >
          <Card className="h-full transition-colors hover:border-primary/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Package className="size-5" aria-hidden />
                Карточка товара
              </CardTitle>
              <CardDescription>Карточка для маркетплейса</CardDescription>
            </CardHeader>
          </Card>
        </Link>
      </div>
    </div>
  );
}
