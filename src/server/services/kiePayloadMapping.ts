import {
  isUrlPubliclyReachableForKie,
  publicHttpUrlsOnly,
} from "@/lib/generation-input-limits";

export type KiePayloadMapping = {
  adapter?: "market-create-task" | "custom";
  input: Record<string, string | number | boolean | null>;
  omitNull?: boolean;
  required?: string[];
  coerce?: Record<
    string,
    "string" | "number" | "boolean" | "stringArray" | "booleanString"
  >;
};

type KiePayloadCoerceKind = NonNullable<KiePayloadMapping["coerce"]>[string];

export type KieMarketPayloadContext = {
  model: { apiModelId: string };
  prompt: string;
  settings: Record<string, unknown>;
  inputFiles?: string[];
  callBackUrl: string;
};

type JsonRecord = Record<string, unknown>;

const PUBLIC_URL_ARRAY_FIELDS = new Set([
  "input_urls",
  "image_urls",
  "reference_image",
  "reference_image_urls",
  "reference_video",
  "reference_video_urls",
  "reference_audio_urls",
  "image_input",
  "image_url",
  "mask_url",
]);

const PUBLIC_URL_STRING_FIELDS = new Set([
  "audio_url",
  "first_frame_url",
  "last_frame_url",
  "first_clip_url",
  "driving_audio_url",
  "first_frame",
  "reference_voice",
  "reference_image",
  "image_url",
  "mask_url",
  "video_url",
]);

export class KiePayloadMappingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "KiePayloadMappingError";
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function isStrictKiePayloadMapping(
  value: unknown,
): value is KiePayloadMapping {
  return (
    isRecord(value) &&
    value.adapter === "market-create-task" &&
    isRecord(value.input)
  );
}

function appUrlForKieCallback(): string {
  const app =
    process.env.APP_URL?.trim() || process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (!app) {
    throw new KiePayloadMappingError("APP_URL is not set");
  }
  return app.replace(/\/$/, "");
}

export function defaultKieCallBackUrl(): string {
  return `${appUrlForKieCallback()}/api/webhooks/kie`;
}

function getByPath(source: unknown, path: string[]): unknown {
  let cur: unknown = source;
  for (const part of path) {
    if (Array.isArray(cur) && /^\d+$/.test(part)) {
      const idx = Number(part);
      if (!Number.isInteger(idx) || idx < 0 || idx >= cur.length) return undefined;
      cur = cur[idx];
      continue;
    }
    if (!isRecord(cur)) return undefined;
    cur = cur[part];
  }
  return cur;
}

function resolveExpression(
  expression: string | number | boolean | null,
  ctx: KieMarketPayloadContext,
): unknown {
  if (typeof expression !== "string" || !expression.startsWith("$")) {
    return expression;
  }
  if (expression === "$prompt") {
    return ctx.prompt;
  }
  if (expression === "$inputFiles") {
    return publicHttpUrlsOnly(ctx.inputFiles ?? []);
  }
  if (expression.startsWith("$settings.")) {
    const path = expression.slice("$settings.".length).split(".").filter(Boolean);
    return getByPath(ctx.settings, path);
  }
  return undefined;
}

function isEmpty(value: unknown): boolean {
  if (value === undefined || value === null || value === "") return true;
  if (Array.isArray(value) && value.length === 0) return true;
  return false;
}

function coerceValue(
  fieldName: string,
  value: unknown,
  kind: KiePayloadCoerceKind,
): unknown {
  if (isEmpty(value)) return value;
  if (kind === "string") {
    return String(value);
  }
  if (kind === "number") {
    const n = typeof value === "number" ? value : Number(value);
    if (!Number.isFinite(n)) {
      throw new KiePayloadMappingError(`Поле Kie «${fieldName}»: ожидается число`);
    }
    return n;
  }
  if (kind === "boolean") {
    if (typeof value === "boolean") return value;
    if (typeof value === "string") {
      const s = value.trim().toLowerCase();
      if (s === "true" || s === "1") return true;
      if (s === "false" || s === "0") return false;
    }
    throw new KiePayloadMappingError(
      `Поле Kie «${fieldName}»: ожидается true/false`,
    );
  }
  if (kind === "booleanString") {
    const b = coerceValue(fieldName, value, "boolean");
    return b === true ? "true" : "false";
  }
  if (kind === "stringArray") {
    if (!Array.isArray(value)) {
      throw new KiePayloadMappingError(
        `Поле Kie «${fieldName}»: ожидается список строк`,
      );
    }
    return value
      .filter((item): item is string => typeof item === "string")
      .map((item) => item.trim())
      .filter(Boolean);
  }
  return value;
}

function normalizeMappedValue(
  fieldName: string,
  rawValue: unknown,
  mapping: KiePayloadMapping,
): unknown {
  const coerceKind = mapping.coerce?.[fieldName];
  let value = coerceKind
    ? coerceValue(fieldName, rawValue, coerceKind)
    : rawValue;

  if (Array.isArray(value)) {
    const stringList = value
      .filter((item): item is string => typeof item === "string")
      .map((item) => item.trim())
      .filter(Boolean);

    if (PUBLIC_URL_ARRAY_FIELDS.has(fieldName)) {
      const publicUrls = publicHttpUrlsOnly(stringList);
      if (publicUrls.length !== stringList.length) {
        throw new KiePayloadMappingError(
          `Поле «${fieldName}» должно содержать только публичные http(s) URL`,
        );
      }

      const mustBeInternetReachable =
        process.env.NODE_ENV === "production" ||
        process.env.KIE_ENFORCE_PUBLIC_INPUT_URL_HOST === "1";
      if (mustBeInternetReachable && publicUrls.length > 0) {
        const badHost = publicUrls.filter((u) => !isUrlPubliclyReachableForKie(u));
        if (badHost.length > 0) {
          throw new KiePayloadMappingError(
            `Для Kie нужны домены с публичной доставкой (не localhost/private): поле «${fieldName}»`,
          );
        }
      }

      value = publicUrls;
    } else {
      value = stringList;
    }
  }

  if (PUBLIC_URL_STRING_FIELDS.has(fieldName) && typeof value === "string") {
    const trimmed = value.trim();
    if (trimmed === "") return value;
    const publicUrls = publicHttpUrlsOnly([trimmed]);
    if (publicUrls.length !== 1) {
      throw new KiePayloadMappingError(
        `Поле «${fieldName}» должно быть одним публичным http(s) URL`,
      );
    }
    const mustBeInternetReachable =
      process.env.NODE_ENV === "production" ||
      process.env.KIE_ENFORCE_PUBLIC_INPUT_URL_HOST === "1";
    if (mustBeInternetReachable && !isUrlPubliclyReachableForKie(publicUrls[0]!)) {
      throw new KiePayloadMappingError(
        `Для Kie нужен «${fieldName}» с публично достигаемым хостом (не localhost/private).`,
      );
    }
    value = publicUrls[0];
  }

  return value;
}

export function buildKieMarketPayloadFromMapping(
  mapping: KiePayloadMapping,
  ctx: KieMarketPayloadContext,
): JsonRecord {
  const required = new Set(mapping.required ?? []);
  const input: JsonRecord = { prompt: ctx.prompt };

  for (const [fieldName, expression] of Object.entries(mapping.input)) {
    const rawValue = resolveExpression(expression, ctx);
    const value = normalizeMappedValue(fieldName, rawValue, mapping);
    const empty = isEmpty(value);

    if (empty) {
      if (required.has(fieldName)) {
        throw new KiePayloadMappingError(`Заполните поле «${fieldName}»`);
      }
      if (mapping.omitNull) continue;
    }

    input[fieldName] = value;
  }

  for (const fieldName of required) {
    if (isEmpty(input[fieldName])) {
      throw new KiePayloadMappingError(`Заполните поле «${fieldName}»`);
    }
  }

  return {
    model: ctx.model.apiModelId,
    callBackUrl: ctx.callBackUrl,
    input,
  };
}
