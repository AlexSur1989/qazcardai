"use client";

import { useEffect } from "react";
import { AlertCircle } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("dashboard error:", error);
  }, [error]);

  return (
    <div className="space-y-4">
      <Alert variant="destructive">
        <AlertCircle />
        <AlertTitle>Ошибка в кабинете</AlertTitle>
        <AlertDescription>
          Не удалось отобразить раздел. Попробуйте ещё раз или вернитесь позже.
          {error.digest ? (
            <span className="mt-1 block font-mono text-xs opacity-80">
              {error.digest}
            </span>
          ) : null}
        </AlertDescription>
      </Alert>
      <Button type="button" onClick={() => reset()}>
        Повторить
      </Button>
    </div>
  );
}
