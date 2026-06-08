"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import Link from "next/link";

import {
  createAiModelAction,
  type AiModelActionState,
  updateAiModelAction,
} from "@/server/actions/ai-model";
import { buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { cn } from "@/lib/utils";
import type { AiModelFormFieldValues } from "@/lib/ai-model-form-mappers";
import { adminTerm } from "@/lib/admin-terms";

const initial: AiModelActionState = null;

function defaults(): AiModelFormFieldValues {
  return {
    name: "",
    slug: "",
    provider: "KIE_AI",
    type: "IMAGE",
    scope: "PRODUCT_CARD",
    productCardModelType: "",
    apiModelId: "",
    endpoint: "",
    statusEndpoint: "",
    costCredits: 0,
    realCost: "",
    isActive: false,
    isPublic: false,
    metadataJson: "{}",
    payloadMappingJson: "{}",
    pricingSchemaJson: "",
    settingsSchema: "",
    description: "",
    supportsImageInput: false,
    supportsVideoInput: false,
    supportsNegativePrompt: false,
    supportsSeed: false,
    maxDuration: "",
    availableAspectRatios: "",
    availableResolutions: "",
  };
}

function SubmitButton({ isEdit }: { isEdit: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      className={cn(buttonVariants({ size: "default" }))}
      disabled={pending}
    >
      {pending ? "Сохранение…" : isEdit ? "Сохранить" : "Создать"}
    </button>
  );
}

type AiModelFormProps = {
  mode: "create" | "edit";
  modelId?: string;
  initialData?: AiModelFormFieldValues;
};

export function AiModelForm({ mode, modelId, initialData }: AiModelFormProps) {
  const d = initialData ?? defaults();
  const [state, formAction] = useActionState(
    mode === "create" ? createAiModelAction : updateAiModelAction,
    initial,
  );

  return (
    <form action={formAction} className="max-w-3xl space-y-6">
      {mode === "edit" && modelId ? (
        <input type="hidden" name="id" value={modelId} />
      ) : null}
      {state?.error ? (
        <Alert variant="destructive">
          <AlertTitle>Ошибка</AlertTitle>
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      ) : null}

      <section className="space-y-3">
        <h2 className="text-foreground text-sm font-medium">Основное</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="name">Название *</Label>
            <Input
              id="name"
              name="name"
              required
              defaultValue={d.name}
              aria-invalid={!!state?.fieldErrors?.name}
            />
            {state?.fieldErrors?.name ? (
              <p className="text-destructive text-xs">{state.fieldErrors.name}</p>
            ) : null}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="slug">Slug *</Label>
            <Input
              id="slug"
              name="slug"
              required
              className="font-mono"
              defaultValue={d.slug}
              aria-invalid={!!state?.fieldErrors?.slug}
            />
            {state?.fieldErrors?.slug ? (
              <p className="text-destructive text-xs">{state.fieldErrors.slug}</p>
            ) : null}
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="provider">{adminTerm("provider")} *</Label>
            <select
              id="provider"
              name="provider"
              defaultValue={d.provider}
              className="border-border bg-background text-foreground h-8 w-full rounded-lg border px-2.5 text-sm"
            >
              <option value="KIE_AI">KIE_AI</option>
              <option value="OTHER">OTHER</option>
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="type">Type *</Label>
            <select
              id="type"
              name="type"
              defaultValue={d.type}
              className="border-border bg-background text-foreground h-8 w-full rounded-lg border px-2.5 text-sm"
            >
              <option value="IMAGE">IMAGE</option>
              <option value="VIDEO">VIDEO</option>
            </select>
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="scope">Scope *</Label>
            <select
              id="scope"
              name="scope"
              defaultValue={d.scope}
              className="border-border bg-background text-foreground h-8 w-full rounded-lg border px-2.5 text-sm"
            >
              <option value="PRODUCT_CARD">PRODUCT_CARD</option>
              <option value="GENERAL">GENERAL</option>
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="productCardModelType">Product Card роль</Label>
            <select
              id="productCardModelType"
              name="productCardModelType"
              defaultValue={d.productCardModelType}
              className="border-border bg-background text-foreground h-8 w-full rounded-lg border px-2.5 text-sm"
            >
              <option value="">— (для GENERAL)</option>
              <option value="PRODUCT_CLASSIFIER">PRODUCT_CLASSIFIER</option>
              <option value="PRODUCT_CONCEPT_IMAGE">PRODUCT_CONCEPT_IMAGE</option>
              <option value="PRODUCT_MARKETPLACE_CARD">PRODUCT_MARKETPLACE_CARD</option>
              <option value="PRODUCT_VIDEO">PRODUCT_VIDEO</option>
            </select>
            {state?.fieldErrors?.productCardModelType ? (
              <p className="text-destructive text-xs">
                {state.fieldErrors.productCardModelType}
              </p>
            ) : null}
          </div>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-foreground text-sm font-medium">Kie.ai API</h2>
        <div className="space-y-1.5">
          <Label htmlFor="apiModelId">{adminTerm("apiModelId")} *</Label>
          <Input
            id="apiModelId"
            name="apiModelId"
            required
            className="font-mono text-sm"
            defaultValue={d.apiModelId}
            aria-invalid={!!state?.fieldErrors?.apiModelId}
          />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="endpoint">{adminTerm("endpoint")}</Label>
            <Input
              id="endpoint"
              name="endpoint"
              defaultValue={d.endpoint}
              placeholder="/api/v1/jobs/createTask"
              className="font-mono text-sm"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="statusEndpoint">statusEndpoint</Label>
            <Input
              id="statusEndpoint"
              name="statusEndpoint"
              defaultValue={d.statusEndpoint}
              placeholder="Путь recordInfo"
              className="font-mono text-sm"
            />
          </div>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-foreground text-sm font-medium">Стоимость</h2>
        <div className="space-y-1.5">
          <Label htmlFor="costCredits">{adminTerm("costCredits")} *</Label>
          <Input
            id="costCredits"
            name="costCredits"
            type="number"
            min={0}
            step={1}
            required
            defaultValue={d.costCredits}
          />
          {state?.fieldErrors?.costCredits ? (
            <p className="text-destructive text-xs">{state.fieldErrors.costCredits}</p>
          ) : null}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-foreground text-sm font-medium">Флаги</h2>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            id="isActive"
            name="isActive"
            value="true"
            defaultChecked={d.isActive}
            className="size-4"
          />
          Active (модель доступна для назначения и генераций)
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            id="isPublic"
            name="isPublic"
            value="true"
            defaultChecked={d.isPublic}
            className="size-4"
          />
          Public (видна в каталоге AI для admin QA)
        </label>
        <div className="grid gap-2 sm:grid-cols-2">
          {(
            [
              ["supportsImageInput", adminTerm("supportsImageInput"), d.supportsImageInput],
              ["supportsVideoInput", adminTerm("supportsVideoInput"), d.supportsVideoInput],
              [
                "supportsNegativePrompt",
                adminTerm("supportsNegativePrompt"),
                d.supportsNegativePrompt,
              ],
              ["supportsSeed", adminTerm("supportsSeed"), d.supportsSeed],
            ] as const
          ).map(([name, label, checked]) => (
            <label key={name} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                name={name}
                value="true"
                defaultChecked={checked}
                className="size-4"
              />
              {label}
            </label>
          ))}
        </div>
      </section>

      <details className="rounded-lg border border-border/80 bg-card/30">
        <summary className="cursor-pointer px-4 py-3 text-sm font-medium">
          Технические настройки
        </summary>
        <div className="space-y-4 border-t border-border/60 px-4 py-4">
          <p className="text-muted-foreground text-xs">
            Matrix pricing и live preview — во вкладке «Цены и токены» при редактировании.
            Основная фиксированная цена — поле costCredits выше.
          </p>
          <div className="space-y-1.5">
            <Label htmlFor="settingsSchema">{adminTerm("settingsSchema")}</Label>
            <Textarea
              id="settingsSchema"
              name="settingsSchema"
              rows={8}
              className="font-mono text-xs min-h-[160px]"
              defaultValue={d.settingsSchema}
              placeholder="{}"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pricingSchemaJson">pricingSchema</Label>
            <Textarea
              id="pricingSchemaJson"
              name="pricingSchemaJson"
              rows={4}
              className="font-mono text-xs"
              defaultValue={d.pricingSchemaJson}
              placeholder='{"type":"fixed","credits":10}'
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="payloadMappingJson">payloadMapping</Label>
            <Textarea
              id="payloadMappingJson"
              name="payloadMappingJson"
              rows={8}
              className="font-mono text-xs min-h-[160px]"
              defaultValue={d.payloadMappingJson}
              placeholder="{}"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="metadataJson">metadata (JSON, rawPayloadExample)</Label>
            <Textarea
              id="metadataJson"
              name="metadataJson"
              rows={8}
              className="font-mono text-xs min-h-[160px]"
              defaultValue={d.metadataJson}
              placeholder="{}"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="description">Описание</Label>
            <Textarea
              id="description"
              name="description"
              rows={2}
              defaultValue={d.description}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="realCost">{adminTerm("realCost")}</Label>
            <Input id="realCost" name="realCost" defaultValue={d.realCost} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="maxDuration">maxDuration (сек)</Label>
            <Input id="maxDuration" name="maxDuration" defaultValue={d.maxDuration} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="availableAspectRatios">availableAspectRatios</Label>
            <Textarea
              id="availableAspectRatios"
              name="availableAspectRatios"
              rows={2}
              className="font-mono text-xs"
              defaultValue={d.availableAspectRatios}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="availableResolutions">availableResolutions</Label>
            <Textarea
              id="availableResolutions"
              name="availableResolutions"
              rows={2}
              className="font-mono text-xs"
              defaultValue={d.availableResolutions}
            />
          </div>
        </div>
      </details>

      <div className="flex flex-wrap gap-2">
        <SubmitButton isEdit={mode === "edit"} />
        <Link href="/admin/models" className={cn(buttonVariants({ variant: "outline" }))}>
          Назад
        </Link>
      </div>
    </form>
  );
}
