import Link from "next/link";
import { redirect } from "next/navigation";
import { Package, Sparkles } from "lucide-react";

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
        description="Выберите сценарий: каталог AI-моделей или карточка товара для маркетплейса."
        breadcrumbs={[
          { label: "Кабинет", href: "/dashboard" },
          { label: "Создать" },
        ]}
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <Link href="/dashboard/models" className="block rounded-lg focus-visible:ring-2">
          <Card className="h-full transition-colors hover:border-primary/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Sparkles className="size-5" aria-hidden />
                AI-модели
              </CardTitle>
              <CardDescription>
                Каталог моделей фото и видео: фильтры по задачам и быстрый запуск генерации
              </CardDescription>
            </CardHeader>
          </Card>
        </Link>
        <Link href="/dashboard/create/product-card" className="block rounded-lg focus-visible:ring-2">
          <Card className="h-full transition-colors hover:border-primary/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Package className="size-5" aria-hidden />
                Карточка товара
              </CardTitle>
              <CardDescription>
                Загрузка фото, концепты, витринная карточка и видео в одном потоке
              </CardDescription>
            </CardHeader>
          </Card>
        </Link>
      </div>
    </div>
  );
}
