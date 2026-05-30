/** Парсинг settingsSchema для форм создания генераций (client). */

export type SchemaField = {
  name: string;
  type?: string;
  label?: string;
  default?: unknown;
  /** Алиас сидов Kie (preferred в новых схемах) */
  defaultValue?: unknown;
  /** Подсказка под полем (Kie playground / docs) */
  helpText?: string;
  options?: unknown[];
  required?: boolean;
  /** Для upload-list: макс. число файлов (референсы Seedance и т.п.) */
  maxItems?: number;
};

function schemaFieldEffectiveDefault(field: SchemaField): unknown | undefined {
  if (field.default !== undefined) return field.default;
  if (field.defaultValue !== undefined) return field.defaultValue;
  return undefined;
}

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
    const effective = schemaFieldEffectiveDefault(field);
    if (effective !== undefined) {
      d[field.name] = effective;
      continue;
    }
    if (field.type === "boolean") {
      d[field.name] = false;
    } else if (field.type === "image-upload" || field.type === "url") {
      d[field.name] = "";
    } else if (field.type === "text" || field.type === "textarea") {
      d[field.name] = "";
    } else if (field.type === "text" || field.type === "textarea") {
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
      d[field.name] = '[{"Scene":"","duration":3}]';
    }
  }
  return d;
}
