import type { Prisma } from "@/generated/prisma/client";

const TYPES = new Set(["string", "number", "boolean", "json"]);

export type AppSettingTypeName = "string" | "number" | "boolean" | "json";

export function parseAppSettingString(
  type: string,
  raw: string,
): { ok: true; value: Prisma.InputJsonValue } | { ok: false; message: string } {
  const t = type.trim() as AppSettingTypeName;
  if (!TYPES.has(t)) {
    return { ok: false, message: "Некорректный тип" };
  }
  const s = raw.trim();
  if (t === "string") {
    return { ok: true, value: s };
  }
  if (t === "number") {
    const n = Number(s);
    if (!Number.isFinite(n)) {
      return { ok: false, message: "Нужно конечное число" };
    }
    return { ok: true, value: n };
  }
  if (t === "boolean") {
    if (s === "true" || s === "1") return { ok: true, value: true };
    if (s === "false" || s === "0") return { ok: true, value: false };
    return { ok: false, message: "Для boolean укажите true/false" };
  }
  try {
    const parsed: unknown = JSON.parse(s || "null");
    if (parsed === undefined) {
      return { ok: false, message: "JSON: undefined недопустимо" };
    }
    return { ok: true, value: parsed as Prisma.InputJsonValue };
  } catch {
    return { ok: false, message: "Некорректный JSON" };
  }
}

/** Валидация body PATCH: значение уже распарсено JSON из запроса. */
export function validateAppSettingValueForType(
  type: AppSettingTypeName,
  value: unknown,
): { ok: true; value: Prisma.InputJsonValue } | { ok: false; message: string } {
  if (type === "string") {
    if (typeof value !== "string") {
      return { ok: false, message: "Ожидается строка" };
    }
    return { ok: true, value: value };
  }
  if (type === "number") {
    if (typeof value !== "number" || !Number.isFinite(value)) {
      return { ok: false, message: "Ожидается конечное число" };
    }
    return { ok: true, value: value };
  }
  if (type === "boolean") {
    if (typeof value !== "boolean") {
      return { ok: false, message: "Ожидается boolean" };
    }
    return { ok: true, value: value };
  }
  if (value === null) {
    return { ok: true, value: null as unknown as Prisma.InputJsonValue };
  }
  if (typeof value === "object" || Array.isArray(value)) {
    return { ok: true, value: value as Prisma.InputJsonValue };
  }
  if (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return { ok: true, value: value as Prisma.InputJsonValue };
  }
  return { ok: false, message: "JSON: неподдерживаемое значение" };
}

export function isAppSettingTypeName(s: string): s is AppSettingTypeName {
  return TYPES.has(s);
}
