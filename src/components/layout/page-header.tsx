import type { ReactNode } from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";

import { cn } from "@/lib/utils";

export type BreadcrumbItem = { label: string; href?: string };

type PageHeaderProps = {
  title: string;
  description?: ReactNode;
  breadcrumbs?: BreadcrumbItem[];
  className?: string;
  /** Градиентный блок в стиле лендинга Qaz */
  variant?: "default" | "qaz";
};

export function PageHeader({
  title,
  description,
  breadcrumbs,
  className,
  variant = "default",
}: PageHeaderProps) {
  const inner = (
    <>
      {breadcrumbs && breadcrumbs.length > 0 ? (
        <nav
          aria-label="Навигация"
          className="text-muted-foreground flex flex-wrap items-center gap-1 text-xs"
        >
          {breadcrumbs.map((b, i) => (
            <span key={`${b.label}-${i}`} className="flex items-center gap-1">
              {i > 0 ? <ChevronRight className="size-3 opacity-60" aria-hidden /> : null}
              {b.href ? (
                <Link href={b.href} className="hover:text-foreground">
                  {b.label}
                </Link>
              ) : (
                <span className="text-foreground font-medium">{b.label}</span>
              )}
            </span>
          ))}
        </nav>
      ) : null}
      <h1 className="text-foreground text-2xl font-semibold tracking-tight md:text-3xl">
        {title}
      </h1>
      {description != null && description !== "" ? (
        <div className="text-muted-foreground max-w-2xl text-sm leading-relaxed">
          {description}
        </div>
      ) : null}
    </>
  );

  if (variant === "qaz") {
    return <div className={cn("qaz-hero space-y-2", className)}>{inner}</div>;
  }

  return <div className={cn("space-y-2", className)}>{inner}</div>;
}
