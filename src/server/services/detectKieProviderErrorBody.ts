export type KieProviderErrorType = "upstream_maintenance" | "upstream_error";

export type DetectKieProviderErrorBodyResult =
  | { isProviderError: false }
  | {
      isProviderError: true;
      errorType: KieProviderErrorType;
      providerCode?: number;
      providerMessage?: string;
    };

const MAINTENANCE_HINTS = ["maintenance", "maintained", "try again later"] as const;

function hasChatCompletionChoices(body: Record<string, unknown>): boolean {
  const choices = body.choices;
  if (!Array.isArray(choices) || choices.length === 0) return false;
  const first = choices[0];
  if (!first || typeof first !== "object" || Array.isArray(first)) return false;
  const content = (first as { message?: { content?: unknown } }).message?.content;
  return typeof content === "string" && content.trim().length > 0;
}

function truncateMessage(raw: string, max = 200): string {
  const t = raw.trim();
  return t.length <= max ? t : `${t.slice(0, max - 1)}…`;
}

function extractProviderMessage(body: Record<string, unknown>): string | undefined {
  const parts: string[] = [];
  if (typeof body.msg === "string" && body.msg.trim()) parts.push(body.msg.trim());
  if (typeof body.message === "string" && body.message.trim()) parts.push(body.message.trim());
  if (typeof body.error === "string" && body.error.trim()) parts.push(body.error.trim());
  if (body.error && typeof body.error === "object" && !Array.isArray(body.error)) {
    const errMsg = (body.error as Record<string, unknown>).message;
    if (typeof errMsg === "string" && errMsg.trim()) parts.push(errMsg.trim());
  }
  if (parts.length === 0) return undefined;
  return truncateMessage(parts[0]!);
}

function isMaintenanceText(text: string): boolean {
  const lower = text.toLowerCase();
  return MAINTENANCE_HINTS.some((hint) => lower.includes(hint));
}

/**
 * Kie иногда возвращает HTTP 200 с JSON `{ code: 500, msg: "…maintenance…" }` без `choices`.
 * Такой ответ — upstream/provider error, не parse_error classifier JSON.
 */
export function detectKieProviderErrorBody(body: unknown): DetectKieProviderErrorBodyResult {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { isProviderError: false };
  }

  const o = body as Record<string, unknown>;
  if (hasChatCompletionChoices(o)) {
    return { isProviderError: false };
  }

  const providerMessage = extractProviderMessage(o);
  let providerCode: number | undefined;
  if (typeof o.code === "number" && Number.isFinite(o.code)) {
    providerCode = Math.floor(o.code);
  }

  const hasProviderCode = providerCode !== undefined && providerCode >= 400;
  const hasProviderMsg = typeof o.msg === "string" && o.msg.trim().length > 0;
  const hasErrorField = o.error !== undefined;
  const hasTopLevelMessage =
    typeof o.message === "string" &&
    o.message.trim().length > 0 &&
    !hasChatCompletionChoices(o);

  if (!hasProviderCode && !hasProviderMsg && !hasErrorField && !hasTopLevelMessage) {
    return { isProviderError: false };
  }

  const maintenanceHint = [providerMessage ?? "", JSON.stringify(o)].some(isMaintenanceText);
  const errorType: KieProviderErrorType = maintenanceHint
    ? "upstream_maintenance"
    : "upstream_error";

  return {
    isProviderError: true,
    errorType,
    providerCode,
    providerMessage,
  };
}

/** Fixture из Paid Classifier Test #3 для smoke без Kie. */
export const KIE_MAINTENANCE_BODY_FIXTURE = {
  msg: "The server is currently being maintained, please try again later~",
  code: 500,
} as const;
