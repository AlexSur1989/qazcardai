import type { AiModel } from "@/generated/prisma/client";
import { isMockKie } from "@/lib/kie-mock";
import { toAbsoluteIfAppPath } from "@/lib/app-base-url";
import {
  normalizeClassifierCategoryId,
  type ProductClassifierResult,
  PRODUCT_CLASSIFIER_KIE_ERROR,
  PRODUCT_CLASSIFIER_PARSE_ERROR,
  sanitizeProductClassifierResult,
} from "@/lib/product-classifier-result";
import {
  getProductClassifierKieUserText,
  PRODUCT_CLASSIFIER_KIE_SYSTEM_PROMPT,
} from "@/config/product-classifier-kie-prompt";
import { createApiLog } from "@/server/services/api-log";
import { readImageForVision } from "@/server/services/productClassifierVision";
import {
  assertKieModelIdSet,
  getKieBaseUrl,
  redactKieLogPayload,
  resolveKieRequestUrl,
  trimKieApiModelId,
} from "@/server/services/provider/kie";

export type ClassifierKieChatInput = {
  imageUrl: string;
  model: AiModel;
  timeoutMs?: number;
  diagnostics?: {
    operationRef?: string;
    projectId?: string;
    userId?: string;
    modelSlug?: string | null;
    costCredits?: number;
  };
};

export type ClassifierKieErrorType =
  | "timeout"
  | "fetch_failed"
  | "http_error"
  | "parse_error";

export class ProductClassifierKieNotEnabledError extends Error {
  constructor() {
    super("PRODUCT_CLASSIFIER_ALLOW_REAL_KIE is not enabled");
    this.name = "ProductClassifierKieNotEnabledError";
  }
}

export class ProductClassifierKieHttpError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ProductClassifierKieHttpError";
  }
}

export class ProductClassifierParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ProductClassifierParseError";
  }
}

function chatCompletionsPathForModel(apiModelIdRaw: string): string {
  const id = assertKieModelIdSet(apiModelIdRaw);
  const seg = id.startsWith("/") ? id.slice(1) : id;
  return `/${seg}/v1/chat/completions`;
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

function sanitizeClassifierRequestForLog(body: unknown): unknown {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return redactKieLogPayload(body);
  }
  const o = body as Record<string, unknown>;
  const messages = o.messages;
  if (!Array.isArray(messages)) return redactKieLogPayload(body);
  const nextMessages = messages.map((msg) => {
    if (!msg || typeof msg !== "object" || Array.isArray(msg)) return msg;
    const content = (msg as Record<string, unknown>).content;
    if (!Array.isArray(content)) return msg;
    const nextContent = content.map((part) => {
      if (!part || typeof part !== "object" || Array.isArray(part)) return part;
      const p = part as Record<string, unknown>;
      if (p.type !== "image_url" || !p.image_url || typeof p.image_url !== "object") {
        return part;
      }
      const iu = p.image_url as Record<string, unknown>;
      const url = typeof iu.url === "string" ? iu.url : "";
      let hint = "[image:redacted]";
      try {
        if (url.startsWith("data:")) hint = "[image:inline-base64]";
        else {
          const u = new URL(url);
          hint = `[image:${u.origin}${u.pathname}]`;
        }
      } catch {
        /* keep */
      }
      return { ...p, image_url: { ...iu, url: hint } };
    });
    return { ...(msg as Record<string, unknown>), content: nextContent };
  });
  return redactKieLogPayload({ ...o, messages: nextMessages });
}

async function resolveImageUrlForKiePayload(imageUrl: string): Promise<string> {
  const absolute = toAbsoluteIfAppPath(imageUrl.trim());
  if (/^https:\/\//i.test(absolute)) {
    return absolute;
  }
  const vision = await readImageForVision(absolute);
  return `data:${vision.mime};base64,${vision.base64}`;
}

export function buildProductClassifierChatPayload(input: {
  apiModelId: string;
  imageUrl: string;
  stream?: boolean;
}): Record<string, unknown> {
  const modelField = trimKieApiModelId(assertKieModelIdSet(input.apiModelId));
  return {
    model: modelField,
    stream: input.stream ?? false,
    response_format: { type: "json_object" },
    max_tokens: 900,
    messages: [
      {
        role: "system",
        content: PRODUCT_CLASSIFIER_KIE_SYSTEM_PROMPT,
      },
      {
        role: "user",
        content: [
          { type: "text", text: getProductClassifierKieUserText() },
          {
            type: "image_url",
            image_url: { url: input.imageUrl },
          },
        ],
      },
    ],
  };
}

export function parseProductClassifierChatResponse(response: unknown): unknown {
  if (!response || typeof response !== "object" || Array.isArray(response)) {
    return null;
  }
  const choices = (response as { choices?: unknown }).choices;
  if (!Array.isArray(choices) || choices.length === 0) return null;
  const msg = choices[0];
  if (!msg || typeof msg !== "object" || Array.isArray(msg)) return null;
  const content = (msg as { message?: { content?: unknown } }).message?.content;
  if (typeof content !== "string" || !content.trim()) return null;
  try {
    return JSON.parse(extractJsonString(content)) as unknown;
  } catch {
    return null;
  }
}

export function normalizeProductClassifierResult(parsed: unknown): ProductClassifierResult {
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new ProductClassifierParseError(PRODUCT_CLASSIFIER_PARSE_ERROR);
  }
  const o = parsed as Record<string, unknown>;
  const category = normalizeClassifierCategoryId(o.category);
  let confidence = 0.5;
  if (typeof o.confidence === "number" && !Number.isNaN(o.confidence)) {
    confidence = Math.min(1, Math.max(0, o.confidence));
  }

  return sanitizeProductClassifierResult({
    category,
    categoryLabel: typeof o.categoryLabel === "string" ? o.categoryLabel : undefined,
    productTitle: typeof o.productTitle === "string" ? o.productTitle : undefined,
    visibleProduct: typeof o.visibleProduct === "string" ? o.visibleProduct : undefined,
    suggestedBenefits: Array.isArray(o.suggestedBenefits) ? o.suggestedBenefits : [],
    detectedAttributes: Array.isArray(o.detectedAttributes) ? o.detectedAttributes : [],
    confidence,
    warnings: Array.isArray(o.warnings) ? o.warnings : [],
  });
}

function classifyKieErrorType(e: unknown, httpStatus: number): ClassifierKieErrorType {
  if (e instanceof ProductClassifierParseError) return "parse_error";
  if (httpStatus >= 400) return "http_error";
  const msg = e instanceof Error ? e.message.toLowerCase() : "";
  if (msg.includes("timeout") || msg.includes("aborted")) return "timeout";
  return "fetch_failed";
}

async function logClassifierKieDiagnostics(args: {
  endpoint: string;
  body: unknown;
  responsePayload?: unknown;
  httpStatus: number | null;
  errorMessage: string | null;
  elapsedMs: number;
  timeoutMs: number;
  errorType?: ClassifierKieErrorType;
  diagnostics?: ClassifierKieChatInput["diagnostics"];
  apiModelId: string;
}): Promise<void> {
  const diag = args.diagnostics ?? {};
  await createApiLog({
    provider: "KIE_AI",
    endpoint: args.endpoint,
    requestPayload: {
      diagnostics: {
        model: args.apiModelId,
        operationRef: diag.operationRef ?? null,
        projectId: diag.projectId ?? null,
        userId: diag.userId ?? null,
        modelSlug: diag.modelSlug ?? null,
        costCredits: diag.costCredits ?? null,
        elapsedMs: args.elapsedMs,
        timeoutMs: args.timeoutMs,
        errorType: args.errorType ?? null,
      },
      payload: sanitizeClassifierRequestForLog(args.body),
    } as unknown,
    responsePayload: args.responsePayload
      ? (redactKieLogPayload(args.responsePayload) as unknown)
      : undefined,
    statusCode: args.httpStatus,
    errorMessage: args.errorMessage,
  });
}
function mapKieHttpError(body: unknown, status: number): string {
  if (body && typeof body === "object" && !Array.isArray(body)) {
    const o = body as Record<string, unknown>;
    const err = o.error;
    if (err && typeof err === "object" && !Array.isArray(err)) {
      const m = (err as Record<string, unknown>).message;
      if (typeof m === "string" && m.trim()) {
        return PRODUCT_CLASSIFIER_KIE_ERROR;
      }
    }
  }
  void status;
  return PRODUCT_CLASSIFIER_KIE_ERROR;
}

/**
 * Синхронный Kie chat/completions classifier. Не создаёт Generation и не трогает worker.
 * Real HTTP вызов только при PRODUCT_CLASSIFIER_ALLOW_REAL_KIE=true и не MOCK_KIE.
 */
export async function classifyProductWithKieChat(
  input: ClassifierKieChatInput,
): Promise<ProductClassifierResult> {
  if (process.env.PRODUCT_CLASSIFIER_ALLOW_REAL_KIE !== "true") {
    throw new ProductClassifierKieNotEnabledError();
  }

  const apiModelId = input.model.apiModelId?.trim();
  if (!apiModelId) {
    throw new ProductClassifierKieHttpError(PRODUCT_CLASSIFIER_KIE_ERROR);
  }

  let imageForPayload: string;
  try {
    imageForPayload = await resolveImageUrlForKiePayload(input.imageUrl);
  } catch {
    throw new ProductClassifierKieHttpError(PRODUCT_CLASSIFIER_KIE_ERROR);
  }

  const body = buildProductClassifierChatPayload({
    apiModelId,
    imageUrl: imageForPayload,
    stream: false,
  });

  if (isMockKie()) {
    return sanitizeProductClassifierResult({
      category: "universal",
      categoryLabel: "Универсальная категория",
      productTitle: "Товар на фото",
      visibleProduct: "MOCK_KIE: тестовый ответ без запроса к Kie.ai",
      suggestedBenefits: ["удобный формат", "подходит для повседневного использования"],
      confidence: 0.75,
      warnings: ["mock"],
    });
  }

  const requestUrl = resolveKieRequestUrl(
    getKieBaseUrl(),
    input.model.endpoint,
    chatCompletionsPathForModel(apiModelId),
  );
  const endpointForLog = requestUrl.split("?")[0]!.slice(0, 2048);
  const timeoutMs = input.timeoutMs ?? 120_000;
  const startedAt = performance.now();

  let httpStatus = 0;
  try {
    const res = await fetch(requestUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${getKieApiKeySafe()}`,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs),
    });
    httpStatus = res.status;
    const text = await res.text();
    let resBody: unknown;
    try {
      resBody = text ? JSON.parse(text) : null;
    } catch {
      resBody = { raw: text.slice(0, 2000) };
    }

    const elapsedMs = Math.round(performance.now() - startedAt);
    const modelIdForLog = trimKieApiModelId(assertKieModelIdSet(apiModelId));

    if (!res.ok) {
      await logClassifierKieDiagnostics({
        endpoint: endpointForLog,
        body,
        responsePayload: resBody,
        httpStatus,
        errorMessage: mapKieHttpError(resBody, httpStatus),
        elapsedMs,
        timeoutMs,
        errorType: "http_error",
        diagnostics: input.diagnostics,
        apiModelId: modelIdForLog,
      });
      throw new ProductClassifierKieHttpError(mapKieHttpError(resBody, httpStatus));
    }

    const parsed = parseProductClassifierChatResponse(resBody);
    if (!parsed) {
      await logClassifierKieDiagnostics({
        endpoint: endpointForLog,
        body,
        responsePayload: resBody,
        httpStatus,
        errorMessage: PRODUCT_CLASSIFIER_PARSE_ERROR,
        elapsedMs,
        timeoutMs,
        errorType: "parse_error",
        diagnostics: input.diagnostics,
        apiModelId: modelIdForLog,
      });
      throw new ProductClassifierParseError(PRODUCT_CLASSIFIER_PARSE_ERROR);
    }

    await logClassifierKieDiagnostics({
      endpoint: endpointForLog,
      body,
      responsePayload: resBody,
      httpStatus,
      errorMessage: null,
      elapsedMs,
      timeoutMs,
      diagnostics: input.diagnostics,
      apiModelId: modelIdForLog,
    });
    return normalizeProductClassifierResult(parsed);
  } catch (e) {
    if (
      e instanceof ProductClassifierKieHttpError ||
      e instanceof ProductClassifierParseError ||
      e instanceof ProductClassifierKieNotEnabledError
    ) {
      throw e;
    }
    const elapsedMs = Math.round(performance.now() - startedAt);
    const errorType = classifyKieErrorType(e, httpStatus);
    const errMsg =
      e instanceof Error ? e.message.slice(0, 10_000) : "network error";
    await logClassifierKieDiagnostics({
      endpoint: endpointForLog,
      body,
      httpStatus: httpStatus || null,
      errorMessage: errMsg,
      elapsedMs,
      timeoutMs,
      errorType,
      diagnostics: input.diagnostics,
      apiModelId: trimKieApiModelId(assertKieModelIdSet(apiModelId)),
    });
    throw new ProductClassifierKieHttpError(PRODUCT_CLASSIFIER_KIE_ERROR);
  }
}

function getKieApiKeySafe(): string {
  let key = process.env.KIE_API_KEY?.trim() ?? "";
  if (key.length >= 7 && key.slice(0, 7).toLowerCase() === "bearer ") {
    key = key.slice(7).trim();
  }
  if (!key) {
    throw new ProductClassifierKieHttpError(PRODUCT_CLASSIFIER_KIE_ERROR);
  }
  return key;
}
