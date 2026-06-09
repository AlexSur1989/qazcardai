import type { AiModel } from "@/generated/prisma/client";
import { isRecord } from "@/lib/model-pricing-shared";
import { isMockKie } from "@/lib/kie-mock";
import { isClassifierRuntimeEnabled } from "@/lib/product-classifier-runtime-gate";
import { PRODUCT_CLASSIFIER_DRY_RUN_SAMPLE_IMAGE } from "@/config/product-classifier-kie-prompt";
import {
  buildDryRunClassifierPayloadForModel,
  isCriticalClassifierDryRunWarning,
} from "@/server/services/adminClassifierPayloadDryRun";
import { getProductCardModelSetupOverview } from "@/server/services/productCardModelSetup";
import { resolveDefaultProductClassifierModel } from "@/server/services/productCardModelResolver";
import { getProductCardSettings } from "@/server/services/productCardSettings";
import { getProductClassifierCommercialSettings } from "@/server/services/productClassifierCommercialSettings";
import type { PreflightCheck, PreflightCheckStatus } from "@/server/services/marketplaceCardPreflight";

export type { PreflightCheck, PreflightCheckStatus };

export type ClassifierPreflightResult = {
  ok: true;
  readyForRealTest: boolean;
  readyForUserTraffic: boolean;
  checks: PreflightCheck[];
  warnings: string[];
  modelSlug: string | null;
  mockKie: boolean;
  commercial: {
    accessMode: string;
    costCredits: number;
    dailyLimit: number;
    cooldownSeconds: number;
    timeoutMs: number;
  };
};

/** Для verify/smoke: slot блокирует readyForRealTest, если модель не generationReady. */
export function classifierSlotBlocksReadyForRealTest(
  slot: { generationReady: boolean } | undefined,
): boolean {
  return !slot?.generationReady;
}

function isPlaceholderApiModelId(apiModelId: string): boolean {
  const t = apiModelId.trim().toUpperCase();
  return t === "PLACEHOLDER" || t === "CHANGE_ME" || t.startsWith("PASTE_");
}

function pushCheck(
  checks: PreflightCheck[],
  warnings: string[],
  check: PreflightCheck,
  blocksRealTest = false,
) {
  checks.push(check);
  if (blocksRealTest && check.status !== "ok" && check.status !== "configured") {
    warnings.push(check.message ?? `${check.label}: ${check.status}`);
  }
}

function validateClassifierModelConfig(
  model: AiModel,
  checks: PreflightCheck[],
  warnings: string[],
  onFail: (failed: boolean) => void,
) {
  let failed = false;
  const fail = (check: PreflightCheck) => {
    pushCheck(checks, warnings, check, true);
    failed = true;
  };
  const ok = (key: string, label: string, message?: string) => {
    pushCheck(checks, warnings, { key, label, status: "ok", message });
  };

  if (!model.apiModelId?.trim()) {
    fail({ key: "apiModelId", label: "apiModelId", status: "missing", message: "Пустой apiModelId" });
  } else if (isPlaceholderApiModelId(model.apiModelId)) {
    fail({
      key: "apiModelId",
      label: "apiModelId",
      status: "error",
      message: "apiModelId is PLACEHOLDER",
    });
  } else {
    ok("apiModelId", "apiModelId", model.apiModelId);
  }

  if (!model.endpoint?.trim()) {
    fail({ key: "endpoint", label: "endpoint", status: "missing", message: "endpoint missing" });
  } else {
    ok("endpoint", "endpoint", model.endpoint);
  }

  if (!model.supportsImageInput) {
    fail({
      key: "supportsImageInput",
      label: "supportsImageInput",
      status: "error",
      message: "supportsImageInput=false",
    });
  } else {
    ok("supportsImageInput", "supportsImageInput", "true");
  }

  if (!isRecord(model.payloadMapping) || Object.keys(model.payloadMapping).length === 0) {
    fail({
      key: "payloadMapping",
      label: "payloadMapping",
      status: "missing",
      message: "payloadMapping missing",
    });
  } else {
    ok("payloadMapping", "payloadMapping");
  }

  if (!isRecord(model.pricingSchema) || Object.keys(model.pricingSchema).length === 0) {
    fail({
      key: "pricingSchema",
      label: "pricingSchema",
      status: "missing",
      message: "pricingSchema missing",
    });
  } else {
    ok("pricingSchema", "pricingSchema");
  }

  if (model.costCredits <= 0) {
    fail({
      key: "costCredits",
      label: "costCredits",
      status: "error",
      message: "costCredits must be > 0",
    });
  } else {
    ok("costCredits", "costCredits", String(model.costCredits));
  }

  onFail(failed);
}

export async function runClassifierPreflight(): Promise<ClassifierPreflightResult> {
  const checks: PreflightCheck[] = [];
  const warnings: string[] = [];
  let ready = true;
  let readyForUserTraffic = true;
  const mockKie = isMockKie();

  const commercial = await getProductClassifierCommercialSettings();
  await getProductCardSettings();
  const setup = await getProductCardModelSetupOverview();
  const classifierSlot = setup.byType.PRODUCT_CLASSIFIER;
  const model = await resolveDefaultProductClassifierModel();

  if (!model) {
    pushCheck(
      checks,
      warnings,
      {
        key: "classifierModel",
        label: "Classifier model assigned",
        status: "missing",
        message: "Модель classifier не назначена или не найдена",
      },
      true,
    );
    ready = false;
  } else {
    pushCheck(checks, warnings, {
      key: "classifierModel",
      label: "Classifier model assigned",
      status: "ok",
      message: model.slug,
    });

    if (!model.isActive) {
      pushCheck(
        checks,
        warnings,
        {
          key: "modelActive",
          label: "Model isActive",
          status: "error",
          message: "Модель неактивна",
        },
        true,
      );
      ready = false;
    } else {
      pushCheck(checks, warnings, {
        key: "modelActive",
        label: "Model isActive",
        status: "ok",
      });
    }

    validateClassifierModelConfig(model, checks, warnings, (failed) => {
      if (failed) ready = false;
    });

    const dryRun = await buildDryRunClassifierPayloadForModel(
      model,
      PRODUCT_CLASSIFIER_DRY_RUN_SAMPLE_IMAGE,
    );
    if (!dryRun.ok) {
      pushCheck(
        checks,
        warnings,
        {
          key: "dryRunPayload",
          label: "Classifier dry-run payload",
          status: "error",
          message: dryRun.error,
        },
        true,
      );
      ready = false;
    } else {
      const critical = dryRun.warnings.filter(isCriticalClassifierDryRunWarning);
      pushCheck(checks, warnings, {
        key: "dryRunPayload",
        label: "Classifier dry-run payload",
        status: critical.length > 0 ? "error" : "ok",
        message:
          critical.length > 0
            ? critical.join("; ")
            : "chat/completions payload shape OK",
      });
      if (critical.length > 0) ready = false;
      for (const w of dryRun.warnings.filter((x) => !isCriticalClassifierDryRunWarning(x))) {
        pushCheck(checks, warnings, {
          key: `dryRunWarn:${w.slice(0, 24)}`,
          label: "Dry-run warning",
          status: "warning",
          message: w,
        });
      }
    }
  }

  if (classifierSlot && classifierSlotBlocksReadyForRealTest(classifierSlot)) {
    const slotMessage =
      classifierSlot.readinessStatus === "ConfiguredDisabled"
        ? "Configured but disabled: runtime gate off"
        : `${classifierSlot.readinessStatus}: ${classifierSlot.readinessIssues.join(", ") || classifierSlot.adminHint}`;
    pushCheck(
      checks,
      warnings,
      {
        key: "classifierSlot",
        label: "Classifier slot readiness",
        status: "warning",
        message: slotMessage,
      },
      true,
    );
    ready = false;
  } else if (classifierSlot) {
    pushCheck(checks, warnings, {
      key: "classifierSlot",
      label: "Classifier slot readiness",
      status: "ok",
      message: classifierSlot.generationReady ? "Ready (generationReady)" : "Ready",
    });
  }

  const runtimeGateEnabled = isClassifierRuntimeEnabled();
  pushCheck(
    checks,
    warnings,
    {
      key: "classifierRuntimeGate",
      label: "PRODUCT_CLASSIFIER_ALLOW_REAL_KIE",
      status: runtimeGateEnabled ? "ok" : "warning",
      message: runtimeGateEnabled
        ? "enabled"
        : "Real Kie classifier disabled. Set PRODUCT_CLASSIFIER_ALLOW_REAL_KIE=true before real test.",
    },
    !runtimeGateEnabled,
  );
  if (!runtimeGateEnabled) ready = false;

  pushCheck(
    checks,
    warnings,
    {
      key: "classifierAccessMode",
      label: "PRODUCT_CLASSIFIER_ACCESS_MODE",
      status:
        commercial.accessMode === "disabled"
          ? "warning"
          : commercial.accessMode === "all_users"
            ? "ok"
            : "configured",
      message: commercial.accessMode,
    },
    commercial.accessMode === "disabled",
  );
  if (commercial.accessMode === "disabled") {
    ready = false;
    readyForUserTraffic = false;
  } else if (commercial.accessMode !== "all_users") {
    readyForUserTraffic = false;
  }

  pushCheck(checks, warnings, {
    key: "classifierCostCredits",
    label: "Classifier cost credits",
    status: "configured",
    message: String(commercial.costCredits),
  });
  pushCheck(checks, warnings, {
    key: "classifierDailyLimit",
    label: "Classifier daily limit",
    status: "configured",
    message: String(commercial.dailyLimit),
  });
  pushCheck(checks, warnings, {
    key: "classifierCooldown",
    label: "Classifier cooldown seconds",
    status: "configured",
    message: String(commercial.cooldownSeconds),
  });
  pushCheck(checks, warnings, {
    key: "classifierTimeoutMs",
    label: "Classifier Kie timeout (ms)",
    status: "configured",
    message: String(commercial.timeoutMs),
  });

  pushCheck(checks, warnings, {
    key: "classifierBilling",
    label: "Classifier billing (RESERVE/CAPTURE/REFUND)",
    status: "ok",
    message: "operationRef in CreditTransaction.metadata, без Generation",
  });

  if (!runtimeGateEnabled || commercial.accessMode !== "all_users") {
    readyForUserTraffic = false;
  } else if (!ready) {
    readyForUserTraffic = false;
  }

  const kieKey = process.env.KIE_API_KEY?.trim();
  pushCheck(
    checks,
    warnings,
    {
      key: "kieApiKey",
      label: "KIE_API_KEY",
      status: kieKey ? "configured" : "missing",
      message: kieKey ? "configured" : "KIE_API_KEY not set",
    },
    !kieKey,
  );
  if (!kieKey) ready = false;

  const kieBase = process.env.KIE_BASE_URL?.trim() || "https://api.kie.ai";
  pushCheck(checks, warnings, {
    key: "kieBaseUrl",
    label: "KIE_BASE_URL",
    status: "configured",
    message: kieBase,
  });

  const s3Public = process.env.S3_PUBLIC_URL?.trim();
  pushCheck(
    checks,
    warnings,
    {
      key: "s3PublicUrl",
      label: "S3_PUBLIC_URL",
      status: s3Public ? "configured" : "missing",
      message: s3Public ?? "S3_PUBLIC_URL not set",
    },
    !s3Public,
  );
  if (!s3Public) ready = false;

  pushCheck(checks, warnings, {
    key: "sampleImageUrl",
    label: "Dry-run sample image URL",
    status: "ok",
    message: PRODUCT_CLASSIFIER_DRY_RUN_SAMPLE_IMAGE,
  });

  pushCheck(checks, warnings, {
    key: "mockKie",
    label: "MOCK_KIE",
    status: mockKie ? "warning" : "ok",
    message: mockKie ? "true — real Kie will be mocked" : "false",
  });

  return {
    ok: true,
    readyForRealTest: ready,
    readyForUserTraffic,
    checks,
    warnings,
    modelSlug: model?.slug ?? null,
    mockKie,
    commercial: {
      accessMode: commercial.accessMode,
      costCredits: commercial.costCredits,
      dailyLimit: commercial.dailyLimit,
      cooldownSeconds: commercial.cooldownSeconds,
      timeoutMs: commercial.timeoutMs,
    },
  };
}
