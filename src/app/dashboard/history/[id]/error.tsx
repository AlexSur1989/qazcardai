"use client";

import { useEffect } from "react";
import { AlertCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export default function HistoryDetailError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // eslint-disable-next-line no-console
    console.error("history detail error:", error);
  }, [error]);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold tracking-tight">Генерация</h1>
      <Alert variant="destructive">
        <AlertCircle />
        <AlertTitle>Ошибка</AlertTitle>
        <AlertDescription className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <span>Не удалось открыть детали.</span>
          <Button type="button" variant="secondary" size="sm" onClick={reset}>
            Повторить
          </Button>
        </AlertDescription>
      </Alert>
    </div>
  );
}
