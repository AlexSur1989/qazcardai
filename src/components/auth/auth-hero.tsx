import { Sparkles, TrendingUp, Zap } from "lucide-react";

import { AuthBrandLogo } from "@/components/auth/auth-brand-logo";

const BENEFITS = [
  {
    icon: Zap,
    title: "Быстро",
    text: "Генерация за минуты",
  },
  {
    icon: Sparkles,
    title: "Качественно",
    text: "Продающий контент",
  },
  {
    icon: TrendingUp,
    title: "Эффективно",
    text: "Больше продаж",
  },
] as const;

function AuthHeroPreview() {
  const steps = ["Товар", "Анализ", "Генерация", "Готово"];

  return (
    <div className="qaz-surface-muted mt-8 w-full max-w-lg p-4 sm:p-5">
      <div className="mb-3 flex items-center justify-between gap-2">
        <p className="text-foreground text-sm font-semibold">Новая карточка товара</p>
        <span className="rounded-full bg-[#00afca]/15 px-2.5 py-0.5 text-[10px] font-semibold text-[#006b82] uppercase">
          AI
        </span>
      </div>

      <div className="mb-4 flex flex-wrap gap-1.5">
        {steps.map((step, i) => (
          <span
            key={step}
            className="flex items-center gap-1 text-[11px] text-muted-foreground"
          >
            <span
              className={
                i === steps.length - 1
                  ? "rounded-md bg-[#00afca] px-2 py-0.5 font-medium text-white"
                  : "rounded-md border border-[#b8dce6] bg-white px-2 py-0.5"
              }
            >
              {step}
            </span>
            {i < steps.length - 1 ? (
              <span className="text-[#b8dce6]" aria-hidden>
                →
              </span>
            ) : null}
          </span>
        ))}
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        <div className="qaz-estimate rounded-xl border px-3 py-2.5">
          <p className="text-[10px] font-semibold text-[#006b82] uppercase">
            AI анализ
          </p>
          <p className="text-muted-foreground mt-1 text-xs">
            Категория, преимущества, стиль
          </p>
        </div>
        <div className="rounded-xl border border-[#b8dce6] bg-white px-3 py-2.5">
          <p className="text-[10px] font-semibold text-[#006b82] uppercase">
            Генерация контента
          </p>
          <p className="text-muted-foreground mt-1 text-xs">
            Фото, тексты, слайды
          </p>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2">
        {["Фото 1", "Фото 2", "Фото 3"].map((label, i) => (
          <div
            key={label}
            className="relative aspect-[3/4] overflow-hidden rounded-lg border border-[#b8dce6] bg-gradient-to-br from-[#c8ebf2] via-white to-[#fff6d9] p-2"
          >
            <div className="bg-[#00afca]/20 absolute top-2 right-2 size-6 rounded-md" />
            <div className="bg-muted-foreground/15 mt-6 h-1.5 w-3/4 rounded-full" />
            <div className="bg-muted-foreground/10 mt-1.5 h-1 w-1/2 rounded-full" />
            {i === 0 ? (
              <span className="absolute bottom-1.5 left-1.5 rounded bg-[#e6b31e]/90 px-1.5 py-0.5 text-[9px] font-medium text-[#0c2d38]">
                Хит
              </span>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}

export function AuthHero() {
  return (
    <div className="relative hidden flex-1 flex-col justify-center px-8 py-10 lg:flex xl:px-14">
      <AuthBrandLogo linkToLanding className="mb-8" />
      <h2 className="text-foreground max-w-xl text-balance text-3xl font-semibold tracking-tight xl:text-4xl">
        AI-генерация товарных карточек, которые продают
      </h2>
      <p className="text-muted-foreground mt-4 max-w-lg text-pretty text-base leading-relaxed">
        Создавайте продающие карточки товаров для маркетплейсов за минуты с
        помощью искусственного интеллекта.
      </p>

      <ul className="mt-8 grid max-w-lg gap-3 sm:grid-cols-3">
        {BENEFITS.map(({ icon: Icon, title, text }) => (
          <li
            key={title}
            className="qaz-surface rounded-xl border px-3 py-3 text-center sm:text-left"
          >
            <div className="bg-primary/10 text-primary mx-auto mb-2 inline-flex size-9 items-center justify-center rounded-full sm:mx-0">
              <Icon className="size-4" aria-hidden />
            </div>
            <p className="text-sm font-semibold">{title}</p>
            <p className="text-muted-foreground mt-0.5 text-xs">{text}</p>
          </li>
        ))}
      </ul>

      <AuthHeroPreview />
    </div>
  );
}
