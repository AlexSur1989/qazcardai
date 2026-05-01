"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type { SchemaField } from "@/lib/generation-form-settings-schema";
import {
  SeedanceReferenceUploadList,
  isSeedanceUploadListField,
  uploadListFieldVariant,
} from "@/components/dashboard/seedance-reference-upload-list";
import { SeedanceSingleImageUpload } from "@/components/dashboard/seedance-single-image-upload";

type Props = {
  schemaFields: SchemaField[];
  dynSettings: Record<string, unknown>;
  setDynField: (name: string, value: unknown) => void;
};

export function DynamicModelSettingsFields({
  schemaFields,
  dynSettings,
  setDynField,
}: Props) {
  return (
    <div className="space-y-4 rounded-lg border border-border/80 p-4">
      <p className="text-muted-foreground text-xs font-medium">
        Параметры модели
      </p>
      {schemaFields.map((field) => {
        const id = `dyn-${field.name}`;
        const label = field.label ?? field.name;
        const val = dynSettings[field.name];

        if (field.type === "select" && Array.isArray(field.options)) {
          return (
            <div key={field.name} className="space-y-2">
              <Label htmlFor={id}>{label}</Label>
              <select
                id={id}
                className={cn(
                  "border-input flex h-9 w-full rounded-md border bg-transparent px-3 py-1 text-sm",
                )}
                value={val != null ? String(val) : ""}
                onChange={(e) => setDynField(field.name, e.target.value)}
              >
                {field.options.map((opt) => (
                  <option key={String(opt)} value={String(opt)}>
                    {String(opt)}
                  </option>
                ))}
              </select>
            </div>
          );
        }

        if (field.type === "boolean") {
          return (
            <div key={field.name} className="flex items-center gap-2">
              <input
                id={id}
                type="checkbox"
                className="border-input size-4 rounded border"
                checked={Boolean(val)}
                onChange={(e) => setDynField(field.name, e.target.checked)}
              />
              <Label htmlFor={id} className="font-normal">
                {label}
              </Label>
            </div>
          );
        }

        if (field.type === "image-upload") {
          return (
            <SeedanceSingleImageUpload
              key={field.name}
              fieldName={field.name}
              label={label}
              value={typeof val === "string" ? val : ""}
              onChange={(u) => setDynField(field.name, u)}
            />
          );
        }

        if (field.type === "url") {
          return (
            <div key={field.name} className="space-y-2">
              <Label htmlFor={id}>{label}</Label>
              <Input
                id={id}
                type="url"
                inputMode="url"
                value={typeof val === "string" ? val : ""}
                onChange={(e) => setDynField(field.name, e.target.value)}
                placeholder="https://…"
                className="font-mono text-xs"
              />
            </div>
          );
        }

        if (field.type === "url-list") {
          const lines = Array.isArray(val) ? val.join("\n") : "";
          return (
            <div key={field.name} className="space-y-2">
              <Label htmlFor={id}>{label}</Label>
              <Textarea
                id={id}
                value={lines}
                onChange={(e) => {
                  const next = e.target.value
                    .split(/[\n,]+/)
                    .map((s) => s.trim())
                    .filter(Boolean);
                  setDynField(field.name, next);
                }}
                rows={3}
                className="font-mono text-xs"
                placeholder="https://…"
              />
            </div>
          );
        }

        if (isSeedanceUploadListField(field.type)) {
          return (
            <SeedanceReferenceUploadList
              key={field.name}
              fieldName={field.name}
              label={label}
              variant={uploadListFieldVariant(field.type)}
              value={Array.isArray(val) ? (val as string[]) : []}
              onChange={(next) => setDynField(field.name, next)}
              maxItems={
                typeof field.maxItems === "number" && field.maxItems > 0
                  ? field.maxItems
                  : undefined
              }
            />
          );
        }

        return null;
      })}
    </div>
  );
}
