import { randomUUID } from "node:crypto";

import type { UserRole } from "@/generated/prisma/enums";
import {
  PRODUCT_CLASSIFIER_COOLDOWN_ERROR,
  PRODUCT_CLASSIFIER_DAILY_LIMIT_ERROR,
  PRODUCT_CLASSIFIER_INSUFFICIENT_CREDITS_ERROR,
} from "@/lib/product-classifier-commercial-copy";
import type { ProductClassifierResult } from "@/lib/product-classifier-result";
import {
  PRODUCT_CLASSIFIER_KIE_ERROR,
  PRODUCT_CLASSIFIER_PARSE_ERROR,
  PRODUCT_CLASSIFIER_SETUP_ERROR,
} from "@/lib/product-classifier-result";
import { isClassifierRuntimeEnabled } from "@/lib/product-classifier-runtime-gate";
import {
  captureClassifierCredits,
  CreditServiceError,
  getBalance,
  refundClassifierCredits,
  reserveClassifierCredits,
} from "@/server/services/credits";
import { logProductClassifierAttempt } from "@/server/services/productClassifierAttemptLog";
import {
  getProductClassifierCommercialSettings,
  isClassifierAccessModeAllowedForRole,
} from "@/server/services/productClassifierCommercialSettings";
import {
  buildDevMockClassifierResult,
  parseDevClassifierMockCategory,
  runSafeProductClassifierFlow,
} from "@/server/services/productClassifierFlow";
import {
  classifyProductWithKieChat,
  ProductClassifierKieHttpError,
  ProductClassifierKieNotEnabledError,
  ProductClassifierParseError,
} from "@/server/services/productClassifierKieChat";
import { resolveDefaultProductClassifierModel } from "@/server/services/productCardModelResolver";
import { isProductClassifierReady } from "@/server/services/productClassifierFlow";
import {
  checkProductClassifyCooldown,
  markProductClassifyCooldown,
  peekRateLimit,
  recordProductClassifyDailyAttempt,
} from "@/server/services/rateLimitService";

export type ProductClassifierClassifyApiOutcome =
  | {
      ok: true;
      result: ProductClassifierResult;
      billing?: { credits: number };
    }
  | {
      ok: false;
      error: string;
      code:
        | "setup"
        | "insufficient_credits"
        | "daily_limit"
        | "cooldown"
        | "invalid_mock"
        | "kie"
        | "parse";
      retryAfter?: number;
    };

export async function executeProductClassifierClassify(args: {
  userId: string;
  userRole: UserRole;
  projectId: string;
  imageUrl: string;
  devMockCategory?: string | null;
}): Promise<ProductClassifierClassifyApiOutcome> {
  const mockCategory = parseDevClassifierMockCategory(args.devMockCategory);
  if (mockCategory) {
    const mock = buildDevMockClassifierResult(mockCategory);
    if (mock.ok) {
      return { ok: true, result: mock.result, billing: { credits: 0 } };
    }
    return { ok: false, error: mock.error, code: mock.code };
  }

  const commercial = await getProductClassifierCommercialSettings();
  const model = await resolveDefaultProductClassifierModel();
  const modelSlug = model?.slug ?? null;
  const costCredits = commercial.costCredits;

  const logBlocked = async (
    reason: Parameters<typeof logProductClassifierAttempt>[0]["reason"],
    httpStatus: number | null = 503,
  ) => {
    await logProductClassifierAttempt({
      userId: args.userId,
      projectId: args.projectId,
      modelSlug,
      status: "blocked",
      reason,
      costCredits: 0,
      httpStatus,
    });
  };

  if (!isClassifierRuntimeEnabled()) {
    await logBlocked("gate_disabled");
    return { ok: false, error: PRODUCT_CLASSIFIER_SETUP_ERROR, code: "setup" };
  }

  if (!isClassifierAccessModeAllowedForRole(commercial.accessMode, args.userRole)) {
    await logBlocked("access_denied");
    return { ok: false, error: PRODUCT_CLASSIFIER_SETUP_ERROR, code: "setup" };
  }

  const ready = await isProductClassifierReady();
  if (!ready || !model) {
    await logBlocked("setup");
    return { ok: false, error: PRODUCT_CLASSIFIER_SETUP_ERROR, code: "setup" };
  }

  const imageUrl = args.imageUrl.trim();
  if (!imageUrl) {
    await logBlocked("setup", 400);
    return {
      ok: false,
      error: "Сначала загрузите фото товара",
      code: "setup",
    };
  }

  const cooldown = await checkProductClassifyCooldown(
    args.userId,
    commercial.cooldownSeconds,
  );
  if (!cooldown.allowed) {
    await logBlocked("cooldown", 429);
    return {
      ok: false,
      error: PRODUCT_CLASSIFIER_COOLDOWN_ERROR,
      code: "cooldown",
      retryAfter: cooldown.retryAfterSec,
    };
  }

  const dailyPeek = await peekRateLimit(
    "classify_daily",
    args.userId,
    commercial.dailyLimit,
    86_400,
  );
  if (!dailyPeek.allowed) {
    await logBlocked("daily_limit", 429);
    return {
      ok: false,
      error: PRODUCT_CLASSIFIER_DAILY_LIMIT_ERROR,
      code: "daily_limit",
      retryAfter: dailyPeek.retryAfterSec,
    };
  }

  if (costCredits > 0) {
    const balance = await getBalance(args.userId);
    if (balance < costCredits) {
      await logBlocked("insufficient_credits", 402);
      return {
        ok: false,
        error: PRODUCT_CLASSIFIER_INSUFFICIENT_CREDITS_ERROR,
        code: "insufficient_credits",
      };
    }
  }

  const operationRef = randomUUID();
  let reserved = false;

  try {
    if (costCredits > 0) {
      await reserveClassifierCredits({
        userId: args.userId,
        amount: costCredits,
        operationRef,
        projectId: args.projectId,
      });
      reserved = true;
    }

    await markProductClassifyCooldown(args.userId, commercial.cooldownSeconds);
    await recordProductClassifyDailyAttempt(args.userId);

    const result = await classifyProductWithKieChat({ imageUrl, model });

    if (costCredits > 0) {
      await captureClassifierCredits(operationRef);
    }

    await logProductClassifierAttempt({
      userId: args.userId,
      projectId: args.projectId,
      modelSlug,
      status: "success",
      reason: "success",
      costCredits,
      confidence: result.confidence,
      httpStatus: 200,
    });

    return {
      ok: true,
      result,
      billing: costCredits > 0 ? { credits: costCredits } : undefined,
    };
  } catch (e) {
    if (reserved) {
      try {
        await refundClassifierCredits(operationRef);
      } catch {
        // best effort
      }
    }

    if (e instanceof ProductClassifierParseError) {
      await logProductClassifierAttempt({
        userId: args.userId,
        projectId: args.projectId,
        modelSlug,
        status: "failed",
        reason: "parse_error",
        costCredits: 0,
        httpStatus: 502,
      });
      return { ok: false, error: PRODUCT_CLASSIFIER_PARSE_ERROR, code: "parse" };
    }
    if (e instanceof ProductClassifierKieHttpError) {
      await logProductClassifierAttempt({
        userId: args.userId,
        projectId: args.projectId,
        modelSlug,
        status: "failed",
        reason: "kie_error",
        costCredits: 0,
        httpStatus: 502,
      });
      return { ok: false, error: PRODUCT_CLASSIFIER_KIE_ERROR, code: "kie" };
    }
    if (e instanceof ProductClassifierKieNotEnabledError) {
      await logBlocked("gate_disabled");
      return { ok: false, error: PRODUCT_CLASSIFIER_SETUP_ERROR, code: "setup" };
    }
    if (e instanceof CreditServiceError && e.code === "INSUFFICIENT") {
      await logBlocked("insufficient_credits", 402);
      return {
        ok: false,
        error: PRODUCT_CLASSIFIER_INSUFFICIENT_CREDITS_ERROR,
        code: "insufficient_credits",
      };
    }

    await logProductClassifierAttempt({
      userId: args.userId,
      projectId: args.projectId,
      modelSlug,
      status: "failed",
      reason: "kie_error",
      costCredits: 0,
      httpStatus: 502,
    });
    return { ok: false, error: PRODUCT_CLASSIFIER_KIE_ERROR, code: "kie" };
  }
}

/** Smoke/verify: setup path без Kie (delegates to runSafeProductClassifierFlow). */
export async function executeProductClassifierClassifyDryPath(args: {
  imageUrl?: string | null;
  devMockCategory?: string | null;
}) {
  return runSafeProductClassifierFlow({
    imageUrl: args.imageUrl,
    devMockCategory: args.devMockCategory,
  });
}
