/** Главная: короткий маркетинговый экран (без отдельного SEO-лендинг-компонента). */
import Link from "next/link";
import { ArrowRight, ImageIcon, Shield, Sparkles, Video } from "lucide-react";

import { getAppName } from "@/lib/app-name";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function HomePage() {
  return (
    <div className="from-background via-background to-muted/30 relative flex-1 overflow-hidden bg-gradient-to-b">
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(120%_80%_at_50%_0%,var(--color-primary)_0%,transparent_55%)] opacity-[0.07]"
        aria-hidden
      />
      <main className="relative mx-auto flex w-full max-w-5xl flex-col gap-16 px-4 py-16 md:py-24">
        <div className="mx-auto max-w-3xl space-y-6 text-center">
          <p className="text-primary text-sm font-medium tracking-wide uppercase">
            {getAppName()}
          </p>
          <h1 className="text-balance text-3xl font-semibold tracking-tight md:text-5xl">
            Карточки товаров, фото и видео для маркетплейсов и соцсетей
          </h1>
          <p className="text-muted-foreground text-pretty mx-auto max-w-2xl text-lg leading-relaxed">
            AI-сервис для создания карточек товаров, фото и видео для маркетплейсов и
            соцсетей. Личный кабинет, токены, история задач; ключи к моделям остаются на
            сервере.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            <Button nativeButton={false} render={<Link href="/auth/register" />} size="lg">
              Создать аккаунт
            </Button>
            <Button
              variant="outline"
              nativeButton={false}
              render={<Link href="/auth/login" />}
              size="lg"
            >
              Войти
            </Button>
            <Button
              variant="secondary"
              nativeButton={false}
              render={<Link href="/dashboard" />}
              size="lg"
            >
              Кабинет
              <ArrowRight className="size-4" data-icon="inline-end" />
            </Button>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <Card className="border-border/80 bg-card/80 shadow-sm backdrop-blur-sm">
            <CardHeader>
              <ImageIcon className="text-primary mb-1 size-8" aria-hidden />
              <CardTitle className="text-base">Изображения</CardTitle>
              <CardDescription>
                Модели из панели администратора, промпты, референсы по URL, очередь и
                статусы в реальном времени.
              </CardDescription>
            </CardHeader>
          </Card>
          <Card className="border-border/80 bg-card/80 shadow-sm backdrop-blur-sm">
            <CardHeader>
              <Video className="text-primary mb-1 size-8" aria-hidden />
              <CardTitle className="text-base">Видео</CardTitle>
              <CardDescription>
                Отдельные VIDEO-модели, длительность и параметры в рамках схемы
                настроек.
              </CardDescription>
            </CardHeader>
          </Card>
          <Card className="border-border/80 bg-card/80 shadow-sm backdrop-blur-sm">
            <CardHeader>
              <Shield className="text-primary mb-1 size-8" aria-hidden />
              <CardTitle className="text-base">Безопасность</CardTitle>
              <CardDescription>
                Роли, аудит админских действий, rate limits и хранение файлов вне диска
                сервера.
              </CardDescription>
            </CardHeader>
          </Card>
        </div>

        <div className="text-muted-foreground flex flex-col items-center gap-2 text-center text-sm">
          <Sparkles className="size-5 opacity-60" aria-hidden />
          <p>Генерация изображений, видео и карточек товара в одном кабинете.</p>
        </div>
      </main>
    </div>
  );
}
