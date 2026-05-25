import Link from "next/link";
import { ArrowUpRight } from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PRODUCT_CARD_QUICK_LINKS } from "@/lib/product-card-admin-meta";

export function ProductCardAdminLinksTab() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Быстрые ссылки</CardTitle>
        <CardDescription>
          Частые переходы из раздела AI-карточек товара. Цены и тарифы редактируются только в
          разделе «Цены и тарифы».
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ul className="divide-border divide-y rounded-lg border">
          {PRODUCT_CARD_QUICK_LINKS.map((link) => (
            <li key={link.href}>
              <Link
                href={link.href}
                className="hover:bg-muted/50 flex items-center justify-between gap-3 px-4 py-3 text-sm transition-colors"
              >
                <span>{link.label}</span>
                <ArrowUpRight className="text-muted-foreground size-4 shrink-0" aria-hidden />
              </Link>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
