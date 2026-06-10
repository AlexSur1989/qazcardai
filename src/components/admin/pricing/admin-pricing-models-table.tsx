"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { buttonVariants } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { AdminPricingModelRow } from "@/server/services/adminPricingOverview";
import { LabelWithInfoTooltip } from "@/components/ui/info-tooltip";
import { cn } from "@/lib/utils";

type FilterId = "all" | "GENERAL" | "PRODUCT_CARD" | "IMAGE" | "VIDEO" | "VISION";

const FILTERS: { id: FilterId; label: string }[] = [
  { id: "all", label: "Все" },
  { id: "GENERAL", label: "GENERAL" },
  { id: "PRODUCT_CARD", label: "PRODUCT_CARD" },
  { id: "IMAGE", label: "IMAGE" },
  { id: "VIDEO", label: "VIDEO" },
  { id: "VISION", label: "Classifier" },
];

type Props = {
  models: AdminPricingModelRow[];
};

export function AdminPricingModelsTable({ models }: Props) {
  const [filter, setFilter] = useState<FilterId>("all");

  const rows = useMemo(() => {
    return models.filter((m) => {
      if (filter === "all") return true;
      if (filter === "GENERAL" || filter === "PRODUCT_CARD") return m.scope === filter;
      if (filter === "VISION") {
        return m.productCardModelType === "PRODUCT_CLASSIFIER";
      }
      return m.type === filter;
    });
  }, [models, filter]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-1">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => setFilter(f.id)}
            className={cn(
              buttonVariants({
                variant: filter === f.id ? "secondary" : "ghost",
                size: "sm",
              }),
            )}
          >
            {f.label}
          </button>
        ))}
      </div>
      <div className="overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Название</TableHead>
              <TableHead>Slug</TableHead>
              <TableHead>Scope</TableHead>
              <TableHead>Тип</TableHead>
              <TableHead>Provider</TableHead>
              <TableHead>Active</TableHead>
              <TableHead>Schema</TableHead>
              <TableHead className="text-right">Min</TableHead>
              <TableHead className="text-right">
                <LabelWithInfoTooltip
                  label="Sample"
                  tooltip="Сколько токенов списывается за одну генерацию."
                  align="end"
                />
              </TableHead>
              <TableHead className="text-right">Маржа %</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((m) => (
              <TableRow key={m.id} className={cn(!m.isActive && "opacity-60")}>
                <TableCell className="font-medium">{m.name}</TableCell>
                <TableCell className="font-mono text-xs">{m.slug}</TableCell>
                <TableCell>{m.scope}</TableCell>
                <TableCell>{m.type}</TableCell>
                <TableCell>{m.provider}</TableCell>
                <TableCell>{m.isActive ? "да" : "нет"}</TableCell>
                <TableCell className="text-xs">{m.pricingSchemaType}</TableCell>
                <TableCell className="text-right tabular-nums">{m.minCredits}</TableCell>
                <TableCell className="text-right tabular-nums">{m.sampleCredits}</TableCell>
                <TableCell className="text-right tabular-nums">
                  {m.marginPercent != null ? `${m.marginPercent.toFixed(1)}%` : "—"}
                </TableCell>
                <TableCell>
                  <Link
                    href={`/admin/models/${m.id}/edit`}
                    className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
                  >
                    Pricing Studio
                  </Link>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
