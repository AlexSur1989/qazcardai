import Link from "next/link";
import { AlertCircle, Image as ImageIcon, Video } from "lucide-react";

import { auth } from "@/auth";
import { DashboardSectionEmpty } from "@/components/dashboard/dashboard-section-empty";
import {
  GenerationListFooter,
  GenerationPreviewList,
} from "@/components/dashboard/generation-preview-list";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getDashboardSnapshot } from "@/lib/dashboard-data";
import { cn } from "@/lib/utils";
import { redirect } from "next/navigation";

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/auth/login?callbackUrl=/dashboard");
  }

  const data = await getDashboardSnapshot(session.user.id);

  if (!data.ok) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-foreground text-2xl font-semibold tracking-tight">
            Кабинет
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Обзор баланса, тарифа и последних операций
          </p>
        </div>
        {data.error === "not_found" ? (
          <Alert variant="destructive">
            <AlertCircle />
            <AlertTitle>Аккаунт не найден</AlertTitle>
            <AlertDescription>
              Войдите снова или зарегистрируйтесь. Если проблема повторяется, напишите в
              поддержку.
            </AlertDescription>
          </Alert>
        ) : (
          <Alert variant="destructive">
            <AlertCircle />
            <AlertTitle>Не удалось загрузить данные</AlertTitle>
            <AlertDescription>
              Проверьте подключение к базе и переменные окружения, затем обновите страницу.
            </AlertDescription>
          </Alert>
        )}
      </div>
    );
  }

  const { balanceCredits, activePlan, recent, active } = data;
  const name = session.user.name?.trim() || session.user.email;

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-2">
        <h1 className="text-foreground text-2xl font-semibold tracking-tight">
          Здравствуйте, {name}
        </h1>
        <p className="text-muted-foreground text-sm">
          Кредиты, тариф и недавние генерации. Генерация подключится на следующем этапе.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Баланс</CardTitle>
            <CardDescription>Доступные кредиты для генераций</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold tabular-nums">{balanceCredits}</p>
            <p className="text-muted-foreground mt-1 text-xs">кредитов</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Тариф</CardTitle>
            <CardDescription>Активный план, если оформлен</CardDescription>
          </CardHeader>
          <CardContent>
            {activePlan ? (
              <div>
                <p className="text-lg font-medium">{activePlan.name}</p>
                <p className="text-muted-foreground text-xs">{activePlan.slug}</p>
              </div>
            ) : (
              <DashboardSectionEmpty
                title="Активный тариф не подключён"
                description="Когда оформите подписку или пакет, информация отобразится здесь."
              />
            )}
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <Link
          href="/dashboard/create/image"
          className={cn(
            buttonVariants({ size: "lg" }),
            "inline-flex sm:w-auto",
          )}
        >
          <ImageIcon className="size-4" data-icon="inline-start" />
          Создать фото
        </Link>
        <Link
          href="/dashboard/create/video"
          className={cn(
            buttonVariants({ size: "lg", variant: "secondary" }),
            "inline-flex sm:w-auto",
          )}
        >
          <Video className="size-4" data-icon="inline-start" />
          Создать видео
        </Link>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Активные задачи</CardTitle>
            <CardDescription>
              Генерации в ожидании и в обработке
            </CardDescription>
          </CardHeader>
          <CardContent>
            {active.length === 0 ? (
              <DashboardSectionEmpty
                title="Нет активных задач"
                description="Когда вы запустите генерацию, она появится здесь."
                icon={<Video className="text-muted-foreground size-8 opacity-50" aria-hidden />}
              />
            ) : (
              <GenerationPreviewList
                items={active}
                emptyMessage="Список пуст."
              />
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Последние генерации</CardTitle>
            <CardDescription>Недавние запросы (до 5)</CardDescription>
          </CardHeader>
          <CardContent>
            {recent.length === 0 ? (
              <DashboardSectionEmpty
                title="Пока нет генераций"
                description="Создайте изображение или видео — история появится здесь."
                icon={
                  <ImageIcon
                    className="text-muted-foreground size-8 opacity-50"
                    aria-hidden
                  />
                }
                action={
                  <div className="flex flex-wrap justify-center gap-2">
                    <Link
                      href="/dashboard/create/image"
                      className={buttonVariants({ size: "sm" })}
                    >
                      Создать фото
                    </Link>
                    <Link
                      href="/dashboard/create/video"
                      className={buttonVariants({ size: "sm", variant: "outline" })}
                    >
                      Создать видео
                    </Link>
                  </div>
                }
              />
            ) : (
              <>
                <GenerationPreviewList
                  items={recent}
                  emptyMessage="Нет записей."
                />
                <GenerationListFooter href="/dashboard/history">
                  Вся история
                </GenerationListFooter>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
