import Link from "next/link";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { USER_LABELS } from "@/lib/user-facing-copy";

type Props = {
  estimateLoading: boolean;
  estimateFailed: boolean;
  credits: number | null;
  /** Если не передан — блоки баланса скрыты */
  balanceCredits?: number;
  className?: string;
};

export function GenerationCostCard({
  estimateLoading,
  estimateFailed,
  credits,
  balanceCredits,
  className,
}: Props) {
  const hasBalance =
    typeof balanceCredits === "number" && Number.isFinite(balanceCredits);
  const insufficient =
    hasBalance &&
    credits != null &&
    credits > balanceCredits;

  return (
    <Card
      className={cn("qaz-surface qaz-estimate border-primary/20", className)}
    >
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Стоимость генерации</CardTitle>
        <CardDescription className="text-xs">
          Цифра с сервера (estimate); при отправке формы сумма пересчитывается
          снова.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        {estimateLoading && (
          <p className="text-muted-foreground animate-pulse">
            Считаем стоимость…
          </p>
        )}

        {!estimateLoading && estimateFailed && (
          <Alert variant="destructive">
            <AlertTitle>Не удалось рассчитать стоимость</AlertTitle>
            <AlertDescription>
              Проверьте параметры или обновите страницу. Запуск недоступен, пока
              цена неизвестна.
            </AlertDescription>
          </Alert>
        )}

        {!estimateLoading && !estimateFailed && credits != null && (
          <>
            <div className="space-y-2">
              <p className="text-foreground text-3xl font-semibold tabular-nums leading-none">
                {credits}{" "}
                <span className="text-lg font-medium text-muted-foreground">
                  токенов
                </span>
              </p>
              <p className="text-muted-foreground text-sm">
                Будет списано после запуска задачи.
              </p>
              <p className="text-muted-foreground text-xs leading-relaxed">
                {USER_LABELS.providerErrorFallback}
              </p>
            </div>

            {hasBalance && (
              <div className="border-border space-y-1.5 border-t pt-3 text-sm">
                <p>
                  <span className="text-muted-foreground">Ваш баланс: </span>
                  <span className="font-medium tabular-nums">
                    {balanceCredits} токенов
                  </span>
                </p>
                <p>
                  <span className="text-muted-foreground">
                    После генерации останется:{" "}
                  </span>
                  <span className="font-medium tabular-nums">
                    {Math.max(0, balanceCredits - credits)} токенов
                  </span>
                </p>
              </div>
            )}

            {insufficient && (
              <Alert variant="destructive">
                <AlertTitle>Недостаточно токенов</AlertTitle>
                <AlertDescription className="space-y-2">
                  <p>Пополните баланс, чтобы запустить генерацию.</p>
                  <Link
                    href="/dashboard/billing"
                    className={cn(
                      buttonVariants({ size: "sm" }),
                      "inline-flex w-full sm:w-auto",
                    )}
                  >
                    Пополнить баланс
                  </Link>
                </AlertDescription>
              </Alert>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
