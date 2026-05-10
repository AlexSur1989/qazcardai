/** Главная: маркетинговый лендинг QazCard AI */
import Link from "next/link";
import { ArrowRight, CheckCircle2, CreditCard, ImageIcon, Sparkles, Video, Zap } from "lucide-react";

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
    <div className="from-background via-background to-muted/30 relative flex min-h-screen flex-col overflow-hidden bg-gradient-to-b">
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(120%_80%_at_50%_0%,var(--color-primary)_0%,transparent_55%)] opacity-[0.07]"
        aria-hidden
      />
      
      {/* Шапка */}
      <header className="relative z-10 mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-6">
        <div className="flex items-center gap-2 text-lg font-bold tracking-tight">
          <Sparkles className="text-primary size-5" aria-hidden />
          {getAppName()}
        </div>
        <div className="flex items-center gap-4">
          <Link href="/login" className="text-muted-foreground hover:text-foreground text-sm font-medium transition-colors">
            Войти
          </Link>
          <Button nativeButton={false} render={<Link href="/register" />} size="sm">
            Регистрация
          </Button>
        </div>
      </header>

      <main className="relative z-10 mx-auto flex w-full max-w-6xl flex-1 flex-col px-4 pt-12 pb-24 md:pt-20">
        {/* Главный экран (Hero) */}
        <section className="mx-auto max-w-4xl space-y-8 text-center">
          <div className="border-primary/20 bg-primary/10 text-primary inline-flex items-center rounded-full border px-3 py-1 text-sm font-medium">
            <Zap className="mr-2 size-4" aria-hidden />
            Новые модели: Veo 3.1, Kling 3.0 и Sora 2 Pro
          </div>
          <h1 className="text-balance text-4xl font-bold tracking-tight sm:text-5xl md:text-6xl">
            Создавайте продающие карточки товаров и AI-видео в пару кликов
          </h1>
          <p className="text-muted-foreground text-pretty mx-auto max-w-2xl text-lg leading-relaxed md:text-xl">
            Доступ к лучшим мировым нейросетям в одном кабинете. Без VPN и иностранных карт. Идеально для селлеров Kaspi, Wildberries, Ozon и креативщиков.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-4 pt-4">
            <Button nativeButton={false} render={<Link href="/register" />} size="lg" className="h-12 px-8 text-base">
              Попробовать бесплатно
            </Button>
            <Button
              variant="outline"
              nativeButton={false}
              render={<Link href="/dashboard/models" />}
              size="lg"
              className="h-12 px-8 text-base"
            >
              Каталог моделей
            </Button>
          </div>
        </section>

        {/* Преимущества */}
        <section className="mt-24 grid gap-6 sm:grid-cols-3">
          <Card className="border-border/80 bg-card/80 hover:border-primary/50 shadow-sm backdrop-blur-sm transition-colors">
            <CardHeader>
              <ImageIcon className="text-primary mb-3 size-8" aria-hidden />
              <CardTitle className="text-xl">Умные карточки товаров</CardTitle>
              <CardDescription className="mt-2 text-base">
                От обычного фото до готовой инфографики. AI сам вырежет фон, подберет концепт и наложит дизайн для маркетплейса.
              </CardDescription>
            </CardHeader>
          </Card>
          <Card className="border-border/80 bg-card/80 hover:border-primary/50 shadow-sm backdrop-blur-sm transition-colors">
            <CardHeader>
              <Video className="text-primary mb-3 size-8" aria-hidden />
              <CardTitle className="text-xl">Передовые AI-видеосети</CardTitle>
              <CardDescription className="mt-2 text-base">
                Оживляйте креативы. Лучшие модели для генерации видео из текста и фото: Google Veo 3.1, Kling, Seedance, Hailuo и Sora.
              </CardDescription>
            </CardHeader>
          </Card>
          <Card className="border-border/80 bg-card/80 hover:border-primary/50 shadow-sm backdrop-blur-sm transition-colors">
            <CardHeader>
              <CreditCard className="text-primary mb-3 size-8" aria-hidden />
              <CardTitle className="text-xl">Удобная оплата</CardTitle>
              <CardDescription className="mt-2 text-base">
                Покупайте пакеты токенов через Kaspi. Платите только за то, что генерируете, без скрытых подписок и абонентской платы.
              </CardDescription>
            </CardHeader>
          </Card>
        </section>

        {/* Как это работает */}
        <section className="mt-32 text-center">
          <h2 className="mb-12 text-3xl font-bold tracking-tight md:text-4xl">Как это работает</h2>
          <div className="relative grid gap-8 sm:grid-cols-3">
            <div className="bg-border absolute top-8 right-[16.66%] left-[16.66%] hidden h-[2px] sm:block" aria-hidden />
            <div className="relative z-10 flex flex-col items-center space-y-4">
              <div className="border-background bg-primary/10 text-primary flex size-16 items-center justify-center rounded-full border-4 text-xl font-bold">
                1
              </div>
              <h3 className="text-xl font-semibold">Загрузите данные</h3>
              <p className="text-muted-foreground max-w-[250px] text-sm">
                Загрузите фото вашего товара или просто опишите текстом то, что хотите получить.
              </p>
            </div>
            <div className="relative z-10 flex flex-col items-center space-y-4">
              <div className="border-background bg-primary/10 text-primary flex size-16 items-center justify-center rounded-full border-4 text-xl font-bold">
                2
              </div>
              <h3 className="text-xl font-semibold">Выберите нейросеть</h3>
              <p className="text-muted-foreground max-w-[250px] text-sm">
                Укажите подходящую модель из каталога (Veo, Kling, Sora) и настройте стиль.
              </p>
            </div>
            <div className="relative z-10 flex flex-col items-center space-y-4">
              <div className="border-background bg-primary/10 text-primary flex size-16 items-center justify-center rounded-full border-4 text-xl font-bold">
                3
              </div>
              <h3 className="text-xl font-semibold">Получите результат</h3>
              <p className="text-muted-foreground max-w-[250px] text-sm">
                Скачайте готовое профессиональное видео или фото для ваших соцсетей и маркетплейсов.
              </p>
            </div>
          </div>
        </section>

        {/* Доступные нейросети (Логотипы/Бейджи) */}
        <section className="bg-card/50 mt-32 rounded-3xl border px-6 py-12 text-center shadow-sm">
          <h2 className="mb-8 text-2xl font-bold">Модели мирового уровня в одном месте</h2>
          <div className="flex flex-wrap justify-center gap-3 md:gap-4">
            {["Google Veo 3.1", "Kling 3.0", "ByteDance Seedance", "OpenAI Sora 2 Pro", "MiniMax Hailuo", "Grok Imagine", "Happy Horse"].map((model) => (
              <div key={model} className="bg-background flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium shadow-sm">
                <CheckCircle2 className="text-primary size-4" />
                {model}
              </div>
            ))}
          </div>
        </section>

        {/* Нижний призыв к действию */}
        <section className="mt-32 mb-16 space-y-6 text-center">
          <h2 className="text-3xl font-bold tracking-tight md:text-4xl">Готовы вывести контент на новый уровень?</h2>
          <p className="text-muted-foreground mx-auto max-w-2xl text-lg">
            Зарегистрируйтесь сейчас и получите доступ к передовым AI-инструментам для вашего бизнеса.
          </p>
          <div className="pt-4">
            <Button nativeButton={false} render={<Link href="/register" />} size="lg" className="h-12 px-8 text-base">
              Создать аккаунт
              <ArrowRight className="ml-2 size-4" aria-hidden />
            </Button>
          </div>
        </section>
      </main>

      {/* Подвал */}
      <footer className="bg-card/50 border-t py-8">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-4 sm:flex-row">
          <p className="text-muted-foreground text-sm">
            © {new Date().getFullYear()} {getAppName()}. Все права защищены.
          </p>
          <div className="flex gap-6 text-sm text-muted-foreground">
            <Link href="/terms" className="hover:text-foreground transition-colors">Условия использования</Link>
            <Link href="/privacy" className="hover:text-foreground transition-colors">Конфиденциальность</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}