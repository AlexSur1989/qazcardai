"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";

import {
  SIMPLE_PRODUCT_CARD_PROMPTS_DEFAULTS,
  type SimpleProductCardPromptsSetting,
} from "@/config/simple-product-card-prompts-defaults";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

const PROMPT_FIELDS: Array<{
  field: keyof Pick<
    SimpleProductCardPromptsSetting,
    | "globalRules"
    | "promptClassic"
    | "promptClassicWithReference"
    | "promptReference"
    | "promptPremium"
    | "dimensionsPrompt"
    | "negativePrompt"
  >;
  title: string;
  description: string;
}> = [
  {
    field: "globalRules",
    title: "Глобальные правила",
    description: "Общий блок для всех стилей простой карточки.",
  },
  {
    field: "promptClassic",
    title: "Классический стиль (без референса)",
    description: "Marketplace-friendly карточка без reference image.",
  },
  {
    field: "promptClassicWithReference",
    title: "Классический + референс",
    description: "Плейсхолдер {{creativity_instruction}} для ползунка креативности.",
  },
  {
    field: "promptReference",
    title: "По фото-референсу",
    description: "Режим reference — Image B как основной визуальный ориентир.",
  },
  {
    field: "promptPremium",
    title: "Премиум стиль",
    description: "Без reference image — только product photo и user text.",
  },
  {
    field: "dimensionsPrompt",
    title: "Промпт визуализации размеров и характеристик",
    description: "Добавляется в final prompt только если в тексте клиента есть размеры/specs.",
  },
  {
    field: "negativePrompt",
    title: "Negative / safety rules",
    description: "Запреты: не менять товар, не выдумывать характеристики.",
  },
];

function cloneDefaults(): SimpleProductCardPromptsSetting {
  return structuredClone(SIMPLE_PRODUCT_CARD_PROMPTS_DEFAULTS);
}

export function ProductCardSimpleCardPromptsPanel({
  initialValue,
  canPatch,
}: {
  initialValue: unknown;
  canPatch: boolean;
}) {
  const start = useMemo(() => {
    if (initialValue && typeof initialValue === "object" && !Array.isArray(initialValue)) {
      return { ...cloneDefaults(), ...(initialValue as SimpleProductCardPromptsSetting) };
    }
    return cloneDefaults();
  }, [initialValue]);

  const [state, setState] = useState<SimpleProductCardPromptsSetting>(start);
  const [saving, setSaving] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewPrompt, setPreviewPrompt] = useState<string | null>(null);

  const save = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/admin/product-card/simple-card-prompts", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ value: state }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        toast.error(data.error ?? "Не удалось сохранить");
        return;
      }
      toast.success("Промпты простой карточки сохранены");
    } finally {
      setSaving(false);
    }
  };

  const preview = async () => {
    setPreviewLoading(true);
    try {
      const res = await fetch("/api/admin/product-card/simple-card-prompts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "preview",
          styleMode: "classic",
          userText: "Лёгкий и удобный. Прочный материал.",
          aspectRatio: "1:1",
          promptsOverride: state,
        }),
      });
      const data = (await res.json()) as { prompt?: string; error?: string };
      if (!res.ok) {
        toast.error(data.error ?? "Preview failed");
        return;
      }
      setPreviewPrompt(data.prompt ?? null);
    } finally {
      setPreviewLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Промпты простой карточки</CardTitle>
          <CardDescription>
            AppSetting <code className="text-xs">PRODUCT_CARD_SIMPLE_CARD_PROMPTS</code> · version:{" "}
            {state.version}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {PROMPT_FIELDS.map(({ field, title, description }) => (
            <div key={field} className="space-y-2">
              <Label>{title}</Label>
              <p className="text-muted-foreground text-xs">{description}</p>
              <Textarea
                value={state[field]}
                onChange={(e) => setState((s) => ({ ...s, [field]: e.target.value }))}
                rows={8}
                className="font-mono text-xs"
              />
            </div>
          ))}

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-1">
              <Label>maxTextBlocks</Label>
              <input
                type="number"
                className="border-input w-full rounded-md border px-2 py-1 text-sm"
                value={state.maxTextBlocks}
                onChange={(e) =>
                  setState((s) => ({ ...s, maxTextBlocks: Number(e.target.value) || 6 }))
                }
              />
            </div>
            <div className="space-y-1">
              <Label>maxKeyPhrases</Label>
              <input
                type="number"
                className="border-input w-full rounded-md border px-2 py-1 text-sm"
                value={state.maxKeyPhrases}
                onChange={(e) =>
                  setState((s) => ({ ...s, maxKeyPhrases: Number(e.target.value) || 4 }))
                }
              />
            </div>
            <div className="space-y-1">
              <Label>defaultStyleMode</Label>
              <select
                className="border-input w-full rounded-md border px-2 py-1 text-sm"
                value={state.defaultStyleMode}
                onChange={(e) =>
                  setState((s) => ({
                    ...s,
                    defaultStyleMode: e.target.value as SimpleProductCardPromptsSetting["defaultStyleMode"],
                  }))
                }
              >
                <option value="classic">classic</option>
                <option value="reference">reference</option>
                <option value="premium">premium</option>
              </select>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" disabled={previewLoading} onClick={() => void preview()}>
              {previewLoading ? "Preview…" : "Preview classic"}
            </Button>
            <Button type="button" variant="outline" onClick={() => setState(cloneDefaults())}>
              Сбросить к defaults
            </Button>
            {canPatch ? (
              <Button type="button" disabled={saving} onClick={() => void save()}>
                {saving ? "Сохранение…" : "Сохранить"}
              </Button>
            ) : null}
          </div>

          {previewPrompt ? (
            <pre className="bg-muted max-h-[24rem] overflow-auto rounded-lg p-3 text-xs whitespace-pre-wrap">
              {previewPrompt}
            </pre>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
