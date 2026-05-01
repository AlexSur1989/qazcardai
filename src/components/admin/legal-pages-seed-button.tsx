"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Database } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { adminTerm } from "@/lib/admin-terms";

export function LegalPagesSeedButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function onSeed() {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/legal/seed-defaults", { method: "POST" });
      const j = (await res.json().catch(() => ({}))) as {
        created?: number;
        createdSlugs?: string[];
        error?: string;
      };
      if (!res.ok) {
        throw new Error(j.error ?? "request_failed");
      }
      toast.success(
        `Создано: ${j.created ?? 0} · ${(j.createdSlugs ?? []).join(", ") || "—"}`,
      );
      router.refresh();
    } catch {
      toast.error("Не удалось создать страницы по умолчанию");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button type="button" variant="outline" disabled={loading} onClick={() => void onSeed()}>
      <Database className="mr-2 size-4" aria-hidden />
      {adminTerm("lpSeedDefaults")}
    </Button>
  );
}
