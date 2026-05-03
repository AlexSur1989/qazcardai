import Link from "next/link";
import { AlertCircle, Image as ImageIcon, Package, Video } from "lucide-react";

import { DashboardSectionEmpty } from "@/components/dashboard/dashboard-section-empty";
import { PageHeader } from "@/components/layout/page-header";
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
import { formatKzt, formatRuDate } from "@/lib/format-kzt";
import { cn } from "@/lib/utils";
import { redirect } from "next/navigation";
import { getUserLastTokenPackage } from "@/server/services/tokenPackages";
import { getFreshSessionUser } from "@/server/services/fresh-session-user";

export const metadata = {
  title: "Кабинет — QazCard AI",
};

export default async function DashboardPage() {
  const current = await getFreshSessionUser();
  if (!current.ok) {
    redirect("/login?next=/dashboard");
  }

  const [data, lastPack] = await Promise.all([
    getDashboardSnapshot(current.user.id),
    getUserLastTokenPackage(current.user.id),
  ]);

  if (!data.ok) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Кабинет"
          description="Баланс кредитов, план, активные и последние генерации."
        />
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
  const name = current.user.name?.trim() || current.user.email;

  return (
    <div className="space-y-8">
      <PageHeader
        variant="qaz"
        title={`Здравствуйте, ${name}`}
        description="Сводка по балансу токенов и задачам. Быстрые действия — карточка товара, фото и видео."
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Баланс</CardTitle>
            <CardDescription>Доступно токенов для генераций</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold tabular-nums">{balanceCredits}</p>
            <p className="text-muted-foreground mt-1 text-xs">токенов</p>
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

      <Card>
        <CardHeader>
          <CardTitle>Ваш пакет</CardTitle>
          <CardDescription>Последний приобретённый пакет токенов (разовая покупка)</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {lastPack ? (
            <>
              <p className="text-xl font-semibold">{lastPack.packageName}</p>
              <p className="text-foreground text-lg font-medium tabular-nums">
                {lastPack.totalTokens} токенов
                {lastPack.bonusTokens > 0 ? (
                  <span className="text-muted-foreground block text-sm font-normal">
                    +{lastPack.bonusTokens} бонусных токенов
                  </span>
                ) : null}
              </p>
              <p className="text-muted-foreground text-sm">
                Куплен: {formatRuDate(lastPack.purchasedAt)} · {formatKzt(lastPack.priceKzt)}
              </p>
            </>
          ) : (
            <div className="space-y-3">
              <p className="text-muted-foreground text-sm">Пакет ещё не приобретён</p>
              <Link
                href="/dashboard/billing"
                className={cn(buttonVariants({ size: "sm" }), "inline-flex w-fit")}
              >
                Купить токены
              </Link>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Link
          href="/dashboard/create/product-card"
          className={cn(
            buttonVariants({ size: "lg" }),
            "inline-flex w-full min-h-10 items-center justify-center gap-2 sm:w-auto",
          )}
        >
          <Package className="size-4 shrink-0" data-icon="inline-start" />
          Создать карточку товара
        </Link>
        <Link
          href="/dashboard/create/image"
          className={cn(
            buttonVariants({ size: "lg" }),
            "inline-flex w-full min-h-10 items-center justify-center gap-2 sm:w-auto",
          )}
        >
          <ImageIcon className="size-4 shrink-0" data-icon="inline-start" />
          Создать фото
        </Link>
        <Link
          href="/dashboard/create/video"
          className={cn(
            buttonVariants({ size: "lg", variant: "secondary" }),
            "inline-flex w-full min-h-10 items-center justify-center gap-2 border sm:w-auto",
          )}
        >
          <Video className="size-4 shrink-0" data-icon="inline-start" />
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
