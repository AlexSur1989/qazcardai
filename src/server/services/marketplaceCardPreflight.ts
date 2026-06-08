import type { AiModel } from "@/generated/prisma/client";
import { isRecord } from "@/lib/model-pricing-shared";
import { isMockKie } from "@/lib/kie-mock";
import { getQueueMode } from "@/server/queue-mode";
import { isRedisReachableForQueue } from "@/server/queues/redisConnection";
import {
  buildDryRunKiePayloadForModel,
  isCriticalModelDryRunWarning,
} from "@/server/services/adminModelPayloadDryRun";
import { getMarketplaceCardPricingSummary } from "@/server/services/marketplaceCardPricingSummary";
import { getProductCardModelSetupOverview } from "@/server/services/productCardModelSetup";
import { resolveDefaultMarketplaceCardModel } from "@/server/services/productCardModelResolver";
import { isLocalUploadStorageEffective } from "@/lib/upload-storage-mode";
import { getProductCardSettings } from "@/server/services/productCardSettings";

export type PreflightCheckStatus =
  | "ok"
  | "configured"
  | "missing"
  | "warning"
  | "error";

export type PreflightCheck = {
  key: string;
  label: string;
  status: PreflightCheckStatus;
  message?: string;
};

export type MarketplaceCardPreflightResult = {
  ok: true;
  readyForRealTest: boolean;
  checks: PreflightCheck[];
  warnings: string[];
  finalCredits: number | null;
  modelSlug: string | null;
  queueMode: string;
  mockKie: boolean;
};

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

export async function runMarketplaceCardPreflight(): Promise<MarketplaceCardPreflightResult> {
  const checks: PreflightCheck[] = [];
  const warnings: string[] = [];
  let ready = true;

  const productSettings = await getProductCardSettings();
  const setup = await getProductCardModelSetupOverview();
  const marketplaceSlot = setup.byType.PRODUCT_MARKETPLACE_CARD;
  const model = await resolveDefaultMarketplaceCardModel();

  if (!model) {
    pushCheck(
      checks,
      warnings,
      {
        key: "marketplaceModel",
        label: "Marketplace model assigned",
        status: "missing",
        message: "Модель карточки товара не назначена или не найдена",
      },
      true,
    );
    ready = false;
  } else {
    pushCheck(checks, warnings, {
      key: "marketplaceModel",
      label: "Marketplace model assigned",
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

    validateModelConfig(model, checks, warnings, (ok) => {
      if (!ok) ready = false;
    });

    const dryRun = await buildDryRunKiePayloadForModel(model);
    if (!dryRun.ok) {
      pushCheck(
        checks,
        warnings,
        {
          key: "dryRunPayload",
          label: "Payload dry-run",
          status: "error",
          message: dryRun.error,
        },
        true,
      );
      ready = false;
    } else {
      const critical = dryRun.warnings.filter(isCriticalModelDryRunWarning);
      const input = (dryRun.payload as { input?: Record<string, unknown> }).input;
      const inputUrlsOk = input && Array.isArray(input.input_urls);
      pushCheck(
        checks,
        warnings,
        {
          key: "dryRunPayload",
          label: "Payload dry-run",
          status: critical.length === 0 && inputUrlsOk ? "ok" : "error",
          message:
            critical.length > 0
              ? critical.join("; ")
              : inputUrlsOk
                ? "input.input_urls array OK"
                : "input.input_urls missing or not array",
        },
        true,
      );
      if (critical.length > 0 || !inputUrlsOk) ready = false;
    }
  }

  if (marketplaceSlot?.readinessStatus !== "Ready") {
    pushCheck(
      checks,
      warnings,
      {
        key: "marketplaceReadiness",
        label: "Product Card AI status",
        status: "warning",
        message: marketplaceSlot?.readinessStatus ?? "Missing",
      },
      true,
    );
    ready = false;
  } else {
    pushCheck(checks, warnings, {
      key: "marketplaceReadiness",
      label: "Product Card AI status",
      status: "ok",
      message: "Ready",
    });
  }

  let finalCredits: number | null = null;
  if (model) {
    try {
      const pricing = await getMarketplaceCardPricingSummary(model, productSettings);
      finalCredits = pricing.finalCredits;
      pushCheck(checks, warnings, {
        key: "pricingFinal",
        label: "Final user price",
        status: pricing.finalCredits > 0 ? "ok" : "error",
        message: `${pricing.finalCredits} tokens (base ${pricing.modelBaseCredits}, min ${pricing.minScenarioTokens})`,
      });
      if (pricing.finalCredits <= 0) {
        ready = false;
      }
    } catch (e) {
      pushCheck(
        checks,
        warnings,
        {
          key: "pricingFinal",
          label: "Final user price",
          status: "error",
          message: e instanceof Error ? e.message : "Pricing error",
        },
        true,
      );
      ready = false;
    }
  }

  const kieKeyConfigured = Boolean(process.env.KIE_API_KEY?.trim());
  pushCheck(
    checks,
    warnings,
    {
      key: "kieApiKey",
      label: "KIE_API_KEY",
      status: kieKeyConfigured ? "configured" : "missing",
      message: kieKeyConfigured ? "configured" : "not configured",
    },
    true,
  );
  if (!kieKeyConfigured) ready = false;

  const kieBaseConfigured = Boolean(process.env.KIE_BASE_URL?.trim());
  pushCheck(
    checks,
    warnings,
    {
      key: "kieBaseUrl",
      label: "KIE_BASE_URL",
      status: kieBaseConfigured ? "configured" : "missing",
      message: kieBaseConfigured ? "configured" : "not configured",
    },
    true,
  );
  if (!kieBaseConfigured) ready = false;

  const storageIsLocal = isLocalUploadStorageEffective();
  const s3PublicConfigured = Boolean(process.env.S3_PUBLIC_URL?.trim());
  const s3Ok = storageIsLocal || s3PublicConfigured;
  pushCheck(
    checks,
    warnings,
    {
      key: "s3PublicUrl",
      label: "S3_PUBLIC_URL",
      status: s3Ok ? "configured" : "missing",
      message: storageIsLocal
        ? "local uploads (dev)"
        : s3PublicConfigured
          ? "configured"
          : "required for S3 uploads",
    },
    !storageIsLocal,
  );
  if (!storageIsLocal && !s3PublicConfigured) ready = false;

  const queueMode = getQueueMode();
  pushCheck(checks, warnings, {
    key: "queueMode",
    label: "QUEUE_MODE",
    status: "ok",
    message: queueMode,
  });

  const redisConfigured = Boolean(process.env.REDIS_URL?.trim());
  pushCheck(
    checks,
    warnings,
    {
      key: "redisUrl",
      label: "REDIS_URL",
      status: redisConfigured ? "configured" : queueMode === "inline" ? "warning" : "missing",
      message: redisConfigured ? "configured" : "not configured",
    },
    queueMode === "redis",
  );

  if (queueMode === "redis") {
    if (!redisConfigured) {
      ready = false;
    } else {
      const redisUp = await isRedisReachableForQueue();
      pushCheck(
        checks,
        warnings,
        {
          key: "redisReachable",
          label: "Redis reachable",
          status: redisUp ? "ok" : "error",
          message: redisUp ? "PING OK" : "connection failed",
        },
        true,
      );
      if (!redisUp) ready = false;
    }
  }

  const mockKie = isMockKie();
  pushCheck(checks, warnings, {
    key: "mockKie",
    label: "MOCK_KIE",
    status: mockKie ? "warning" : "ok",
    message: mockKie ? "true (real Kie test disabled)" : "false",
  });
  if (mockKie) {
    warnings.push("MOCK_KIE=true: real Kie.ai API will not be called");
    ready = false;
  }

  return {
    ok: true,
    readyForRealTest: ready,
    checks,
    warnings,
    finalCredits,
    modelSlug: model?.slug ?? null,
    queueMode,
    mockKie,
  };
}

function validateModelConfig(
  model: AiModel,
  checks: PreflightCheck[],
  warnings: string[],
  onFail: (ok: boolean) => void,
) {
  const apiId = model.apiModelId?.trim() ?? "";
  if (!apiId || isPlaceholderApiModelId(apiId)) {
    pushCheck(
      checks,
      warnings,
      {
        key: "apiModelId",
        label: "apiModelId",
        status: "error",
        message: apiId || "missing",
      },
      true,
    );
    onFail(false);
  } else {
    pushCheck(checks, warnings, {
      key: "apiModelId",
      label: "apiModelId",
      status: "ok",
      message: apiId,
    });
  }

  if (!model.endpoint?.trim()) {
    pushCheck(
      checks,
      warnings,
      { key: "endpoint", label: "endpoint", status: "missing", message: "missing" },
      true,
    );
    onFail(false);
  } else {
    pushCheck(checks, warnings, {
      key: "endpoint",
      label: "endpoint",
      status: "ok",
      message: model.endpoint,
    });
  }

  if (!model.statusEndpoint?.trim()) {
    pushCheck(
      checks,
      warnings,
      { key: "statusEndpoint", label: "statusEndpoint", status: "missing", message: "missing" },
      true,
    );
    onFail(false);
  } else {
    pushCheck(checks, warnings, {
      key: "statusEndpoint",
      label: "statusEndpoint",
      status: "ok",
      message: model.statusEndpoint,
    });
  }

  if (!model.supportsImageInput) {
    pushCheck(
      checks,
      warnings,
      {
        key: "supportsImageInput",
        label: "supportsImageInput",
        status: "error",
        message: "false",
      },
      true,
    );
    onFail(false);
  } else {
    pushCheck(checks, warnings, {
      key: "supportsImageInput",
      label: "supportsImageInput",
      status: "ok",
    });
  }

  const pm = model.payloadMapping;
  if (!isRecord(pm) || Object.keys(pm).length === 0) {
    pushCheck(
      checks,
      warnings,
      { key: "payloadMapping", label: "payloadMapping", status: "missing", message: "empty" },
      true,
    );
    onFail(false);
  } else {
    pushCheck(checks, warnings, {
      key: "payloadMapping",
      label: "payloadMapping",
      status: "ok",
    });
  }

  const ps = model.pricingSchema;
  if (!isRecord(ps) || Object.keys(ps).length === 0) {
    pushCheck(
      checks,
      warnings,
      { key: "pricingSchema", label: "pricingSchema", status: "missing", message: "empty" },
      true,
    );
    onFail(false);
  } else {
    pushCheck(checks, warnings, {
      key: "pricingSchema",
      label: "pricingSchema",
      status: "ok",
    });
  }

  if (model.costCredits <= 0) {
    pushCheck(
      checks,
      warnings,
      {
        key: "costCredits",
        label: "costCredits",
        status: "error",
        message: String(model.costCredits),
      },
      true,
    );
    onFail(false);
  } else {
    pushCheck(checks, warnings, {
      key: "costCredits",
      label: "costCredits",
      status: "ok",
      message: String(model.costCredits),
    });
  }
}
