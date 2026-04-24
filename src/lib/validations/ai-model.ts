import { z } from "zod";

const slugRe = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const coreSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Укажите название")
    .max(200, "Название слишком длинное"),
  slug: z
    .string()
    .trim()
    .min(1, "Укажите slug")
    .max(120, "Slug слишком длинный")
    .regex(
      slugRe,
      "Slug: строчные латинские буквы, цифры, дефис (например: flux-1-1-pro)",
    ),
  provider: z.enum(["KIE_AI", "OTHER"], {
    message: "Выберите провайдера",
  }),
  type: z.enum(["IMAGE", "VIDEO"], {
    message: "Выберите тип",
  }),
  apiModelId: z
    .string()
    .trim()
    .min(1, "Укажите ID модели в API")
    .max(500, "Слишком длинный apiModelId"),
  endpoint: z.preprocess(
    (v) => {
      if (v === undefined || v === null) return null;
      const s = String(v).trim();
      return s.length === 0 ? null : s.slice(0, 2048);
    },
    z.union([z.string().max(2048), z.null()]),
  ),
  costCredits: z.coerce.number().int().min(0, "Стоимость в кредитах ≥ 0"),
  realCost: z
    .union([z.string(), z.number(), z.null(), z.undefined()])
    .transform((v) => {
      if (v === undefined || v === null) return null;
      if (typeof v === "string" && v.trim() === "") return null;
      const n = typeof v === "string" ? Number(v.replace(",", ".")) : v;
      if (typeof n !== "number" || Number.isNaN(n) || n < 0) return null;
      return n;
    })
    .pipe(
      z
        .number()
        .nonnegative("Себестоимость ≥ 0")
        .max(1e9, "Слишком большое значение")
        .nullable(),
    ),
  isActive: z.boolean(),
  description: z
    .string()
    .optional()
    .transform((s) => {
      if (s == null) return null;
      const t = s.trim();
      return t.length === 0 ? null : t.slice(0, 20_000);
    }),
  supportsImageInput: z.boolean(),
  supportsVideoInput: z.boolean(),
  supportsNegativePrompt: z.boolean(),
  supportsSeed: z.boolean(),
  maxDuration: z
    .union([z.string(), z.number(), z.null(), z.undefined()])
    .transform((v) => {
      if (v === undefined || v === null) return null;
      if (typeof v === "string" && v.trim() === "") return null;
      const n = typeof v === "string" ? parseInt(v, 10) : v;
      if (typeof n !== "number" || Number.isNaN(n) || n < 1) return null;
      return n;
    })
    .pipe(
      z
        .number()
        .int()
        .min(1)
        .max(24 * 60 * 60, "maxDuration слишком большой")
        .nullable(),
    ),
});

export type AiModelCoreParsed = z.infer<typeof coreSchema>;

function parseJsonField(
  raw: string | undefined,
  label: string,
): { ok: true; value: unknown } | { ok: false; message: string } {
  if (raw == null || !raw.trim()) return { ok: true, value: null };
  try {
    return { ok: true, value: JSON.parse(raw) as unknown };
  } catch {
    return { ok: false, message: `${label}: невалидный JSON` };
  }
}

export type AiModelFormResult =
  | { ok: true; data: AiModelFormPayload }
  | { ok: false; message: string; fieldErrors?: Record<string, string> };

export type AiModelFormPayload = AiModelCoreParsed & {
  settingsSchema: unknown;
  availableAspectRatios: unknown;
  availableResolutions: unknown;
};

/** Разбор FormData из формы создания/редактирования. */
export function parseAiModelFormData(
  formData: FormData,
  mode: "create" | "update",
): AiModelFormResult {
  const get = (k: string) => {
    const v = formData.get(k);
    if (v == null) return undefined;
    return String(v);
  };

  const settingsResult = parseJsonField(get("settingsSchema"), "settingsSchema");
  if (!settingsResult.ok) {
    return { ok: false, message: settingsResult.message };
  }
  const arResult = parseJsonField(
    get("availableAspectRatios"),
    "availableAspectRatios",
  );
  if (!arResult.ok) {
    return { ok: false, message: arResult.message };
  }
  const resResult = parseJsonField(
    get("availableResolutions"),
    "availableResolutions",
  );
  if (!resResult.ok) {
    return { ok: false, message: resResult.message };
  }

  const id = get("id");
  if (mode === "update" && (!id || !id.trim())) {
    return { ok: false, message: "Не указан id" };
  }

  const realCostRaw = get("realCost");

  const coreRaw = {
    name: get("name") ?? "",
    slug: get("slug") ?? "",
    provider: (get("provider") ?? "KIE_AI") as "KIE_AI" | "OTHER",
    type: (get("type") ?? "IMAGE") as "IMAGE" | "VIDEO",
    apiModelId: get("apiModelId") ?? "",
    endpoint: get("endpoint"),
    costCredits: get("costCredits") ?? "0",
    realCost:
      realCostRaw === undefined || realCostRaw === ""
        ? null
        : realCostRaw,
    isActive:
      get("isActive") === "true" || get("isActive") === "on",
    description: get("description"),
    supportsImageInput:
      get("supportsImageInput") === "true" || get("supportsImageInput") === "on",
    supportsVideoInput:
      get("supportsVideoInput") === "true" || get("supportsVideoInput") === "on",
    supportsNegativePrompt:
      get("supportsNegativePrompt") === "true" ||
      get("supportsNegativePrompt") === "on",
    supportsSeed:
      get("supportsSeed") === "true" || get("supportsSeed") === "on",
    maxDuration: get("maxDuration"),
  };

  const parsed = coreSchema.safeParse(coreRaw);
  if (!parsed.success) {
    const fe: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const p = issue.path[0];
      if (typeof p === "string" && !fe[p]) {
        fe[p] = issue.message;
      }
    }
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? "Ошибка валидации",
      fieldErrors: fe,
    };
  }

  return {
    ok: true,
    data: {
      ...parsed.data,
      settingsSchema: settingsResult.value,
      availableAspectRatios: arResult.value,
      availableResolutions: resResult.value,
    },
  };
}

