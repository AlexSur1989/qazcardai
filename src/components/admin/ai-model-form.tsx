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

const initial: AiModelActionState = null;

function defaults(): AiModelFormFieldValues {
  return {
    name: "",
    slug: "",
    provider: "KIE_AI",
    type: "IMAGE",
    apiModelId: "",
    endpoint: "",
    costCredits: 0,
    realCost: "",
    isActive: true,
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
    <form action={formAction} className="max-w-3xl space-y-8">
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
            <Label htmlFor="slug">Slug * (латин., дефис)</Label>
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
            <Label htmlFor="provider">Провайдер *</Label>
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
            <Label htmlFor="type">Тип *</Label>
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
        <div className="space-y-1.5">
          <Label htmlFor="apiModelId">ID в API (apiModelId) *</Label>
          <Input
            id="apiModelId"
            name="apiModelId"
            required
            className="font-mono"
            defaultValue={d.apiModelId}
            aria-invalid={!!state?.fieldErrors?.apiModelId}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="endpoint">Endpoint (URL)</Label>
          <Input
            id="endpoint"
            name="endpoint"
            type="url"
            defaultValue={d.endpoint}
            placeholder="https://…"
          />
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            id="isActive"
            name="isActive"
            value="true"
            defaultChecked={d.isActive}
            className="size-4"
          />
          Активна (доступна в списке для генерации)
        </label>
      </section>
      <section className="space-y-3">
        <h2 className="text-foreground text-sm font-medium">Стоимость</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="costCredits">Кредиты (списание) *</Label>
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
              <p className="text-destructive text-xs">
                {state.fieldErrors.costCredits}
              </p>
            ) : null}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="realCost">Себестоимость (учёт)</Label>
            <Input
              id="realCost"
              name="realCost"
              type="text"
              inputMode="decimal"
              defaultValue={d.realCost}
              placeholder="0.00"
            />
          </div>
        </div>
      </section>
      <section className="space-y-3">
        <h2 className="text-foreground text-sm font-medium">Возможности</h2>
        <div className="grid gap-2 sm:grid-cols-2">
          {(
            [
              ["supportsImageInput", "Вход: изображение", d.supportsImageInput],
              ["supportsVideoInput", "Вход: видео", d.supportsVideoInput],
              [
                "supportsNegativePrompt",
                "Negative prompt",
                d.supportsNegativePrompt,
              ],
              ["supportsSeed", "Seed", d.supportsSeed],
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
        <div className="space-y-1.5">
          <Label htmlFor="maxDuration">Макс. длительность (сек, для видео)</Label>
          <Input
            id="maxDuration"
            name="maxDuration"
            type="number"
            min={1}
            defaultValue={d.maxDuration}
            placeholder="пусто = не задано"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="description">Описание</Label>
          <Textarea
            id="description"
            name="description"
            rows={3}
            defaultValue={d.description}
            className="min-h-0"
          />
        </div>
      </section>
      <section className="space-y-3">
        <h2 className="text-foreground text-sm font-medium">JSON (UI / опции)</h2>
        <p className="text-muted-foreground text-xs">
          Пусто или валидный JSON. `settingsSchema` — схема полей для будущих форм
          генерации.
        </p>
        <div className="space-y-1.5">
          <Label htmlFor="settingsSchema">settingsSchema</Label>
          <Textarea
            id="settingsSchema"
            name="settingsSchema"
            rows={4}
            className="font-mono text-xs"
            defaultValue={d.settingsSchema}
            placeholder="{}"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="availableAspectRatios">availableAspectRatios</Label>
          <Textarea
            id="availableAspectRatios"
            name="availableAspectRatios"
            rows={2}
            className="font-mono text-xs"
            defaultValue={d.availableAspectRatios}
            placeholder='["1:1","16:9"]'
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
            placeholder='["1024x1024"]'
          />
        </div>
      </section>
      <div className="flex flex-wrap gap-2">
        <SubmitButton isEdit={mode === "edit"} />
        <Link
          href="/admin/models"
          className={cn(buttonVariants({ variant: "outline" }))}
        >
          Назад
        </Link>
      </div>
    </form>
  );
}
