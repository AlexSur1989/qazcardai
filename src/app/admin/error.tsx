"use client";

import { useEffect } from "react";
import { AlertCircle } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("admin error:", error);
  }, [error]);

  return (
    <div className="space-y-4">
      <Alert variant="destructive">
        <AlertCircle />
        <AlertTitle>Ошибка в админ-разделе</AlertTitle>
        <AlertDescription>
          {error.message || "Попробуйте обновить страницу."}
        </AlertDescription>
      </Alert>
      <Button type="button" onClick={() => reset()}>
        Повторить
      </Button>
    </div>
  );
}
