"use client";

import Link from "next/link";
import Image from "next/image";
import { Package } from "lucide-react";

import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { DashboardSectionEmpty } from "@/components/dashboard/dashboard-section-empty";
import {
  countProductResults,
  formatProductUpdatedAt,
  getProductDisplayTitle,
  getProductMainImageUrl,
} from "@/lib/product-card-project-display";
import { cn } from "@/lib/utils";

export type ProductListItem = {
  id: string;
  title: string | null;
  sourceImageUrl: string | null;
  sourceImages?: unknown;
  metadata?: unknown;
  updatedAt: string;
  createdAt: string;
};

type Props = {
  items: ProductListItem[];
};

function ProductCardRow({ item }: { item: ProductListItem }) {
  const title = getProductDisplayTitle(item);
  const imageUrl = getProductMainImageUrl(item);
  const counts = countProductResults(item.metadata);
  const updatedLabel = formatProductUpdatedAt(item.updatedAt);

  return (
    <Card className="overflow-hidden border-primary/10">
      <CardContent className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center">
        <div className="bg-muted/40 relative size-20 shrink-0 overflow-hidden rounded-xl border border-border/60">
          {imageUrl ? (
            <Image
              src={imageUrl}
              alt=""
              fill
              className="object-cover"
              sizes="80px"
              unoptimized
            />
          ) : (
            <div className="text-muted-foreground flex size-full items-center justify-center">
              <Package className="size-8 opacity-50" aria-hidden />
            </div>
          )}
        </div>

        <div className="min-w-0 flex-1 space-y-1">
          <p className="text-foreground truncate text-base font-semibold">{title}</p>
          {updatedLabel ? (
            <p className="text-muted-foreground text-xs">Обновлён: {updatedLabel}</p>
          ) : null}
          {counts.total > 0 ? (
            <p className="text-muted-foreground text-xs">
              {counts.cards > 0 ? `${counts.cards} карточ.` : null}
              {counts.cards > 0 && counts.concepts > 0 ? " · " : null}
              {counts.concepts > 0 ? `${counts.concepts} концепц.` : null}
              {(counts.cards > 0 || counts.concepts > 0) && counts.videos > 0 ? " · " : null}
              {counts.videos > 0 ? `${counts.videos} видео` : null}
            </p>
          ) : (
            <p className="text-muted-foreground text-xs">Пока нет результатов</p>
          )}
        </div>

        <div className="flex shrink-0 flex-wrap gap-2 sm:flex-col sm:items-stretch">
          <Link
            href={`/dashboard/create/product-card?projectId=${encodeURIComponent(item.id)}`}
            className={cn(buttonVariants({ size: "sm" }), "min-w-[8.5rem]")}
          >
            {counts.total > 0 || imageUrl ? "Продолжить" : "Открыть"}
          </Link>
          <Link
            href={`/dashboard/create/product-card?projectId=${encodeURIComponent(item.id)}`}
            className={cn(buttonVariants({ variant: "outline", size: "sm" }), "min-w-[8.5rem]")}
          >
            Создать карточку
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}

export function ProductsList({ items }: Props) {
  if (items.length === 0) {
    return (
      <DashboardSectionEmpty
        icon={<Package className="size-10 opacity-40" aria-hidden />}
        title="У вас пока нет товаров"
        description="Создайте первый товар и загрузите фото — все карточки, концепции и видео будут храниться внутри него."
        action={
          <Link href="/dashboard/create/product-card" className={cn(buttonVariants())}>
            Создать товар
          </Link>
        }
      />
    );
  }

  return (
    <ul className="space-y-3">
      {items.map((item) => (
        <li key={item.id}>
          <ProductCardRow item={item} />
        </li>
      ))}
    </ul>
  );
}
