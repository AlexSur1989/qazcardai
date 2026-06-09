import { createApiLog } from "@/server/services/api-log";

export type ProductClassifierAttemptReason =
  | "gate_disabled"
  | "access_denied"
  | "insufficient_credits"
  | "daily_limit"
  | "cooldown"
  | "image_unavailable"
  | "setup"
  | "kie_error"
  | "parse_error"
  | "success";

export type ProductClassifierAttemptStatus = "blocked" | "failed" | "success";

export type LogProductClassifierAttemptInput = {
  userId: string;
  projectId: string;
  modelSlug: string | null;
  status: ProductClassifierAttemptStatus;
  reason: ProductClassifierAttemptReason;
  costCredits: number;
  confidence?: number | null;
  httpStatus?: number | null;
};

function safeHostFromUrl(url: string | null | undefined): string | null {
  if (!url?.trim()) return null;
  try {
    return new URL(url).host;
  } catch {
    return null;
  }
}

/** Audit classifier attempts via ApiLog (без секретов и полных URL). */
export async function logProductClassifierAttempt(
  input: LogProductClassifierAttemptInput,
): Promise<void> {
  try {
    await createApiLog({
      provider: "QAZCARD_CLASSIFIER",
      endpoint: "/product-card/classify",
      statusCode: input.httpStatus ?? (input.status === "success" ? 200 : null),
      requestPayload: {
        userId: input.userId,
        projectId: input.projectId,
        modelSlug: input.modelSlug,
        status: input.status,
        reason: input.reason,
        costCredits: input.costCredits,
      },
      responsePayload:
        input.confidence != null
          ? { confidence: input.confidence }
          : undefined,
      errorMessage:
        input.status === "success"
          ? null
          : `${input.reason}${input.confidence != null ? ` confidence=${input.confidence}` : ""}`,
    });
  } catch {
    // audit must not break classify flow
  }
}

export { safeHostFromUrl };
