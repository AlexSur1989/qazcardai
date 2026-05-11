"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ChevronDown, ChevronUp, Search } from "lucide-react";

import { TASK_FILTER_GROUPS, TASK_LABELS_RU } from "@/config/generation-models";
import type { GenerationTaskId } from "@/config/generation-models";
import type { MergedCatalogModelCard } from "@/lib/generation-models-catalog";
import { matchesSearchQuery, matchesTaskFilter } from "@/lib/generation-models-catalog";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type Props = {
  models: MergedCatalogModelCard[];
  /** Заголовок и описание уже на сервере (PageHeader). */
  suppressTitleBlock?: boolean;
  /** Из query (?q= / ?search=) на /dashboard/models */
  initialSearch?: string;
  /** Из query ?task= (id задачи, через запятую) */
  initialTaskFilters?: GenerationTaskId[];
};

function statusLabel(s: MergedCatalogModelCard["status"]): string {
  if (s === "active") return "Активна";
  if (s === "disabled") return "Недоступно";
  return "Скоро";
}

export function ModelsCatalogExplore({
  models,
  suppressTitleBlock = false,
  initialSearch = "",
  initialTaskFilters = [],
}: Props) {
  const [search, setSearch] = useState(initialSearch);
  const [taskFilters, setTaskFilters] = useState<GenerationTaskId[]>(
    initialTaskFilters,
  );
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);

  const filtered = useMemo(() => {
    return models.filter(
      (m) =>
        matchesTaskFilter(m, taskFilters) && matchesSearchQuery(m, search),
    );
  }, [models, search, taskFilters]);

  function toggleTask(id: GenerationTaskId) {
    setTaskFilters((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  function clearFilters() {
    setTaskFilters([]);
    setSearch("");
  }

  const filterPanel = (
    <div className="bg-card border-border space-y-6 rounded-2xl border p-4 shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <p className="text-foreground text-sm font-semibold">Задачи</p>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="text-primary h-8 px-2 text-xs"
          onClick={clearFilters}
        >
          Очистить фильтры
        </Button>
      </div>
      {TASK_FILTER_GROUPS.map((group) => (
        <div key={group.groupId} className="space-y-2">
          <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
            {group.title}
          </p>
          <div className="flex flex-wrap gap-2">
            {group.items.map((item) => {
              const on = taskFilters.includes(item.id);
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => toggleTask(item.id)}
                  className={cn(
                    "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                    on
                      ? "border-primary bg-primary/12 text-foreground"
                      : "border-border bg-background text-muted-foreground hover:border-primary/40 hover:bg-primary/5",
                  )}
                >
                  {item.label}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );

  const mobileChips = (
    <div className="-mx-1 flex gap-2 overflow-x-auto pb-1 md:hidden">
      {TASK_FILTER_GROUPS.flatMap((g) => g.items).map((item) => {
        const on = taskFilters.includes(item.id);
        return (
          <button
            key={`m-${item.id}`}
            type="button"
            onClick={() => toggleTask(item.id)}
            className={cn(
              "shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium whitespace-nowrap",
              on
                ? "border-primary bg-primary/12"
                : "border-border bg-background text-muted-foreground",
            )}
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );

  return (
    <div className="space-y-6">
      <div
        className={cn(
          "flex flex-col gap-4 sm:flex-row sm:justify-end",
          !suppressTitleBlock && "sm:items-start sm:justify-between",
        )}
      >
        {!suppressTitleBlock ? (
          <div className="max-w-xl space-y-2">
            <h1 className="text-foreground text-2xl font-semibold tracking-tight md:text-3xl">
              AI-модели
            </h1>
            <p className="text-muted-foreground text-sm leading-relaxed">
              Выберите модель для генерации изображений, видео или редактирования контента.
            </p>
          </div>
        ) : null}
        <div
          className={cn(
            "relative w-full sm:max-w-xs sm:shrink-0",
            suppressTitleBlock && "sm:ml-auto",
          )}
        >
          <Search
            className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
            aria-hidden
          />
          <Input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Поиск моделей…"
            className="bg-background/80 pl-9"
            aria-label="Поиск моделей"
          />
        </div>
      </div>

      <button
        type="button"
        className="text-foreground flex w-full items-center justify-between rounded-xl border bg-white/90 px-4 py-3 text-sm font-medium shadow-sm md:hidden"
        onClick={() => setMobileFiltersOpen((v) => !v)}
        aria-expanded={mobileFiltersOpen}
      >
        <span>Фильтры по задачам</span>
        {mobileFiltersOpen ? (
          <ChevronUp className="size-4" aria-hidden />
        ) : (
          <ChevronDown className="size-4" aria-hidden />
        )}
      </button>
      {mobileFiltersOpen ? <div className="md:hidden">{filterPanel}</div> : null}
      <div className="md:hidden">{mobileChips}</div>

      <div className="flex flex-col gap-8 lg:flex-row lg:items-start">
        <div className="hidden w-full shrink-0 lg:block lg:max-w-[260px] lg:self-start">
          {filterPanel}
        </div>
        <div className="min-w-0 flex-1">
          {filtered.length === 0 ? (
            <div className="text-muted-foreground rounded-2xl border border-dashed p-10 text-center text-sm">
              Нет моделей по выбранным фильтрам. Попробуйте снять фильтры или изменить
              поиск.
            </div>
          ) : (
            <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {filtered.map((card) => (
                <li key={`${card.catalogSlug}-${card.dbSlug ?? "x"}`}>
                  <article
                    className={cn(
                      "border-border bg-card flex h-full flex-col overflow-hidden rounded-2xl border shadow-sm",
                    )}
                  >
                    <div className="relative aspect-[16/10] w-full overflow-hidden">
                      <div
                        className={cn(
                          "absolute inset-0 bg-gradient-to-br",
                          card.gradientClass,
                        )}
                        aria-hidden
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-black/15 to-transparent" />
                      <div className="absolute top-2 left-2">
                        <span className="rounded-full bg-white/90 px-2 py-0.5 text-[10px] font-semibold text-slate-800 shadow-sm">
                          {card.providerLabel}
                        </span>
                      </div>
                      <div className="absolute right-2 bottom-2 left-2">
                        <h2 className="text-lg font-semibold text-white drop-shadow-sm">
                          {card.displayName}
                        </h2>
                      </div>
                    </div>
                    <div className="flex flex-1 flex-col gap-3 p-4">
                      <p className="text-muted-foreground line-clamp-3 text-sm leading-snug">
                        {card.description || "—"}
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {card.tasks.map((t) => (
                          <span
                            key={t}
                            className="bg-primary/8 text-foreground/90 rounded-md px-2 py-0.5 text-[11px] font-medium"
                          >
                            {TASK_LABELS_RU[t]}
                          </span>
                        ))}
                      </div>
                      <div className="text-muted-foreground mt-auto flex flex-wrap items-center justify-between gap-2 text-xs">
                        <span
                          className={cn(
                            "rounded-full px-2 py-0.5 font-medium",
                            card.status === "active" && "bg-emerald-500/12 text-emerald-800",
                            card.status === "disabled" && "bg-slate-500/12 text-slate-700",
                            card.status === "coming_soon" && "bg-amber-500/15 text-amber-900",
                          )}
                        >
                          {statusLabel(card.status)}
                        </span>
                        <span className="tabular-nums">
                          {card.costCreditsMin != null
                            ? `от ${card.costCreditsMin} токенов`
                            : "цена по запросу"}
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {card.status === "active" ? (
                          <Link
                            href={
                              card.catalogListOpenHref ?? card.openHref
                            }
                            className={cn(
                              buttonVariants({ size: "sm" }),
                              "flex-1 text-center",
                            )}
                          >
                            Открыть
                          </Link>
                        ) : (
                          <Button className="flex-1" size="sm" disabled>
                            Открыть
                          </Button>
                        )}
                        {card.status === "active" && card.catalogListOpenHref ?
                          <Link
                            href={card.openHref}
                            className={cn(
                              buttonVariants({ variant: "outline", size: "sm" }),
                              "flex-1 text-center sm:flex-initial",
                            )}
                          >
                            Общая форма
                          </Link>
                        : (
                          <Link
                            href={card.detailHref}
                            className={cn(
                              buttonVariants({ variant: "outline", size: "sm" }),
                              "flex-1 text-center sm:flex-initial",
                            )}
                          >
                            Подробнее
                          </Link>
                        )}
                      </div>
                    </div>
                  </article>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
