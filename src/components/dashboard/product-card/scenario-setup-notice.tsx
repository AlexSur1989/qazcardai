"use client";

import Link from "next/link";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  PRODUCT_CARD_SCENARIO_SETUP_BODY,
  PRODUCT_CARD_SCENARIO_SETUP_TITLE,
} from "@/lib/product-card-scenario-setup-copy";

type Props = {
  title?: string;
  body?: string;
  /** Техническая подсказка только для админа */
  adminHint?: string | null;
  showAdminLink?: boolean;
};

export function ScenarioSetupNotice({
  title = PRODUCT_CARD_SCENARIO_SETUP_TITLE,
  body = PRODUCT_CARD_SCENARIO_SETUP_BODY,
  adminHint,
  showAdminLink = false,
}: Props) {
  return (
    <Alert className="border-amber-200/80 bg-amber-50/50">
      <AlertTitle>{title}</AlertTitle>
      <AlertDescription className="space-y-2">
        <p>{body}</p>
        {adminHint && showAdminLink ? (
          <details className="border-border/60 border-t pt-2">
            <summary className="text-muted-foreground cursor-pointer text-xs">Admin debug</summary>
            <p className="text-muted-foreground mt-2 break-all font-mono text-[10px] leading-relaxed">
              {adminHint}
            </p>
          </details>
        ) : null}
        {showAdminLink ? (
          <p className="text-sm">
            <Link href="/admin/product-card" className="text-primary underline">
              Настройки Product Card
            </Link>
            {" · "}
            <Link href="/admin/models" className="text-primary underline">
              AI-модели
            </Link>
          </p>
        ) : null}
      </AlertDescription>
    </Alert>
  );
}
