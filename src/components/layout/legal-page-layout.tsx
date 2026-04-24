import Link from "next/link";

import { LegalDisclaimerBanner } from "@/components/layout/legal-disclaimer";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Props = {
  title: string;
  lastUpdatedLabel?: string;
  children: React.ReactNode;
};

/**
 * Единая обёртка для статических legal-страниц (без CMS).
 */
export function LegalPageLayout({ title, lastUpdatedLabel, children }: Props) {
  return (
    <div className="bg-background">
      <main className="mx-auto max-w-3xl px-4 py-10 md:py-14">
        <div className="mb-6">
          <Link
            href="/"
            className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "mb-4 -ml-2")}
          >
            ← На главную
          </Link>
          <h1 className="text-foreground text-2xl font-semibold tracking-tight md:text-3xl">
            {title}
          </h1>
          {lastUpdatedLabel ? (
            <p className="text-muted-foreground mt-2 text-sm">{lastUpdatedLabel}</p>
          ) : null}
        </div>
        <div className="mb-8">
          <LegalDisclaimerBanner />
        </div>
        <div className="legal-prose text-foreground/95 space-y-6 text-sm leading-relaxed md:text-base [&_h2]:text-foreground [&_h2]:mt-8 [&_h2]:mb-3 [&_h2]:text-lg [&_h2]:font-semibold [&_h3]:mt-4 [&_h3]:mb-2 [&_h3]:text-base [&_h3]:font-medium [&_li]:ml-1 [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:text-muted-foreground [&_ul]:list-disc [&_ul]:pl-5">
          {children}
        </div>
      </main>
    </div>
  );
}
