
import type { AiModel } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { isMockKie } from "@/lib/kie-mock";
import { getProductCategoryClassifierPrompt } from "@/config/product-card-prompts";
import {
  type ProductCategoryId,
  PRODUCT_CATEGORY_IDS,
} from "@/config/product-card-categories";
import { toAbsoluteIfAppPath } from "@/lib/app-base-url";
import { createApiLog } from "@/server/services/api-log";
import { resolveDefaultProductClassifierModel } from "@/server/services/productCardModelResolver";
import {
  assertKieModelIdSet,
  getKieBaseUrl,
  redactKieLogPayload,
  resolveKieRequestUrl,
  trimKieApiModelId,
} from "@/server/services/provider/kie";

const MAX_CLASSIFIER_IMAGE_BYTES = 4 * 1024 * 1024;

export type ClassifyProductResult = {
  category: ProductCategoryId;
  confidence: number;
  reason: string;
  provider: string;
  model: string;
  /** true в†’ soft/fallback: UI РїРѕР·РІРѕР»СЏРµС‚ СЂСѓС‡РЅРѕР№ РІС‹Р±РѕСЂ */
  classifierFailed?: boolean;
};

const PARSE_FAIL_REASON = "Could not parse classifier response.";

/** Р’Р°Р»РёРґРЅС‹Р№ ID РёР· СЃРїРёСЃРєР° РёР»Рё `other`. */
export function parseStrictProductCategoryId(raw: unknown): ProductCategoryId {
  if (typeof raw !== "string") return "other";
  const t = raw.trim();
  if ((PRODUCT_CATEGORY_IDS as readonly string[]).includes(t)) {
    return t as ProductCategoryId;
  }
  return "other";
}

function pickOpenAiModel(envModel: string): string {
  const t = (envModel || "").trim().toLowerCase();
  if (t === "mock" || t === "" || t.includes("gemini")) return "gpt-4o-mini";
  if (t === "gpt-4o-mini" || t.startsWith("gpt-4")) return envModel.trim() || "gpt-4o-mini";
  return "gpt-4o-mini";
}

function pickGeminiModel(envModel: string): string {
  const t = (envModel || "").trim().toLowerCase();
  if (t === "mock" || t === "" || t.startsWith("gpt")) return "gemini-2.0-flash";
  if (t.includes("gemini")) return envModel.trim() || "gemini-2.0-flash";
  return "gemini-2.0-flash";
}

function parseFailure(
  provider: string,
  model: string,
  classifierFailed = true,
): ClassifyProductResult {
  return {
    category: "other",
    confidence: 0.3,
    reason: PARSE_FAIL_REASON,
    provider,
    model,
    classifierFailed,
  };
}

/**
 * JSON РёР· РѕС‚РІРµС‚Р° (СЃС‹СЂРѕР№ С‚РµРєСЃС‚ РёР»Рё РІ ```json).
 */
function extractJsonString(raw: string): string {
  const t = raw.trim();
  const fence = /^```(?:json)?\s*([\s\S]*?)```/m.exec(t);
  if (fence) return fence[1]!.trim();
  const a = t.indexOf("{");
  const b = t.lastIndexOf("}");
  if (a >= 0 && b > a) return t.slice(a, b + 1);
  return t;
}

type Validated = { category: ProductCategoryId; confidence: number; reason: string };

/** null в†’ РЅРµРІР°Р»РёРґРЅС‹Р№ РєРѕСЂРµРЅСЊ (РЅРµ object), С‚РѕС‚ Р¶Рµ СЃС†РµРЅР°СЂРёР№, С‡С‚Рѕ Рё JSON parse fail. */
function validateClassifierJson(parsed: unknown): Validated | null {
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return null;
  }
  const o = parsed as Record<string, unknown>;
  const category = parseStrictProductCategoryId(o.category);
  let confidence = 0.5;
  if (typeof o.confidence === "number" && !Number.isNaN(o.confidence)) {
    confidence = Math.min(1, Math.max(0, o.confidence));
  }
  let reason = "";
  if (typeof o.reason === "string") {
    reason = o.reason.slice(0, 300);
  }
  return { category, confidence, reason };
}

async function readImageForVision(imageUrl: string): Promise<{
  mime: string;
  base64: string;
}> {
  const t = imageUrl.trim();
  if (t.startsWith("data:")) {
    const m = /^data:([^;]+);base64,([\s\S]+)$/i.exec(t);
    if (!m) throw new Error("invalid data url");
    const buf = Buffer.from(m[2]!.replace(/\s/g, ""), "base64");
    if (buf.length > MAX_CLASSIFIER_IMAGE_BYTES) throw new Error("image too large");
    const mime = m[1]!.split(";")[0]!.trim() || "image/jpeg";
    return { mime, base64: buf.toString("base64") };
  }
  const absolute = toAbsoluteIfAppPath(t);
  const res = await fetch(absolute, { signal: AbortSignal.timeout(30_000) });
  if (!res.ok) throw new Error("image fetch failed");
  const ab = await res.arrayBuffer();
  const buf = Buffer.from(ab);
  if (buf.length > MAX_CLASSIFIER_IMAGE_BYTES) throw new Error("image too large");
  const mime = res.headers.get("content-type")?.split(";")[0]?.trim() || "image/jpeg";
  return { mime, base64: buf.toString("base64") };
}

function jsonParseToClassifier(
  text: string,
  provider: string,
  model: string,
): ClassifyProductResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(extractJsonString(text));
  } catch {
    return parseFailure(provider, model);
  }
  const v = validateClassifierJson(parsed);
  if (v === null) {
    return parseFailure(provider, model);
  }
  return { ...v, provider, model };
}

async function classifyOpenAi(
  imageUrl: string,
  apiKey: string,
  modelId: string,
): Promise<ClassifyProductResult> {
  let image: { mime: string; base64: string };
  try {
    image = await readImageForVision(imageUrl);
  } catch {
    return {
      category: "other",
      confidence: 0.3,
      reason: "Could not read product image for classification.",
      provider: "openai",
      model: modelId,
      classifierFailed: true,
    };
  }
  const dataUrl = `data:${image.mime};base64,${image.base64}`;
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: modelId,
      response_format: { type: "json_object" },
      max_tokens: 500,
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: getProductCategoryClassifierPrompt() },
            { type: "image_url", image_url: { url: dataUrl, detail: "low" } },
          ],
        },
      ],
    }),
    signal: AbortSignal.timeout(60_000),
  });
  if (!res.ok) {
    return {
      category: "other",
      confidence: 0.3,
      reason: "Classifier request failed.",
      provider: "openai",
      model: modelId,
      classifierFailed: true,
    };
  }
  const body = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const text = body.choices?.[0]?.message?.content ?? "";
  if (!text.trim()) {
    return parseFailure("openai", modelId, true);
  }
  return jsonParseToClassifier(text, "openai", modelId);
}

async function classifyGemini(
  imageUrl: string,
  apiKey: string,
  modelId: string,
): Promise<ClassifyProductResult> {
  let image: { mime: string; base64: string };
  try {
    image = await readImageForVision(imageUrl);
  } catch {
    return {
      category: "other",
      confidence: 0.3,
      reason: "Could not read product image for classification.",
      provider: "gemini",
      model: modelId,
      classifierFailed: true,
    };
  }
  const pathModel = modelId.startsWith("models/") ? modelId : `models/${modelId}`;
  const u = new URL(
    `https://generativelanguage.googleapis.com/v1beta/${pathModel}:generateContent`,
  );
  u.searchParams.set("key", apiKey);
  const res = await fetch(u.toString(), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [
        {
          parts: [
            { text: getProductCategoryClassifierPrompt() },
            {
              inline_data: { mime_type: image.mime, data: image.base64 },
            },
          ],
        },
      ],
      generationConfig: {
        responseMimeType: "application/json",
        temperature: 0.2,
        maxOutputTokens: 500,
      },
    }),
    signal: AbortSignal.timeout(60_000),
  });
  if (!res.ok) {
    return {
      category: "other",
      confidence: 0.3,
      reason: "Classifier request failed.",
      provider: "gemini",
      model: modelId,
      classifierFailed: true,
    };
  }
  const body = (await res.json()) as {
    candidates?: { content?: { parts?: { text?: string }[] } }[];
  };
  const text = body.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
  if (!text.trim()) {
    return parseFailure("gemini", modelId, true);
  }
  return jsonParseToClassifier(text, "gemini", modelId);
}

function normalizeLegacyProvider(raw: string | undefined | null): string {
  return (raw ?? "").trim().toLowerCase();
}

/** РџСѓСЃС‚РѕРµ Р·РЅР°С‡РµРЅРёРµ РёР»Рё СЏРІРЅС‹Рµ Р°Р»РёР°СЃС‹ в†’ РІС‹Р·РѕРІ Kie OpenAI-compatible chat. */
function shouldUseKieClassifier(legacyProvider: string): boolean {
  return (
    legacyProvider === "" ||
    legacyProvider === "kie" ||
    legacyProvider === "kie_ai" ||
    legacyProvider === "kie.ai" ||
    legacyProvider === "kie_gemini"
  );
}

function mockExplicit(): ClassifyProductResult {
  return {
    category: "other",
    confidence: 0.5,
    reason:
      "Р’РєР»СЋС‡С‘РЅ С‚РµСЃС‚РѕРІС‹Р№ РєР»Р°СЃСЃРёС„РёРєР°С‚РѕСЂ (PRODUCT_CLASSIFIER_PROVIDER=mock). Р’С‹Р±РµСЂРёС‚Рµ РєР°С‚РµРіРѕСЂРёСЋ РІСЂСѓС‡РЅСѓСЋ РїСЂРё РЅРµРѕР±С…РѕРґРёРјРѕСЃС‚Рё.",
    provider: "mock",
    model: "mock",
  };
}

function mockClassifierModelMissing(): ClassifyProductResult {
  return {
    category: "other",
    confidence: 0,
    reason:
      "РњРѕРґРµР»СЊ РєР»Р°СЃСЃРёС„РёРєР°С‚РѕСЂР° РєР°СЂС‚РѕС‡РєРё С‚РѕРІР°СЂР° РЅРµ РЅР°СЃС‚СЂРѕРµРЅР°. РћР±СЂР°С‚РёС‚РµСЃСЊ Рє Р°РґРјРёРЅРёСЃС‚СЂР°С‚РѕСЂСѓ.",
    provider: "mock",
    model: "mock",
    classifierFailed: true,
  };
}

function mockMissingKieKey(): ClassifyProductResult {
  return {
    category: "other",
    confidence: 0,
    reason:
      "РќРµ Р·Р°РґР°РЅ KIE_API_KEY вЂ” РєР»Р°СЃСЃРёС„РёРєР°С†РёСЏ С‡РµСЂРµР· Kie.ai РЅРµРґРѕСЃС‚СѓРїРЅР°. РЈРєР°Р¶РёС‚Рµ РєР»СЋС‡ РІ РѕРєСЂСѓР¶РµРЅРёРё РёР»Рё РІРєР»СЋС‡РёС‚Рµ С‚РµСЃС‚РѕРІС‹Р№ СЂРµР¶РёРј (PRODUCT_CLASSIFIER_PROVIDER=mock).",
    provider: "mock",
    model: "mock",
    classifierFailed: true,
  };
}

async function readLegacyClassifierEnv(): Promise<{ provider: string; model: string }> {
  const [rowP, rowM] = await Promise.all([
    prisma.appSetting.findUnique({
      where: { key: "PRODUCT_CLASSIFIER_PROVIDER" },
      select: { value: true },
    }),
    prisma.appSetting.findUnique({
      where: { key: "PRODUCT_CLASSIFIER_MODEL" },
      select: { value: true },
    }),
  ]);
  /** Env РёРјРµРµС‚ РїСЂРёРѕСЂРёС‚РµС‚ РЅР°Рґ AppSetting: РІ Р°РґРјРёРЅРєРµ РјРѕРі РѕСЃС‚Р°С‚СЊСЃСЏ mock, РІ .env вЂ” kie_gemini. */
  const envP = (process.env.PRODUCT_CLASSIFIER_PROVIDER ?? "").trim();
  const envM = (process.env.PRODUCT_CLASSIFIER_MODEL ?? "").trim();
  const dbP =
    rowP?.value != null && (typeof rowP.value === "string" || typeof rowP.value === "number")
      ? String(rowP.value).trim()
      : "";
  const dbM =
    rowM?.value != null && (typeof rowM.value === "string" || typeof rowM.value === "number")
      ? String(rowM.value).trim()
      : "";
  const pRaw = envP.length > 0 ? envP : dbP;
  const mRaw = envM.length > 0 ? envM : dbM;
  return { provider: normalizeLegacyProvider(pRaw), model: mRaw.trim() };
}

function chatCompletionsPathForKieModel(apiModelIdRaw: string): string {
  const id = assertKieModelIdSet(apiModelIdRaw);
  const seg = id.startsWith("/") ? id.slice(1) : id;
  return `/${seg}/v1/chat/completions`;
}

function sanitizeClassifierRequestForLog(body: unknown): unknown {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return redactKieLogPayload(body);
  }
  const o = body as Record<string, unknown>;
  const messages = o.messages;
  if (!Array.isArray(messages)) {
    return redactKieLogPayload(body);
  }
  const msg0 = messages[0];
  if (!msg0 || typeof msg0 !== "object" || Array.isArray(msg0)) {
    return redactKieLogPayload(body);
  }
  const content = (msg0 as Record<string, unknown>).content;
  if (!Array.isArray(content)) {
    return redactKieLogPayload(body);
  }
  const nextContent = content.map((part) => {
    if (!part || typeof part !== "object" || Array.isArray(part)) return part;
    const p = part as Record<string, unknown>;
    if (p.type !== "image_url" || !p.image_url || typeof p.image_url !== "object") return part;
    const iu = p.image_url as Record<string, unknown>;
    const url = typeof iu.url === "string" ? iu.url : "";
    let hint = "[image:redacted]";
    try {
      if (url.startsWith("data:")) {
        hint = "[image:inline-base64]";
      } else {
        const u = new URL(url);
        hint = `[image:${u.origin}${u.pathname}]`;
      }
    } catch {
      /* keep */
    }
    return { ...p, image_url: { ...iu, url: hint } };
  });
  const slim = {
    ...o,
    messages: [{ ...(msg0 as Record<string, unknown>), content: nextContent }],
  };
  return redactKieLogPayload(slim);
}

function kieClassifierHttpError(body: unknown, status: number): string {
  if (body && typeof body === "object" && !Array.isArray(body)) {
    const o = body as Record<string, unknown>;
    const err = o.error;
    if (err && typeof err === "object" && !Array.isArray(err)) {
      const m = (err as Record<string, unknown>).message;
      if (typeof m === "string" && m.trim()) {
        return `РћС€РёР±РєР° Kie.ai (${status}): ${m.trim().slice(0, 400)}`;
      }
    }
    const msg = o.message ?? o.msg;
    if (typeof msg === "string" && msg.trim()) {
      return `РћС€РёР±РєР° Kie.ai (${status}): ${msg.trim().slice(0, 400)}`;
    }
  }
  return `Р—Р°РїСЂРѕСЃ Рє РєР»Р°СЃСЃРёС„РёРєР°С‚РѕСЂСѓ Kie.ai Р·Р°РІРµСЂС€РёР»СЃСЏ СЃ РєРѕРґРѕРј ${status}. Р’С‹Р±РµСЂРёС‚Рµ РєР°С‚РµРіРѕСЂРёСЋ РІСЂСѓС‡РЅСѓСЋ.`;
}

async function classifyProductImageKie(
  imageUrl: string,
  aiModel: AiModel,
  legacyEnvModel: string,
): Promise<ClassifyProductResult> {
  const slug = aiModel.slug;
  const legacyTrim =
    legacyEnvModel && legacyEnvModel.toLowerCase() !== "mock" ? legacyEnvModel.trim() : "";
  const apiModelId = legacyTrim || aiModel.apiModelId;
  const modelField = trimKieApiModelId(apiModelId);
  const displayModel = modelField || slug;

  if (isMockKie()) {
    const v = validateClassifierJson({
      category: "other",
      confidence: 0.85,
      reason: "MOCK_KIE: РѕС‚РІРµС‚ СЌРјСѓР»РёСЂРѕРІР°РЅ Р±РµР· Р·Р°РїСЂРѕСЃР° Рє Kie.ai.",
    });
    if (!v) return parseFailure("kie_ai", displayModel, true);
    return { ...v, provider: "kie_ai", model: displayModel };
  }

  const rawKey = process.env.KIE_API_KEY?.trim() ?? "";
  if (!rawKey) {
    return mockMissingKieKey();
  }

  /** Kie.ai РєР°С‡Р°РµС‚ `image_url` СЃРЅР°СЂСѓР¶Рё вЂ” localhost/РїСЂРёРІР°С‚РЅС‹Рµ URL РґР°СЋС‚ 403. Р’С€РёРІР°РµРј base64, РєР°Рє Сѓ OpenAI. */
  let vision: { mime: string; base64: string };
  try {
    vision = await readImageForVision(imageUrl);
  } catch {
    return {
      category: "other",
      confidence: 0,
      reason:
        "РќРµ СѓРґР°Р»РѕСЃСЊ РїСЂРѕС‡РёС‚Р°С‚СЊ С„РѕС‚Рѕ РґР»СЏ РєР»Р°СЃСЃРёС„РёРєР°С†РёРё (РїСЂРѕРІРµСЂСЊС‚Рµ, С‡С‚Рѕ С„Р°Р№Р» РґРѕСЃС‚СѓРїРµРЅ СЃ СЃРµСЂРІРµСЂР° РїСЂРёР»РѕР¶РµРЅРёСЏ).",
      provider: "kie_ai",
      model: displayModel,
      classifierFailed: true,
    };
  }
  const dataUrl = `data:${vision.mime};base64,${vision.base64}`;

  const path = chatCompletionsPathForKieModel(apiModelId);
  const requestUrl = resolveKieRequestUrl(getKieBaseUrl(), aiModel.endpoint, path);

  let authKey = rawKey;
  if (authKey.length >= 7 && authKey.slice(0, 7).toLowerCase() === "bearer ") {
    authKey = authKey.slice(7).trim();
  }

  const body: Record<string, unknown> = {
    model: modelField,
    response_format: { type: "json_object" },
    max_tokens: 500,
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: getProductCategoryClassifierPrompt() },
          {
            type: "image_url",
            image_url: { url: dataUrl, detail: "low" },
          },
        ],
      },
    ],
  };

  const endpointForLog = requestUrl.split("?")[0]!.slice(0, 2048);
  let httpStatus = 0;

  try {
    const res = await fetch(requestUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${authKey}`,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(60_000),
    });
    httpStatus = res.status;
    const text = await res.text();
    let resBody: unknown;
    try {
      resBody = text ? JSON.parse(text) : null;
    } catch {
      resBody = { raw: text.slice(0, 2000) };
    }

    const errMsg = res.ok ? null : kieClassifierHttpError(resBody, httpStatus);

    await createApiLog({
      provider: "KIE_AI",
      endpoint: endpointForLog,
      requestPayload: sanitizeClassifierRequestForLog(body) as unknown,
      responsePayload: redactKieLogPayload(resBody) as unknown,
      statusCode: httpStatus,
      errorMessage: errMsg,
    });

    if (!res.ok) {
      return {
        category: "other",
        confidence: 0,
        reason: errMsg ?? kieClassifierHttpError(resBody, httpStatus),
        provider: "kie_ai",
        model: displayModel,
        classifierFailed: true,
      };
    }

    const content =
      (resBody as { choices?: { message?: { content?: string } }[] })?.choices?.[0]?.message
        ?.content ?? "";
    if (!content.trim()) {
      return {
        category: "other",
        confidence: 0,
        reason: "РџСѓСЃС‚РѕР№ РѕС‚РІРµС‚ РєР»Р°СЃСЃРёС„РёРєР°С‚РѕСЂР° Kie.ai.",
        provider: "kie_ai",
        model: displayModel,
        classifierFailed: true,
      };
    }
    const out = jsonParseToClassifier(content, "kie_ai", displayModel);
    if (out.classifierFailed) {
      return {
        ...out,
        reason: out.reason || PARSE_FAIL_REASON,
      };
    }
    return out;
  } catch (e) {
    const msg =
      e instanceof Error ? e.message : "РЎРµС‚РµРІР°СЏ РѕС€РёР±РєР° РїСЂРё РѕР±СЂР°С‰РµРЅРёРё Рє Kie.ai.";
    await createApiLog({
      provider: "KIE_AI",
      endpoint: endpointForLog,
      requestPayload: sanitizeClassifierRequestForLog(body) as unknown,
      responsePayload: undefined,
      statusCode: httpStatus || null,
      errorMessage: msg.slice(0, 10_000),
    });
    return {
      category: "other",
      confidence: 0,
      reason:
        "РќРµ СѓРґР°Р»РѕСЃСЊ СЃРІСЏР·Р°С‚СЊСЃСЏ СЃ РєР»Р°СЃСЃРёС„РёРєР°С‚РѕСЂРѕРј Kie.ai. РџРѕРІС‚РѕСЂРёС‚Рµ РїРѕРїС‹С‚РєСѓ РёР»Рё РІС‹Р±РµСЂРёС‚Рµ РєР°С‚РµРіРѕСЂРёСЋ РІСЂСѓС‡РЅСѓСЋ.",
      provider: "kie_ai",
      model: displayModel,
      classifierFailed: true,
    };
  }
}

/**
 * РљР»Р°СЃСЃРёС„РёРєР°С†РёСЏ РїРѕ URL РёР·РѕР±СЂР°Р¶РµРЅРёСЏ (С‚РѕР»СЊРєРѕ Р±СЌРєРµРЅРґ; РєР»СЋС‡Рё Рё base64 РІ Р»РѕРіРё РЅРµ РїРёС€РµРј).
 */
export async function classifyProductImage(
  imageUrl: string,
): Promise<ClassifyProductResult> {
  const url = imageUrl?.trim() ?? "";
  if (!url) {
    return {
      category: "other",
      confidence: 0,
      reason: "Empty image URL.",
      provider: "none",
      model: "none",
      classifierFailed: true,
    };
  }

  const legacy = await readLegacyClassifierEnv();

  if (legacy.provider === "mock") {
    return mockExplicit();
  }

  const aiModel = await resolveDefaultProductClassifierModel();
  if (!aiModel) {
    return mockClassifierModelMissing();
  }

  if (legacy.provider === "openai") {
    const key = process.env.OPENAI_API_KEY?.trim();
    const modelId = pickOpenAiModel(legacy.model);
    if (!key) {
      return {
        category: "other",
        confidence: 0.3,
        reason: "OpenAI is selected but OPENAI_API_KEY is not set.",
        provider: "openai",
        model: modelId,
        classifierFailed: true,
      };
    }
    return classifyOpenAi(url, key, modelId);
  }

  if (legacy.provider === "gemini") {
    const key = process.env.GEMINI_API_KEY?.trim();
    const modelId = pickGeminiModel(legacy.model);
    if (!key) {
      return {
        category: "other",
        confidence: 0.3,
        reason: "Gemini is selected but GEMINI_API_KEY is not set.",
        provider: "gemini",
        model: modelId,
        classifierFailed: true,
      };
    }
    return classifyGemini(url, key, modelId);
  }

  if (shouldUseKieClassifier(legacy.provider)) {
    if (aiModel.provider !== "KIE_AI") {
      return {
        category: "other",
        confidence: 0,
        reason:
          "РђРєС‚РёРІРЅР°СЏ РјРѕРґРµР»СЊ РєР»Р°СЃСЃРёС„РёРєР°С‚РѕСЂР° РІ РєР°С‚Р°Р»РѕРіРµ РЅРµ РѕС‚РЅРѕСЃРёС‚СЃСЏ Рє Kie.ai вЂ” РїСЂРѕРІРµСЂСЊС‚Рµ РЅР°СЃС‚СЂРѕР№РєРё.",
        provider: "unknown",
        model: aiModel.slug,
        classifierFailed: true,
      };
    }
    return classifyProductImageKie(url, aiModel, legacy.model);
  }

  return {
    category: "other",
    confidence: 0,
    reason: `Unknown classifier provider "${legacy.provider}".`,
    provider: legacy.provider || "unknown",
    model: "unknown",
    classifierFailed: true,
  };
}
