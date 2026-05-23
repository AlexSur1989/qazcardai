"use client";

import { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";

import {
  CARD_BUILDER_PROMPTS_DEFAULTS,
  CARD_BUILDER_PROMPTS_KNOWN_CARD_TYPE_KEYS,
  CARD_BUILDER_PROMPTS_KNOWN_CATEGORY_KEYS,
  CARD_BUILDER_PROMPTS_KNOWN_TEMPLATE_KEYS,
  type CardBuilderPromptsSetting,
} from "@/config/card-builder-prompts-defaults";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type ScalarField = keyof Pick<
  CardBuilderPromptsSetting,
  | "visionPrompt"
  | "galleryPlannerPrompt"
  | "slidePromptBase"
  | "textLockPrompt"
  | "preserveProductPrompt"
  | "negativeRulesPrompt"
  | "styleReferencePrompt"
>;

const SCALAR_SECTIONS: { field: ScalarField; title: string; description: string }[] = [
  {
    field: "visionPrompt",
    title: "Vision-анализ товара",
    description: "Промпт для Kie Vision AI. Плейсхолдер {{OUTPUT_SCHEMA}} подставляет JSON-схему ответа.",
  },
  {
    field: "galleryPlannerPrompt",
    title: "Планировщик структуры",
    description: "Справочный текст правил детерминированного планировщика галереи (admin/debug).",
  },
  {
    field: "slidePromptBase",
    title: "Базовый prompt слайда",
    description: "Роль и общая задача card_builder (секция ROLE).",
  },
  {
    field: "textLockPrompt",
    title: "Защита текста",
    description: "Правила locked copy — не менять текст пользователя.",
  },
  {
    field: "preserveProductPrompt",
    title: "Защита товара 1:1",
    description: "Базовые правила сохранения идентичности SKU.",
  },
  {
    field: "negativeRulesPrompt",
    title: "Запреты на выдумывание",
    description: "Negative rules: без выдуманных характеристик и водяных знаков.",
  },
  {
    field: "styleReferencePrompt",
    title: "Style reference",
    description: "Базовый блок для референса стиля (динамика силы/флагов добавляется кодом).",
  },
];

function cloneDefaults(): CardBuilderPromptsSetting {
  return structuredClone(CARD_BUILDER_PROMPTS_DEFAULTS);
}

export function ProductCardCardBuilderPromptsPanel({
  initialValue,
  canPatch,
}: {
  initialValue: unknown;
  canPatch: boolean;
}) {
  const start = useMemo(() => {
    if (initialValue && typeof initialValue === "object" && !Array.isArray(initialValue)) {
      return {
        ...cloneDefaults(),
        ...(initialValue as CardBuilderPromptsSetting),
        categoryPrompts: {
          ...CARD_BUILDER_PROMPTS_DEFAULTS.categoryPrompts,
          ...((initialValue as CardBuilderPromptsSetting).categoryPrompts ?? {}),
        },
        cardTypePrompts: {
          ...CARD_BUILDER_PROMPTS_DEFAULTS.cardTypePrompts,
          ...((initialValue as CardBuilderPromptsSetting).cardTypePrompts ?? {}),
        },
        templatePrompts: {
          ...CARD_BUILDER_PROMPTS_DEFAULTS.templatePrompts,
          ...((initialValue as CardBuilderPromptsSetting).templatePrompts ?? {}),
        },
      };
    }
    return cloneDefaults();
  }, [initialValue]);

  const [state, setState] = useState<CardBuilderPromptsSetting>(start);
  const [saving, setSaving] = useState(false);
  const [validating, setValidating] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewPrompt, setPreviewPrompt] = useState<string | null>(null);
  const [previewMeta, setPreviewMeta] = useState<Record<string, unknown> | null>(null);

  const [previewCategory, setPreviewCategory] = useState("beauty_care");
  const [previewSlideRole, setPreviewSlideRole] = useState("benefits_infographic");
  const [previewTemplate, setPreviewTemplate] = useState("benefits_grid");
  const [previewTitle, setPreviewTitle] = useState("Тестовый крем для лица");
  const [previewFactsJson, setPreviewFactsJson] = useState(
    JSON.stringify(
      [
        {
          id: "f1",
          label: "Объём",
          value: "50 мл",
          type: "detail",
          lockedText: true,
          visibleOnCard: true,
        },
      ],
      null,
      2,
    ),
  );

  const persist = useCallback(async (next: CardBuilderPromptsSetting) => {
    if (!canPatch) {
      toast.error("Нужно право settings.manage.");
      return false;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/admin/product-card/card-builder-prompts", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ value: next }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(typeof data.error === "string" ? data.error : "Ошибка сохранения");
        return false;
      }
      toast.success("Промпты сохранены");
      return true;
    } finally {
      setSaving(false);
    }
  }, [canPatch]);

  async function validateStructure() {
    setValidating(true);
    try {
      const res = await fetch("/api/admin/product-card/card-builder-prompts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "validate", value: state }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(Array.isArray(data.errors) ? data.errors.join("\n") : "Структура невалидна");
        return;
      }
      const warnings = Array.isArray(data.warnings) ? data.warnings : [];
      if (warnings.length) {
        toast.message(`Структура OK. Предупреждения: ${warnings.length}`, {
          description: warnings.slice(0, 3).join("\n"),
        });
      } else {
        toast.success("Структура и JSON валидны");
      }
    } finally {
      setValidating(false);
    }
  }

  async function saveAll() {
    await persist(state);
  }

  function resetScalar(field: ScalarField) {
    setState((prev) => ({
      ...prev,
      [field]: CARD_BUILDER_PROMPTS_DEFAULTS[field],
    }));
    toast.message(`Поле «${field}» сброшено локально — нажмите «Сохранить»`);
  }

  function resetMapKey(map: "categoryPrompts" | "cardTypePrompts" | "templatePrompts", key: string) {
    setState((prev) => ({
      ...prev,
      [map]: {
        ...prev[map],
        [key]: CARD_BUILDER_PROMPTS_DEFAULTS[map][key] ?? "",
      },
    }));
  }

  async function buildPreview() {
    setPreviewLoading(true);
    setPreviewPrompt(null);
    setPreviewMeta(null);
    try {
      let productFacts: unknown[] = [];
      try {
        productFacts = JSON.parse(previewFactsJson) as unknown[];
      } catch {
        toast.error("sample productFacts: невалидный JSON");
        return;
      }
      const res = await fetch("/api/admin/product-card/card-builder-prompts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "preview",
          categoryKey: previewCategory,
          slideRole: previewSlideRole,
          templateId: previewTemplate,
          productTitle: previewTitle,
          productFacts,
          promptsOverride: state,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(
          Array.isArray(data.errors) ? data.errors.join("\n") : data.error ?? "Ошибка preview",
        );
        return;
      }
      setPreviewPrompt(typeof data.prompt === "string" ? data.prompt : null);
      setPreviewMeta(data.promptMeta ?? null);
    } finally {
      setPreviewLoading(false);
    }
  }

  function renderMapEditor(
    title: string,
    description: string,
    mapKey: "categoryPrompts" | "cardTypePrompts" | "templatePrompts",
    keys: readonly string[],
  ) {
    return (
      <Card className="rounded-2xl">
        <CardHeader>
          <CardTitle className="text-base">{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {keys.map((key) => (
            <div key={key} className="space-y-2 rounded-lg border p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Label className="font-mono text-xs">{key}</Label>
                <Button type="button" size="sm" variant="outline" onClick={() => resetMapKey(mapKey, key)}>
                  Сбросить
                </Button>
              </div>
              <Textarea
                rows={4}
                value={state[mapKey][key] ?? ""}
                onChange={(e) =>
                  setState((prev) => ({
                    ...prev,
                    [mapKey]: { ...prev[mapKey], [key]: e.target.value },
                  }))
                }
                className="font-mono text-xs"
              />
            </div>
          ))}
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Промпты «Создать карточку»</CardTitle>
          <CardDescription>
            AppSetting <code className="text-xs">PRODUCT_CARD_CARD_BUILDER_PROMPTS</code> · version:{" "}
            <span className="font-mono">{state.version}</span>
            {!canPatch ? " · только чтение (нужно settings.manage)" : null}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Button type="button" onClick={() => void saveAll()} disabled={!canPatch || saving}>
            {saving ? "Сохранение…" : "Сохранить все промпты"}
          </Button>
          <Button type="button" variant="secondary" onClick={() => void validateStructure()} disabled={validating}>
            {validating ? "Проверка…" : "Проверить JSON/структуру"}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              setState(cloneDefaults());
              toast.message("Сброшено к code defaults локально — сохраните для записи в БД");
            }}
            disabled={!canPatch}
          >
            Сбросить всё к стандартному
          </Button>
        </CardContent>
      </Card>

      {SCALAR_SECTIONS.map((section) => (
        <Card key={section.field} className="rounded-2xl">
          <CardHeader>
            <CardTitle className="text-base">{section.title}</CardTitle>
            <CardDescription>{section.description}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Textarea
              rows={8}
              value={state[section.field]}
              onChange={(e) => setState((prev) => ({ ...prev, [section.field]: e.target.value }))}
              className="font-mono text-xs"
            />
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                onClick={() => void persist({ ...state, [section.field]: state[section.field] })}
                disabled={!canPatch || saving}
              >
                Сохранить
              </Button>
              <Button type="button" size="sm" variant="outline" onClick={() => resetScalar(section.field)}>
                Сбросить к стандартному
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}

      {renderMapEditor(
        "Промпты категорий",
        "Ключ = cardBuilderCategoryKey (universal).",
        "categoryPrompts",
        CARD_BUILDER_PROMPTS_KNOWN_CATEGORY_KEYS,
      )}
      {renderMapEditor(
        "Промпты типов карточек",
        "Ключ = cardType (main_photo, benefits, dimensions…).",
        "cardTypePrompts",
        CARD_BUILDER_PROMPTS_KNOWN_CARD_TYPE_KEYS,
      )}
      {renderMapEditor(
        "Промпты шаблонов",
        "Ключ = templateId из card-builder-templates.",
        "templatePrompts",
        CARD_BUILDER_PROMPTS_KNOWN_TEMPLATE_KEYS,
      )}

      <Card className="rounded-2xl">
        <CardHeader>
          <CardTitle className="text-base">Собрать тестовый prompt</CardTitle>
          <CardDescription>Без Kie-запросов — только preview super prompt в админке.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label>Категория</Label>
            <select
              className="border-input w-full rounded-md border px-2 py-2 text-sm"
              value={previewCategory}
              onChange={(e) => setPreviewCategory(e.target.value)}
            >
              {CARD_BUILDER_PROMPTS_KNOWN_CATEGORY_KEYS.map((k) => (
                <option key={k} value={k}>
                  {k}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label>slideRole</Label>
            <input
              className="border-input w-full rounded-md border px-2 py-2 text-sm"
              value={previewSlideRole}
              onChange={(e) => setPreviewSlideRole(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>templateId</Label>
            <input
              className="border-input w-full rounded-md border px-2 py-2 text-sm"
              value={previewTemplate}
              onChange={(e) => setPreviewTemplate(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>Название товара</Label>
            <input
              className="border-input w-full rounded-md border px-2 py-2 text-sm"
              value={previewTitle}
              onChange={(e) => setPreviewTitle(e.target.value)}
            />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label>sample productFacts (JSON)</Label>
            <Textarea
              rows={6}
              value={previewFactsJson}
              onChange={(e) => setPreviewFactsJson(e.target.value)}
              className="font-mono text-xs"
            />
          </div>
          <div className="md:col-span-2">
            <Button type="button" onClick={() => void buildPreview()} disabled={previewLoading}>
              {previewLoading ? "Сборка…" : "Собрать тестовый prompt"}
            </Button>
          </div>
          {previewMeta ? (
            <pre className="bg-muted md:col-span-2 overflow-x-auto rounded-lg p-3 text-xs">
              {JSON.stringify(previewMeta, null, 2)}
            </pre>
          ) : null}
          {previewPrompt ? (
            <pre className="bg-muted md:col-span-2 max-h-[32rem] overflow-auto rounded-lg p-3 text-xs whitespace-pre-wrap">
              {previewPrompt}
            </pre>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
