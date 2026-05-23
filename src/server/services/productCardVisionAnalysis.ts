import "server-only";

import type { AiModel } from "@/generated/prisma/client";
import { getProductCardVisionAnalysisPrompt } from "@/config/product-card-prompts";
import { getCardBuilderVisionPromptFromSettings } from "@/server/services/cardBuilderPromptsSettings";
import {
  CARD_BUILDER_PACKAGING_TYPES,
  parseUniversalCategoryId,
  type CardBuilderPackagingType,
  type CardBuilderUniversalCategoryId,
} from "@/config/card-builder-universal";
import {
  CARD_BUILDER_PRODUCT_FACT_TYPES,
  newProductFactId,
  type CardBuilderProductFact,
  type CardBuilderProductFactType,
} from "@/lib/card-builder-product-facts";
import { isMockKie } from "@/lib/kie-mock";
import { createApiLog } from "@/server/services/api-log";
import { readImageForVision } from "@/server/services/productClassifier";
import { resolveProductCardVisionModel } from "@/server/services/productCardModelResolver";
import {
  assertKieModelIdSet,
  getKieBaseUrl,
  redactKieLogPayload,
  resolveKieRequestUrl,
  trimKieApiModelId,
} from "@/server/services/provider/kie";

export type ProductCardVisionSuggestedFact = {
  label: string;
  value: string;
  type: CardBuilderProductFactType;
  confidence: number;
};

export type ProductCardVisionAnalysisResult = {
  categoryKey: CardBuilderUniversalCategoryId;
  productType: string;
  productNameGuess: string;
  mainColors: string[];
  materialGuess: string | null;
  styleGuess: string | null;
  visibleText: string[];
  packaging: CardBuilderPackagingType;
  productShape: string | null;
  mainObjects: string[];
  suggestedProductFacts: ProductCardVisionSuggestedFact[];
  confidence: number;
  warnings: string[];
  /** Внутренний флаг; не отдавать клиенту provider/model. */
  analysisFailed?: boolean;
};

export type AnalyzeProductImageForCardBuilderArgs = {
  imageUrl: string;
  projectId?: string;
  userId?: string;
};

const PARSE_FAIL = "Не удалось разобрать ответ анализа изображения.";

function kieVisionHttpError(body: unknown, status: number): string {
  if (body && typeof body === "object" && !Array.isArray(body)) {
    const o = body as Record<string, unknown>;
    const err = o.error;
    if (err && typeof err === "object" && !Array.isArray(err)) {
      const m = (err as Record<string, unknown>).message;
      if (typeof m === "string" && m.trim()) {
        return `Ошибка Kie.ai (${status}): ${m.trim().slice(0, 400)}`;
      }
    }
    const msg = o.message ?? o.msg;
    if (typeof msg === "string" && msg.trim()) {
      return `Ошибка Kie.ai (${status}): ${msg.trim().slice(0, 400)}`;
    }
  }
  return `Сервис анализа фото вернул код ${status}. Заполните данные вручную.`;
}

function extractJsonString(raw: string): string {
  const t = raw.trim();
  const fence = /^```(?:json)?\s*([\s\S]*?)```/m.exec(t);
  if (fence) return fence[1]!.trim();
  const a = t.indexOf("{");
  const b = t.lastIndexOf("}");
  if (a >= 0 && b > a) return t.slice(a, b + 1);
  return t;
}

function parsePackaging(raw: unknown): CardBuilderPackagingType {
  if (typeof raw !== "string") return "none";
  const t = raw.trim();
  if ((CARD_BUILDER_PACKAGING_TYPES as readonly string[]).includes(t)) {
    return t as CardBuilderPackagingType;
  }
  return "other";
}

function parseFactType(raw: unknown): CardBuilderProductFactType {
  if (typeof raw !== "string") return "other";
  const t = raw.trim();
  if ((CARD_BUILDER_PRODUCT_FACT_TYPES as readonly string[]).includes(t)) {
    return t as CardBuilderProductFactType;
  }
  return "other";
}

function parseStringList(raw: unknown, max = 12): string[] {
  if (!Array.isArray(raw)) return [];
  const out: string[] = [];
  for (const x of raw) {
    if (typeof x !== "string") continue;
    const t = x.trim().slice(0, 200);
    if (!t) continue;
    out.push(t);
    if (out.length >= max) break;
  }
  return out;
}

function validateVisionJson(parsed: unknown): ProductCardVisionAnalysisResult | null {
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
  const o = parsed as Record<string, unknown>;

  let confidence = 0.5;
  if (typeof o.confidence === "number" && Number.isFinite(o.confidence)) {
    confidence = Math.min(1, Math.max(0, o.confidence));
  }

  const suggested: ProductCardVisionSuggestedFact[] = [];
  if (Array.isArray(o.suggestedProductFacts)) {
    for (const row of o.suggestedProductFacts) {
      if (!row || typeof row !== "object" || Array.isArray(row)) continue;
      const r = row as Record<string, unknown>;
      const label = typeof r.label === "string" ? r.label.trim().slice(0, 120) : "";
      const value = typeof r.value === "string" ? r.value.trim().slice(0, 400) : "";
      if (!label || !value) continue;
      let fc = 0.5;
      if (typeof r.confidence === "number" && Number.isFinite(r.confidence)) {
        fc = Math.min(1, Math.max(0, r.confidence));
      }
      suggested.push({
        label,
        value,
        type: parseFactType(r.type),
        confidence: fc,
      });
      if (suggested.length >= 16) break;
    }
  }

  const materialGuess =
    typeof o.materialGuess === "string" && o.materialGuess.trim()
      ? o.materialGuess.trim().slice(0, 200)
      : null;
  const styleGuess =
    typeof o.styleGuess === "string" && o.styleGuess.trim()
      ? o.styleGuess.trim().slice(0, 200)
      : null;
  const productShape =
    typeof o.productShape === "string" && o.productShape.trim()
      ? o.productShape.trim().slice(0, 200)
      : null;

  return {
    categoryKey: parseUniversalCategoryId(o.categoryKey),
    productType:
      typeof o.productType === "string" ? o.productType.trim().slice(0, 200) : "",
    productNameGuess:
      typeof o.productNameGuess === "string" ? o.productNameGuess.trim().slice(0, 200) : "",
    mainColors: parseStringList(o.mainColors, 8),
    materialGuess,
    styleGuess,
    visibleText: parseStringList(o.visibleText, 12),
    packaging: parsePackaging(o.packaging),
    productShape,
    mainObjects: parseStringList(o.mainObjects, 8),
    suggestedProductFacts: suggested,
    confidence,
    warnings: parseStringList(o.warnings, 8),
  };
}

function emptyFailedResult(warnings: string[]): ProductCardVisionAnalysisResult {
  return {
    categoryKey: "other",
    productType: "",
    productNameGuess: "",
    mainColors: [],
    materialGuess: null,
    styleGuess: null,
    visibleText: [],
    packaging: "none",
    productShape: null,
    mainObjects: [],
    suggestedProductFacts: [],
    confidence: 0,
    warnings,
    analysisFailed: true,
  };
}

function mockVisionResult(): ProductCardVisionAnalysisResult {
  return {
    categoryKey: "other",
    productType: "товар",
    productNameGuess: "",
    mainColors: ["нейтральный"],
    materialGuess: null,
    styleGuess: "универсальный",
    visibleText: [],
    packaging: "none",
    productShape: null,
    mainObjects: ["товар"],
    suggestedProductFacts: [],
    confidence: 0.75,
    warnings: ["Тестовый режим: проверьте данные вручную."],
  };
}

/** Тот же путь, что у классификатора категории: /{apiModelId}/v1/chat/completions */
function chatCompletionsPathForKieModel(apiModelIdRaw: string): string {
  const id = assertKieModelIdSet(apiModelIdRaw);
  const seg = id.startsWith("/") ? id.slice(1) : id;
  return `/${seg}/v1/chat/completions`;
}

function classifierModelOverrideFromEnv(): string {
  const envM = (process.env.PRODUCT_CLASSIFIER_MODEL ?? "").trim();
  if (envM && envM.toLowerCase() !== "mock") return envM;
  return "";
}

export function visionAnalysisToProductFacts(
  analysis: ProductCardVisionAnalysisResult,
): CardBuilderProductFact[] {
  const out: CardBuilderProductFact[] = [];
  const push = (fact: Omit<CardBuilderProductFact, "id">) => {
    out.push({ id: newProductFactId(), ...fact });
  };

  for (const row of analysis.suggestedProductFacts) {
    push({
      label: row.label,
      value: row.value,
      type: row.type,
      source: "vision_ai",
      confidence: row.confidence,
      needsReview: row.confidence < 0.55,
      lockedText: true,
      visibleOnCard: true,
    });
  }

  if (analysis.materialGuess) {
    push({
      label: "Материал",
      value: analysis.materialGuess,
      type: "material",
      source: "vision_ai",
      confidence: analysis.confidence,
      needsReview: analysis.confidence < 0.6,
      lockedText: true,
      visibleOnCard: true,
    });
  }

  for (const line of analysis.visibleText) {
    push({
      label: "Текст на упаковке",
      value: line,
      type: "detail",
      source: "vision_ai",
      confidence: 0.7,
      needsReview: true,
      lockedText: true,
      visibleOnCard: true,
    });
  }

  return out.slice(0, 24);
}

/** Публичный DTO для UI (без provider/model). */
export function toPublicVisionAnalysisPayload(
  analysis: ProductCardVisionAnalysisResult,
): Omit<ProductCardVisionAnalysisResult, "analysisFailed"> & {
  analysisFailed: boolean;
  productFacts: CardBuilderProductFact[];
} {
  const { analysisFailed, ...rest } = analysis;
  return {
    ...rest,
    analysisFailed: analysisFailed === true,
    productFacts: visionAnalysisToProductFacts(analysis),
  };
}

async function analyzeWithKieModel(
  imageUrl: string,
  aiModel: AiModel,
): Promise<ProductCardVisionAnalysisResult> {
  if (aiModel.provider !== "KIE_AI") {
    return emptyFailedResult([
      "Модель анализа не относится к Kie.ai — проверьте настройки карточки товара.",
    ]);
  }

  const legacyTrim = classifierModelOverrideFromEnv();
  const apiModelId = legacyTrim || aiModel.apiModelId;
  const modelField = trimKieApiModelId(apiModelId);
  assertKieModelIdSet(modelField);

  if (isMockKie()) {
    return mockVisionResult();
  }

  const rawKey = process.env.KIE_API_KEY?.trim() ?? "";
  if (!rawKey) {
    return emptyFailedResult([
      "Анализ изображения временно недоступен. Заполните данные товара вручную.",
    ]);
  }

  let vision: { mime: string; base64: string };
  try {
    vision = await readImageForVision(imageUrl);
  } catch {
    return emptyFailedResult(["Не удалось прочитать фото. Проверьте загрузку и повторите."]);
  }

  const dataUrl = `data:${vision.mime};base64,${vision.base64}`;
  const path = chatCompletionsPathForKieModel(apiModelId);
  const requestUrl = resolveKieRequestUrl(getKieBaseUrl(), aiModel.endpoint, path);

  let authKey = rawKey;
  if (authKey.length >= 7 && authKey.slice(0, 7).toLowerCase() === "bearer ") {
    authKey = authKey.slice(7).trim();
  }

  const visionPromptPack = await getCardBuilderVisionPromptFromSettings();
  const visionPromptText =
    visionPromptPack.prompt.trim() || getProductCardVisionAnalysisPrompt();

  const body: Record<string, unknown> = {
    model: modelField,
    response_format: { type: "json_object" },
    max_tokens: 1200,
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: visionPromptText },
          { type: "image_url", image_url: { url: dataUrl, detail: "low" } },
        ],
      },
    ],
  };

  const endpointForLog = requestUrl.split("?")[0]!.slice(0, 2048);

  try {
    const res = await fetch(requestUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${authKey}`,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(90_000),
    });

    const text = await res.text();
    let resBody: unknown;
    try {
      resBody = text ? JSON.parse(text) : null;
    } catch {
      resBody = { raw: text.slice(0, 2000) };
    }

    if (!res.ok) {
      const errMsg = kieVisionHttpError(resBody, res.status);
      await createApiLog({
        provider: "KIE_AI",
        endpoint: endpointForLog,
        requestPayload: redactKieLogPayload(body) as unknown,
        responsePayload: resBody,
        statusCode: res.status,
        errorMessage: errMsg,
      });
      return emptyFailedResult([errMsg]);
    }

    const content =
      (resBody as { choices?: { message?: { content?: string } }[] })?.choices?.[0]?.message
        ?.content ?? "";
    if (!content.trim()) {
      return emptyFailedResult([PARSE_FAIL]);
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(extractJsonString(content));
    } catch {
      return emptyFailedResult([PARSE_FAIL]);
    }

    const validated = validateVisionJson(parsed);
    if (!validated) {
      return emptyFailedResult([PARSE_FAIL]);
    }
    return validated;
  } catch (e) {
    const msg = e instanceof Error ? e.message : "network error";
    await createApiLog({
      provider: "KIE_AI",
      endpoint: endpointForLog,
      requestPayload: redactKieLogPayload(body) as unknown,
      responsePayload: undefined,
      statusCode: null,
      errorMessage: msg.slice(0, 10_000),
    });
    return emptyFailedResult([
      "Не удалось связаться с сервисом анализа. Заполните данные вручную.",
    ]);
  }
}

export async function analyzeProductImageForCardBuilder(
  args: AnalyzeProductImageForCardBuilderArgs,
): Promise<ProductCardVisionAnalysisResult> {
  const url = args.imageUrl?.trim() ?? "";
  if (!url) {
    return emptyFailedResult(["Сначала загрузите фото товара."]);
  }

  if ((process.env.PRODUCT_CLASSIFIER_PROVIDER ?? "").trim() === "mock") {
    return mockVisionResult();
  }

  const aiModel = await resolveProductCardVisionModel();
  if (!aiModel) {
    return emptyFailedResult([
      "Модель анализа не настроена. Заполните данные товара вручную.",
    ]);
  }

  if (!aiModel.supportsImageInput) {
    return emptyFailedResult([
      "Модель анализа не поддерживает входное изображение. Заполните данные вручную.",
    ]);
  }

  return analyzeWithKieModel(url, aiModel);
}
