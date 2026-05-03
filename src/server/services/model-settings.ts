
function isRecord(x: unknown): x is Record<string, unknown> {
  return typeof x === "object" && x !== null && !Array.isArray(x);
}

type SchemaField = {
  name: string;
  type?: string;
  label?: string;
  default?: unknown;
  options?: unknown[];
  required?: boolean;
  maxItems?: number;
};

function asFields(settingsSchema: unknown): SchemaField[] {
  if (!isRecord(settingsSchema) || !Array.isArray(settingsSchema.fields)) {
    return [];
  }
  return settingsSchema.fields.filter(
    (x): x is SchemaField =>
      isRecord(x) && typeof x.name === "string",
  ) as SchemaField[];
}

/**
 * Валидация и нормализация настроек генерации по settingsSchema модели.
 */
export function validateAndNormalizeModelSettings(
  settingsSchema: unknown,
  raw: Record<string, unknown>,
): { ok: true; settings: Record<string, unknown> } | { ok: false; message: string } {
  const fields = asFields(settingsSchema);
  if (fields.length === 0) {
    return { ok: false, message: "У модели не задан settingsSchema" };
  }

  const out: Record<string, unknown> = { ...raw };

  for (const f of fields) {
    if (out[f.name] === undefined && f.default !== undefined) {
      out[f.name] = f.default;
    }
  }

  for (const f of fields) {
    const typ = typeof f.type === "string" ? f.type : "";
    let v = out[f.name];

    if (typ === "boolean") {
      if (typeof v === "string") {
        v = v === "true" || v === "1";
        out[f.name] = v;
      } else if (typeof v === "boolean") {
        out[f.name] = v;
      } else if (v === undefined || v === null) {
        out[f.name] = false;
      }
    }

    if (typ === "image-upload" || typ === "url") {
      if (v == null || v === undefined) {
        out[f.name] = "";
      } else if (typeof v === "string") {
        out[f.name] = v.trim();
      } else {
        return {
          ok: false,
          message: `Поле «${f.label ?? f.name}»: ожидается строка (URL)`,
        };
      }
    }

    const isUrlList =
      typ === "url-list" ||
      typ === "image-upload-list" ||
      typ === "video-upload-list" ||
      typ === "audio-upload-list";

    if (isUrlList) {
      if (typeof v === "string") {
        const lines = v
          .split(/[\n,]+/)
          .map((s) => s.trim())
          .filter(Boolean);
        out[f.name] = lines;
      } else if (v == null) {
        out[f.name] = [];
      } else if (!Array.isArray(v)) {
        return {
          ok: false,
          message: `Поле «${f.label ?? f.name}»: ожидается список URL`,
        };
      } else {
        out[f.name] = v.filter((x): x is string => typeof x === "string");
      }
      if (typeof f.maxItems === "number" && f.maxItems > 0) {
        const arr = out[f.name];
        if (Array.isArray(arr)) {
          out[f.name] = arr.slice(0, f.maxItems);
        }
      }
    }

    if (typ === "select" && Array.isArray(f.options) && v !== undefined && v !== null && v !== "") {
      if (!f.options.includes(v)) {
        const match = f.options.find((o) => String(o) === String(v));
        if (match === undefined) {
          return {
            ok: false,
            message: `Недопустимое значение поля «${f.label ?? f.name}»`,
          };
        }
        out[f.name] = match;
      }
    }

    if (f.required) {
      const val = out[f.name];
      if (val === undefined || val === null || val === "") {
        return {
          ok: false,
          message: `Заполните поле «${f.label ?? f.name}»`,
        };
      }
      if (isUrlList && Array.isArray(val) && val.length === 0 && f.required) {
        return {
          ok: false,
          message: `Заполните поле «${f.label ?? f.name}»`,
        };
      }
    }
  }

  return { ok: true, settings: out };
}

export function modelHasSettingsSchema(settingsSchema: unknown): boolean {
  return asFields(settingsSchema).length > 0;
}
