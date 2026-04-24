import Link from "next/link";

import { cn } from "@/lib/utils";

const legalLinks: { href: string; label: string }[] = [
  { href: "/terms", label: "Условия" },
  { href: "/privacy", label: "Конфиденциальность" },
  { href: "/refund-policy", label: "Возвраты и кредиты" },
  { href: "/ai-content-policy", label: "Контент и ИИ" },
  { href: "/copyright-policy", label: "Авторское право" },
];

export function SiteFooter() {
  return (
    <footer
      className="border-border bg-card/30 text-muted-foreground mt-auto border-t"
      role="contentinfo"
    >
      <div className="mx-auto flex max-w-5xl flex-col gap-4 px-4 py-8 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs">
          <span className="text-foreground/80 font-medium">AI Media</span> — сервис
          генерации контента. Материалы в разделах ниже — шаблоны, не юридический совет.
        </p>
        <nav
          className="flex flex-wrap gap-x-4 gap-y-1 text-xs"
          aria-label="Правовая информация"
        >
          {legalLinks.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              className={cn(
                "text-primary underline-offset-4 hover:underline",
                "text-foreground/80",
              )}
            >
              {label}
            </Link>
          ))}
        </nav>
      </div>
    </footer>
  );
}
