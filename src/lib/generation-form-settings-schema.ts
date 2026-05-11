/** Парсинг settingsSchema для форм создания генераций (client). */

export type SchemaField = {
  name: string;
  type?: string;
  label?: string;
  default?: unknown;
  options?: unknown[];
  required?: boolean;
  /** Для upload-list: макс. число файлов (референсы Seedance и т.п.) */
  maxItems?: number;
};

export function getSchemaFields(schema: unknown): SchemaField[] {
  let s: unknown = schema;
  if (typeof s === "string") {
    try {
      s = JSON.parse(s) as unknown;
    } catch {
      return [];
    }
  }
  if (!s || typeof s !== "object" || !("fields" in s)) {
    return [];
  }
  const schemaObj = s as { fields: unknown };
  const f = schemaObj.fields;
  if (!Array.isArray(f)) return [];
  return f.filter(
    (x): x is SchemaField =>
      !!x &&
      typeof x === "object" &&
      "name" in x &&
      typeof (x as SchemaField).name === "string",
  );
}

export function defaultsFromSchema(schema: unknown): Record<string, unknown> {
  const fields = getSchemaFields(schema);
  const d: Record<string, unknown> = {};
  for (const field of fields) {
    if (field.default !== undefined) {
      d[field.name] = field.default;
    } else if (field.type === "boolean") {
      d[field.name] = false;
    } else if (field.type === "image-upload" || field.type === "url") {
      d[field.name] = "";
    } else if (
      field.type === "url-list" ||
      field.type === "upload-list" ||
      field.type === "image-upload-list" ||
      field.type === "video-upload-list" ||
      field.type === "audio-upload-list"
    ) {
      d[field.name] = [];
    } else if (field.type === "json") {
      d[field.name] =
        field.default !== undefined
          ? field.default
          : '[{"Scene":"","duration":3}]';
    }
  }
  return d;
}
