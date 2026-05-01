const SENSITIVE_KEY = /^(.*)(secret|api[_-]?key|authorization|password|token)$/i;

export function sanitizeValueForPaymentMetadata(value: unknown): unknown {
  if (value === null || value === undefined) return value;
  if (typeof value === "string") {
    if (value.length > 8000) return `${value.slice(0, 8000)}…[truncated]`;
    return value;
  }
  if (typeof value === "number" || typeof value === "boolean") return value;
  if (Array.isArray(value)) {
    return value.map((x) => sanitizeValueForPaymentMetadata(x));
  }
  if (typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (SENSITIVE_KEY.test(k)) {
        out[k] = "[redacted]";
        continue;
      }
      out[k] = sanitizeValueForPaymentMetadata(v);
    }
    return out;
  }
  return String(value);
}
