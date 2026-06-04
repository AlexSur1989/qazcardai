
/** Таймаут HTTP к Kie.ai (генерация и polling). Переопределение: KIE_FETCH_TIMEOUT_MS. */
import { normalizeGptImage2AspectIfOmittedForKie } from "@/server/kie/general-phase1-models";
import {
  buildKieMarketPayloadFromMapping,
  defaultKieCallBackUrl,
  isStrictKiePayloadMapping,
} from "@/server/services/kiePayloadMapping";
import {
  parseGeminiOmniVideoList,
  isGeminiOmniVideoModelId,
} from "@/server/services/gemini-omni-settings";
import { firstFrameUrlString } from "@/server/services/seedance-settings";
import { publicHttpUrlsOnly } from "@/lib/generation-input-limits";

const DEFAULT_KIE_FETCH_TIMEOUT_MS = 120_000;

function kieFetchTimeoutMs(): number {
  const raw = process.env.KIE_FETCH_TIMEOUT_MS?.trim();
  if (!raw) return DEFAULT_KIE_FETCH_TIMEOUT_MS;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n >= 5_000 ? n : DEFAULT_KIE_FETCH_TIMEOUT_MS;
}

async function fetchKie(url: string, init: RequestInit): Promise<Response> {
  const ms = kieFetchTimeoutMs();
  const ctrl = new AbortController();
  const id = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, { ...init, signal: ctrl.signal });
  } finally {
    clearTimeout(id);
  }
}

const DEFAULT_IMAGE_GENERATE_PATH = "/api/v1/gpt4o-image/generate";
const DEFAULT_IMAGE_RECORD_INFO_PATH = "/api/v1/gpt4o-image/record-info";
const DEFAULT_VIDEO_GENERATE_PATH =
  process.env.KIE_VIDEO_GENERATE_PATH?.trim() || "/api/v1/video/generate";
const DEFAULT_VIDEO_RECORD_INFO_PATH =
  process.env.KIE_VIDEO_RECORD_INFO_PATH?.trim() || "/api/v1/video/record-info";

const DEFAULT_KIE_BASE_URL = "https://api.kie.ai";

export function getKieBaseUrl(): string {
  const raw = process.env.KIE_BASE_URL?.trim();
  return (raw && raw.length > 0 ? raw : DEFAULT_KIE_BASE_URL).replace(/\/$/, "");
}

export function getKieApiKey(): string {
  let key = process.env.KIE_API_KEY?.trim() ?? "";
  if (key.length >= 7 && key.slice(0, 7).toLowerCase() === "bearer ") {
    key = key.slice(7).trim();
  }
  if (!key) {
    throw new Error("KIE_API_KEY is not set");
  }
  return key;
}

export function getDefaultRecordInfoPath(
  type: "IMAGE" | "VIDEO",
): string {
  return type === "VIDEO" ? DEFAULT_VIDEO_RECORD_INFO_PATH : DEFAULT_IMAGE_RECORD_INFO_PATH;
}

export function resolveKieRequestUrl(
  baseUrl: string,
  endpoint: string | null | undefined,
  defaultPath: string,
): string {
  const ep = endpoint != null ? String(endpoint).trim() : "";
  if (ep && /^https?:\/\//i.test(ep)) {
    return ep;
  }
  const base = baseUrl.replace(/\/$/, "");
  if (ep.length > 0) {
    return ep.startsWith("/") ? `${base}${ep}` : `${base}/${ep}`;
  }
  const path = defaultPath.startsWith("/") ? defaultPath : `/${defaultPath}`;
  return `${base}${path}`;
}

export type KieImageGenerateInput = {
  /** ID модели в API провайдера (из AiModel.apiModelId) */
  apiModelId: string;
  /** Переопределение URL из карточки модели (относительный путь к KIE_BASE_URL или absolute URL) */
  endpoint: string | null;
  /** Kie Market createTask: готовое тело JSON (model, callBackUrl, input). */
  marketCreateBody?: JsonRecord;
  prompt: string;
  negativePrompt?: string | null;
  aspectRatio?: string | null;
  resolution?: string | null;
  seed?: number | null;
  /** Публичные URL изображений (референс / edit). */
  inputFileUrls?: string[];
};

export type NormalizedKieImageResult = {
  success: boolean;
  httpStatus: number;
  taskId?: string;
  imageUrls?: string[];
  videoUrls?: string[];
  /** Gemini Omni Audio sync: kieAudioId для audio_ids в video. */
  omniAudioId?: string;
  /** Gemini Omni Character sync: characterId для character_ids в video. */
  omniCharacterId?: string;
  omniCharacterImageUrl?: string;
  rawResponse: unknown;
  errorMessage?: string;
};

/** @deprecated use NormalizedKieImageResult — то же, для видео добавлено videoUrls */
export type NormalizedKieTaskResult = NormalizedKieImageResult;

type JsonRecord = Record<string, unknown>;

function isRecord(x: unknown): x is JsonRecord {
  return typeof x === "object" && x !== null && !Array.isArray(x);
}

/** Trims `AiModel.apiModelId` / `endpoint`; не использовать name/slug. */
export function trimKieApiModelId(raw: string | null | undefined): string {
  if (raw == null) return "";
  return String(raw).trim();
}

/**
 * @throws — если в админке пустой apiModelId (после trim).
 * Реальное поле `model` в JSON к Kie — только отсюда.
 */
export function assertKieModelIdSet(raw: string | null | undefined): string {
  const id = trimKieApiModelId(raw);
  if (!id) {
    throw new Error("AiModel.apiModelId is required for Kie.ai request");
  }
  return id;
}

export function trimKieModelEndpoint(
  value: string | null | undefined,
): string | null {
  if (value == null) return null;
  const t = String(value).trim();
  return t.length > 0 ? t : null;
}

function isDevKieLogEnabled(): boolean {
  return process.env.NODE_ENV === "development";
}

/** POST jobs/createTask; склейка: KIE_BASE_URL + path (см. getKieJobsCreateTaskUrl). */
const KIE_JOBS_CREATE_TASK_PATH = "/api/v1/jobs/createTask";

/**
 * KIE_BASE_URL + endpoint, без сюрпризов (двойные слэши убирает base/endpoint).
 * Не логируйте KIE_API_KEY / Authorization.
 */
export function getKieJobsCreateTaskUrl(endpoint: string | null | undefined): string {
  const base = getKieBaseUrl();
  const ep = trimKieModelEndpoint(endpoint) ?? KIE_JOBS_CREATE_TASK_PATH;
  return `${base.replace(/\/$/, "")}${ep.startsWith("/") ? ep : `/${ep}`}`;
}

function kieRequestLog(
  requestUrl: string,
  log: {
    model?: unknown;
    input?: unknown;
    method?: string;
    taskId?: string;
  },
): void {
  if (!isDevKieLogEnabled()) {
    return;
  }
  console.log("[KIE request]", {
    url: requestUrl,
    method: log.method,
    taskId: log.taskId,
    model: log.model,
    input: log.input,
  });
}

/**
 * Парсит ответ Kie.ai: формат может отличаться по эндпоинту — расширяйте селекторы при подключении новых API.
 */
export function normalizeResponse(
  response: unknown,
  httpStatus: number,
): NormalizedKieImageResult {
  const base: NormalizedKieImageResult = {
    success: false,
    httpStatus,
    rawResponse: response,
  };
  if (httpStatus < 200 || httpStatus >= 300) {
    return {
      ...base,
      errorMessage: "HTTP-ошибка от провайдера",
    };
  }
  if (!isRecord(response)) {
    return {
      ...base,
      errorMessage: "Неожиданный формат ответа (не объект)",
    };
  }
  if ("code" in response && response.code !== undefined) {
    const c = response.code;
    if (c !== 200 && c !== 0) {
      const msg =
        typeof response.msg === "string"
          ? response.msg
          : typeof (response as { message?: unknown }).message === "string"
            ? String((response as { message: string }).message)
            : "Ошибка в теле ответа провайдера";
      return { ...base, errorMessage: msg };
    }
  }
  const data = response.data;
  let taskId: string | undefined;
  let imageUrls: string[] | undefined;
  let videoUrls: string[] | undefined;
  let omniAudioId: string | undefined;
  let omniCharacterId: string | undefined;
  let omniCharacterImageUrl: string | undefined;

  if (isRecord(data)) {
    if (typeof data.taskId === "string" && data.taskId) taskId = data.taskId;
    if (typeof data.task_id === "string" && data.task_id) taskId = data.task_id;
    if (typeof data.kieAudioId === "string" && data.kieAudioId.trim()) {
      omniAudioId = data.kieAudioId.trim();
    }
    if (typeof data.characterId === "string" && data.characterId.trim()) {
      omniCharacterId = data.characterId.trim();
    }
    if (typeof data.imageUrl === "string" && data.imageUrl.trim()) {
      omniCharacterImageUrl = data.imageUrl.trim();
    }
    if (Array.isArray(data.imageUrls) && data.imageUrls.every((u) => typeof u === "string")) {
      imageUrls = data.imageUrls;
    } else if (Array.isArray(data.images) && data.images.every((u) => typeof u === "string")) {
      imageUrls = data.images;
    } else if (Array.isArray(data.urls) && data.urls.every((u) => typeof u === "string")) {
      imageUrls = data.urls;
    } else if (typeof data.imageUrl === "string" && data.imageUrl) {
      imageUrls = [data.imageUrl];
    }
    if (Array.isArray(data.videoUrls) && data.videoUrls.every((u) => typeof u === "string")) {
      videoUrls = data.videoUrls;
    } else if (Array.isArray(data.videos) && data.videos.every((u) => typeof u === "string")) {
      videoUrls = data.videos;
    } else if (typeof data.videoUrl === "string" && data.videoUrl) {
      videoUrls = [data.videoUrl];
    } else if (typeof data.outputUrl === "string" && data.outputUrl) {
      if (/\.(mp4|webm|mov)(\?|$)/i.test(data.outputUrl)) {
        videoUrls = [data.outputUrl];
      } else if (!imageUrls) {
        imageUrls = [data.outputUrl];
      }
    } else if (typeof data.resultUrl === "string" && data.resultUrl) {
      videoUrls = [data.resultUrl];
    } else if (
      Array.isArray(data.resultUrls) &&
      data.resultUrls.length > 0 &&
      data.resultUrls.every((u) => typeof u === "string")
    ) {
      const imgs: string[] = [];
      const vids: string[] = [];
      for (const u of data.resultUrls) {
        if (/\.(mp4|webm|mov)(\?|$)/i.test(u)) vids.push(u);
        else imgs.push(u);
      }
      if (imgs.length > 0) imageUrls = imgs;
      if (vids.length > 0) videoUrls = vids;
    } else if (typeof data.resultUrls === "string" && data.resultUrls.trim()) {
      try {
        const p = JSON.parse(data.resultUrls) as unknown;
        if (Array.isArray(p) && p.every((u) => typeof u === "string")) {
          const imgs: string[] = [];
          const vids: string[] = [];
          for (const u of p) {
            if (/\.(mp4|webm|mov)(\?|$)/i.test(u)) vids.push(u);
            else imgs.push(u);
          }
          if (imgs.length > 0) imageUrls = imgs;
          if (vids.length > 0) videoUrls = vids;
        }
      } catch {
        // ignore
      }
    }
  }
  if (!taskId && typeof response.taskId === "string") taskId = response.taskId;
  if (!imageUrls && Array.isArray(response.imageUrls) && response.imageUrls.every((u) => typeof u === "string")) {
    imageUrls = response.imageUrls as string[];
  }
  if (!videoUrls && Array.isArray(response.videoUrls) && response.videoUrls.every((u) => typeof u === "string")) {
    videoUrls = response.videoUrls as string[];
  }

  const hasMedia = Boolean(
    (imageUrls && imageUrls.length > 0) || (videoUrls && videoUrls.length > 0),
  );
  const hasOmniIds = Boolean(omniAudioId || omniCharacterId);
  const success = Boolean(
    (taskId && taskId.length > 0) || hasMedia || hasOmniIds,
  );
  if (!success) {
    return {
      ...base,
      errorMessage: "Провайдер не вернул taskId и URL результата",
    };
  }
  return {
    success: true,
    httpStatus,
    rawResponse: response,
    taskId,
    imageUrls,
    videoUrls,
    omniAudioId,
    omniCharacterId,
    omniCharacterImageUrl,
  };
}

export function buildKieRequestBodyForLog(input: KieImageGenerateInput): JsonRecord {
  if (input.marketCreateBody) {
    return input.marketCreateBody;
  }
  return buildRequestBody(input);
}

export function getKieGenerateRequestUrl(input: KieImageGenerateInput): string {
  if (input.marketCreateBody) {
    return getKieJobsCreateTaskUrl(input.endpoint);
  }
  return resolveKieRequestUrl(
    getKieBaseUrl(),
    input.endpoint,
    DEFAULT_IMAGE_GENERATE_PATH,
  );
}

function buildRequestBody(input: KieImageGenerateInput): JsonRecord {
  const size = input.aspectRatio?.trim() || "1:1";
  const body: JsonRecord = {
    prompt: input.prompt,
    size,
    nVariants: 1,
  };
  if (process.env.KIE_SEND_MODEL_IN_BODY === "1" && input.apiModelId) {
    body.model = assertKieModelIdSet(input.apiModelId);
  }
  if (input.negativePrompt?.trim()) {
    body.negativePrompt = input.negativePrompt.trim();
  }
  if (input.resolution?.trim()) {
    body.resolution = input.resolution.trim();
  }
  if (input.seed !== undefined && input.seed !== null) {
    body.seed = input.seed;
  }
  if (input.inputFileUrls && input.inputFileUrls.length > 0) {
    body.filesUrl = input.inputFileUrls;
  }
  return body;
}

/**
 * Сознательно не пишет Authorization и ключи; для логов ApiLog.
 */
export function redactKieLogPayload(payload: unknown): unknown {
  if (payload === null || payload === undefined) return payload;
  if (Array.isArray(payload)) {
    return payload.map((x) => redactKieLogPayload(x));
  }
  if (typeof payload === "object") {
    const o = payload as JsonRecord;
    const out: JsonRecord = {};
    for (const [k, v] of Object.entries(o)) {
      const key = k.toLowerCase();
      if (
        key === "authorization" ||
        key === "apikey" ||
        key === "api_key" ||
        key === "bearer" ||
        key === "access_token" ||
        key === "x-api-key"
      ) {
        out[k] = "[redacted]";
        continue;
      }
      out[k] = redactKieLogPayload(v) as unknown;
    }
    return out;
  }
  if (typeof payload === "string" && payload.length > 4000) {
    return `${payload.slice(0, 4000)}…(truncated)`;
  }
  return payload;
}

export async function generateImage(
  input: KieImageGenerateInput,
): Promise<NormalizedKieImageResult> {
  const key = getKieApiKey();
  const isMarket = Boolean(input.marketCreateBody);
  const url = isMarket
    ? getKieJobsCreateTaskUrl(input.endpoint)
    : resolveKieRequestUrl(
        getKieBaseUrl(),
        input.endpoint,
        DEFAULT_IMAGE_GENERATE_PATH,
      );
  const bodyRaw = (input.marketCreateBody ?? buildRequestBody(input)) as JsonRecord;
  const body = stripUndefinedDeep(bodyRaw) as JsonRecord;
  const br = body as JsonRecord;
  kieRequestLog(url, {
    model: br.model,
    input: br.input != null ? br.input : body,
  });
  let httpStatus = 0;
  let text = "";
  let res: Response;
  try {
    res = await fetchKie(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify(body),
    });
    httpStatus = res.status;
    text = await res.text();
  } catch (e) {
    const aborted = e instanceof Error && e.name === "AbortError";
    return {
      success: false,
      httpStatus: 0,
      rawResponse: { networkError: true, aborted },
      errorMessage: aborted
        ? "Превышено время ожидания ответа провайдера"
        : e instanceof Error
          ? e.message
          : "Сеть / fetch",
    };
  }
  let json: unknown;
  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    if (isDevKieLogEnabled()) {
      console.log("[KIE response]", {
        status: res.status,
        ok: res.ok,
        data: { parseError: true, textSnippet: text.slice(0, 500) },
      });
    }
    return {
      success: false,
      httpStatus,
      rawResponse: { parseError: true, textSnippet: text.slice(0, 500) },
      errorMessage: "Ответ провайдера не JSON",
    };
  }
  if (isDevKieLogEnabled()) {
    console.log("[KIE response]", { status: res.status, ok: res.ok, data: json });
  }
  return normalizeResponse(json, httpStatus);
}

// --- Видео: тот же нормализатор (taskId / videoUrls) ---

export type KieVideoGenerateInput = {
  apiModelId: string;
  endpoint: string | null;
  /** Kie Market createTask: готовое тело JSON (model, callBackUrl, input). */
  marketCreateBody?: JsonRecord;
  /** Veo get-1080p-video: GET с query taskId (без JSON-тела). */
  veoGet1080pTaskId?: string;
  /** Gemini Omni audio/character: плоское тело POST на omni/* (без createTask). */
  omniSyncBody?: JsonRecord;
  prompt?: string;
  negativePrompt?: string | null;
  aspectRatio?: string | null;
  resolution?: string | null;
  seed?: number | null;
  durationSec?: number | null;
  inputFileUrls?: string[];
};

function getAppUrlForKieCallback(): string {
  const app =
    process.env.APP_URL?.trim() || process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (!app) {
    throw new Error("APP_URL is not set");
  }
  return app.replace(/\/$/, "");
}

function veo31StringUrlList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((x): x is string => typeof x === "string" && x.trim() !== "")
    .map((s) => s.trim());
}

function buildVeo31GenerateFlat(
  settings: Record<string, unknown>,
  prompt: string,
): JsonRecord {
  const base = getAppUrlForKieCallback();
  const body: JsonRecord = {
    prompt: prompt.trim(),
    callBackUrl: `${base}/api/webhooks/kie`,
  };
  const m = String(settings.veoModel ?? "veo3_fast").trim();
  body.model =
    m === "veo3" || m === "veo3_fast" || m === "veo3_lite" ? m : "veo3_fast";
  const ar = String(settings.aspect_ratio ?? "16:9").trim();
  body.aspect_ratio = ["16:9", "9:16", "Auto"].includes(ar) ? ar : "16:9";
  const resRaw = String(settings.resolution ?? "720p").trim().toLowerCase();
  body.resolution =
    resRaw === "4k" ? "4k" : resRaw === "1080p" ? "1080p" : "720p";
  const gt = String(settings.generationType ?? "").trim();
  if (
    gt === "TEXT_2_VIDEO" ||
    gt === "FIRST_AND_LAST_FRAMES_2_VIDEO" ||
    gt === "REFERENCE_2_VIDEO"
  ) {
    body.generationType = gt;
  }
  const imgs = veo31StringUrlList(settings.imageUrls);
  if (imgs.length > 0) body.imageUrls = imgs.slice(0, 3);
  if (typeof settings.seeds === "number" && Number.isFinite(settings.seeds)) {
    const s = Math.floor(settings.seeds);
    if (s >= 10000 && s <= 99999) body.seeds = s;
  }
  if (settings.enableTranslation === false) body.enableTranslation = false;
  if (
    typeof settings.watermark === "string" &&
    settings.watermark.trim() !== ""
  ) {
    body.watermark = settings.watermark.trim();
  }
  return stripUndefinedDeep(body) as JsonRecord;
}

function buildVeo31ExtendFlat(
  settings: Record<string, unknown>,
  prompt: string,
): JsonRecord {
  const base = getAppUrlForKieCallback();
  const body: JsonRecord = {
    taskId: String(settings.sourceTaskId ?? "").trim(),
    prompt: prompt.trim(),
    callBackUrl: `${base}/api/webhooks/kie`,
  };
  const md = String(settings.extendModel ?? "fast").trim().toLowerCase();
  if (md === "fast" || md === "quality" || md === "lite") {
    body.model = md;
  }
  if (typeof settings.seeds === "number" && Number.isFinite(settings.seeds)) {
    const s = Math.floor(settings.seeds);
    if (s >= 10000 && s <= 99999) body.seeds = s;
  }
  if (
    typeof settings.watermark === "string" &&
    settings.watermark.trim() !== ""
  ) {
    body.watermark = settings.watermark.trim();
  }
  return stripUndefinedDeep(body) as JsonRecord;
}

function buildVeo31Get4kFlat(settings: Record<string, unknown>): JsonRecord {
  const base = getAppUrlForKieCallback();
  const body: JsonRecord = {
    taskId: String(settings.sourceTaskId ?? "").trim(),
    callBackUrl: `${base}/api/webhooks/kie`,
  };
  const idx = Number(settings.videoIndex);
  if (Number.isFinite(idx) && idx >= 0) body.index = Math.floor(idx);
  return stripUndefinedDeep(body) as JsonRecord;
}

/** Плоское тело POST для `/api/v1/veo/*` (не jobs/createTask). */
export function buildVeo31VideoMarketBody(
  modelId: string,
  prompt: string,
  settings: Record<string, unknown>,
): JsonRecord | null {
  const id = modelId.trim();
  if (id === "veo-3-1") return buildVeo31GenerateFlat(settings, prompt);
  if (id === "veo/extend") return buildVeo31ExtendFlat(settings, prompt);
  if (id === "veo/get-4k-video") return buildVeo31Get4kFlat(settings);
  return null;
}

function setDeep(target: JsonRecord, path: string[], value: unknown): void {
  if (path.length === 0 || value === undefined) return;
  if (path.length === 1) {
    target[path[0]] = value;
    return;
  }
  const [head, ...rest] = path;
  let next = target[head];
  if (!isRecord(next)) {
    next = {};
    target[head] = next;
  }
  setDeep(next as JsonRecord, rest, value);
}

function stripUndefinedDeep(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(stripUndefinedDeep);
  }
  if (!isRecord(value)) {
    return value;
  }
  const o: JsonRecord = {};
  for (const [k, v] of Object.entries(value)) {
    if (v === undefined) continue;
    const inner = stripUndefinedDeep(v);
    if (inner === undefined) continue;
    o[k] = inner as unknown;
  }
  return o;
}

/**
 * Kling 3.0: только std | pro | 4K.
 * Не допускаем: standard, Standard, 4k, PRO, и т.п.
 */
function normalizeKieKlingMode(raw: unknown): "std" | "pro" | "4K" {
  if (raw == null) {
    return "std";
  }
  const s0 = String(raw).trim();
  if (!s0) {
    return "std";
  }
  const t = s0.toLowerCase();
  if (t === "4k") {
    return "4K";
  }
  if (t === "standard" || t === "std") {
    return "std";
  }
  if (t === "pro") {
    return "pro";
  }
  return "std";
}

function isWanMarketFamilyModelId(modelId: string): boolean {
  const t = modelId.toLowerCase();
  return t.startsWith("wan/2-6-");
}

const BYTEDANCE_SEEDANCE_2_API_ID = "bytedance/seedance-2";
const BYTEDANCE_SEEDANCE_2_FAST_API_ID = "bytedance/seedance-2-fast";
const BYTEDANCE_SEEDANCE_1_5_PRO_API_ID = "bytedance/seedance-1.5-pro";
const KLING_30_MOTION_CONTROL_API_ID = "kling-3.0/motion-control";

function isBytedanceSeedance2FamilyModelId(modelId: string): boolean {
  const t = modelId.toLowerCase();
  return (
    t === BYTEDANCE_SEEDANCE_2_API_ID ||
    t === BYTEDANCE_SEEDANCE_2_FAST_API_ID ||
    t === BYTEDANCE_SEEDANCE_1_5_PRO_API_ID
  );
}

function stripKieWan27InputFields(input: JsonRecord): JsonRecord {
  const o: JsonRecord = {};
  for (const [k, v] of Object.entries(input)) {
    if (v === undefined || v === null) continue;
    if (typeof v === "string" && v.trim() === "") continue;
    o[k] = v;
  }
  return o;
}

/**
 * Wan 2.7 (Kie Market): text / image / R2V / video edit — поля см. доки kie.ai.
 */
function nsfwCheckerFrom(settings: Record<string, unknown>): boolean | undefined {
  const v = settings.nsfwChecker;
  return typeof v === "boolean" ? v : undefined;
}

function wan27Resolution(raw: unknown, fallback = "1080p"): string {
  const s =
    typeof raw === "string" && raw.trim() !== ""
      ? raw.trim().toLowerCase()
      : fallback;
  return s === "720p" ? "720p" : "1080p";
}

function appendWanSeed(input: JsonRecord, settings: Record<string, unknown>) {
  if (settings.seed == null || String(settings.seed).trim() === "") return;
  const s = Number(settings.seed);
  if (Number.isFinite(s)) input.seed = Math.floor(s);
}

function buildWan27TextToVideoPayload(
  prompt: string,
  modelId: string,
  settings: Record<string, unknown>,
): JsonRecord {
  const base = getAppUrlForKieCallback();
  const neg =
    typeof settings.negativePrompt === "string" ? settings.negativePrompt.trim() : "";
  const audio =
    typeof settings.audioUrl === "string" ? settings.audioUrl.trim() : "";
  const resolution = wan27Resolution(settings.resolution);
  const ratio =
    typeof settings.ratio === "string" && settings.ratio.trim() !== ""
      ? settings.ratio.trim()
      : "16:9";

  const durationNum = Number(settings.duration);
  let duration = Number.isFinite(durationNum) ? Math.floor(durationNum) : 5;
  if (duration < 2) duration = 2;
  if (duration > 15) duration = 15;

  const promptExtend = settings.promptExtend !== false;
  const watermark = settings.watermark === true;

  const input: JsonRecord = {
    prompt: prompt.trim(),
    resolution,
    ratio,
    duration,
    prompt_extend: promptExtend,
    watermark,
  };
  if (neg) input.negative_prompt = neg;
  if (audio) input.audio_url = audio;
  appendWanSeed(input, settings);
  const chk = nsfwCheckerFrom(settings);
  if (chk !== undefined) input.nsfw_checker = chk;

  const cleaned = stripKieWan27InputFields(input);
  return stripUndefinedDeep({
    model: modelId,
    callBackUrl: `${base}/api/webhooks/kie`,
    input: cleaned,
  }) as JsonRecord;
}

function buildWan27ImageToVideoPayload(
  prompt: string,
  modelId: string,
  settings: Record<string, unknown>,
): JsonRecord {
  const base = getAppUrlForKieCallback();
  const input: JsonRecord = { prompt: prompt.trim() };
  const neg =
    typeof settings.negativePrompt === "string"
      ? settings.negativePrompt.trim()
      : "";
  if (neg) input.negative_prompt = neg;

  const ff =
    typeof settings.firstFrameUrl === "string"
      ? settings.firstFrameUrl.trim()
      : "";
  const lf =
    typeof settings.lastFrameUrl === "string"
      ? settings.lastFrameUrl.trim()
      : "";
  const clip =
    typeof settings.firstClipUrl === "string"
      ? settings.firstClipUrl.trim()
      : "";
  if (ff) input.first_frame_url = ff;
  if (lf) input.last_frame_url = lf;
  if (clip) input.first_clip_url = clip;

  const driving =
    typeof settings.drivingAudioUrl === "string" &&
    settings.drivingAudioUrl.trim() !== ""
      ? settings.drivingAudioUrl.trim()
      : typeof settings.audioUrl === "string"
        ? settings.audioUrl.trim()
        : "";
  if (driving) input.driving_audio_url = driving;

  input.resolution = wan27Resolution(settings.resolution);

  const dDuration = Number(settings.duration);
  let duration = Number.isFinite(dDuration) ? Math.floor(dDuration) : 5;
  if (duration < 2) duration = 2;
  if (duration > 15) duration = 15;
  input.duration = duration;
  input.prompt_extend = settings.promptExtend !== false;
  input.watermark = settings.watermark === true;
  appendWanSeed(input, settings);
  const chk = nsfwCheckerFrom(settings);
  if (chk !== undefined) input.nsfw_checker = chk;

  const cleaned = stripKieWan27InputFields(input);
  return stripUndefinedDeep({
    model: modelId,
    callBackUrl: `${base}/api/webhooks/kie`,
    input: cleaned,
  }) as JsonRecord;
}

function wan27Aspect(settings: Record<string, unknown>): string {
  const a =
    typeof settings.aspectRatio === "string" && settings.aspectRatio.trim() !== ""
      ? settings.aspectRatio.trim()
      : "16:9";
  const allowed = new Set(["16:9", "9:16", "1:1", "4:3", "3:4"]);
  return allowed.has(a) ? a : "16:9";
}

function buildWan27R2VPayload(
  prompt: string,
  modelId: string,
  settings: Record<string, unknown>,
): JsonRecord {
  const base = getAppUrlForKieCallback();
  const input: JsonRecord = { prompt: prompt.trim() };
  const neg =
    typeof settings.negativePrompt === "string"
      ? settings.negativePrompt.trim()
      : "";
  if (neg) input.negative_prompt = neg;

  const refImgs = Array.isArray(settings.referenceImageUrls)
    ? settings.referenceImageUrls
        .filter((x): x is string => typeof x === "string" && x.trim() !== "")
        .map((s) => s.trim())
        .slice(0, 5)
    : [];
  const refVids = Array.isArray(settings.referenceVideoUrls)
    ? settings.referenceVideoUrls
        .filter((x): x is string => typeof x === "string" && x.trim() !== "")
        .map((s) => s.trim())
        .slice(0, 5)
    : [];
  if (refImgs.length > 0) input.reference_image = refImgs;
  if (refVids.length > 0) input.reference_video = refVids;

  const fc =
    typeof settings.firstFrame === "string" && settings.firstFrame.trim() !== ""
      ? settings.firstFrame.trim()
      : typeof settings.firstFrameUrl === "string" &&
          settings.firstFrameUrl.trim() !== ""
        ? settings.firstFrameUrl.trim()
        : "";
  if (fc) input.first_frame = fc;

  const voice =
    typeof settings.referenceVoiceUrl === "string"
      ? settings.referenceVoiceUrl.trim()
      : "";
  if (voice) input.reference_voice = voice;

  input.resolution = wan27Resolution(settings.resolution);
  input.aspect_ratio = wan27Aspect(settings);

  const dR2vDuration = Number(settings.duration);
  let duration = Number.isFinite(dR2vDuration)
    ? Math.floor(dR2vDuration)
    : 5;
  if (duration < 2) duration = 2;
  if (duration > 10) duration = 10;
  input.duration = duration;
  input.prompt_extend = settings.promptExtend !== false;
  input.watermark = settings.watermark === true;
  appendWanSeed(input, settings);
  const chk = nsfwCheckerFrom(settings);
  if (chk !== undefined) input.nsfw_checker = chk;

  const cleaned = stripKieWan27InputFields(input);
  return stripUndefinedDeep({
    model: modelId,
    callBackUrl: `${base}/api/webhooks/kie`,
    input: cleaned,
  }) as JsonRecord;
}

function buildWan27VideoEditPayload(
  prompt: string,
  modelId: string,
  settings: Record<string, unknown>,
): JsonRecord {
  const base = getAppUrlForKieCallback();
  const videoUrl =
    typeof settings.videoUrl === "string" ? settings.videoUrl.trim() : "";

  const input: JsonRecord = {
    video_url: videoUrl,
  };
  const p = prompt.trim();
  if (p) input.prompt = p;
  const neg =
    typeof settings.negativePrompt === "string"
      ? settings.negativePrompt.trim()
      : "";
  if (neg) input.negative_prompt = neg;

  const refSingle =
    typeof settings.referenceImageUrl === "string" &&
    settings.referenceImageUrl.trim() !== ""
      ? settings.referenceImageUrl.trim()
      : "";
  if (refSingle) input.reference_image = refSingle;

  input.resolution = wan27Resolution(settings.resolution);

  const arRaw =
    typeof settings.aspectRatio === "string" ? settings.aspectRatio.trim() : "";
  if (
    ["16:9", "9:16", "1:1", "4:3", "3:4"].includes(arRaw)
  ) {
    input.aspect_ratio = arRaw;
  }

  const dEditDuration = Number(settings.duration);
  if (Number.isFinite(dEditDuration)) {
    let dur = Math.floor(dEditDuration);
    if (dur !== 0) {
      if (dur < 2) dur = 2;
      if (dur > 10) dur = 10;
    }
    input.duration = dur;
  } else {
    input.duration = 0;
  }

  const au =
    typeof settings.audioSetting === "string"
      ? settings.audioSetting.trim().toLowerCase()
      : "";
  input.audio_setting = au === "origin" ? "origin" : "auto";

  input.prompt_extend = settings.promptExtend !== false;
  input.watermark = settings.watermark === true;
  appendWanSeed(input, settings);
  const chk = nsfwCheckerFrom(settings);
  if (chk !== undefined) input.nsfw_checker = chk;

  const cleaned = stripKieWan27InputFields(input);
  return stripUndefinedDeep({
    model: modelId,
    callBackUrl: `${base}/api/webhooks/kie`,
    input: cleaned,
  }) as JsonRecord;
}

function buildWan27MarketCreateTaskPayload(
  prompt: string,
  modelId: string,
  settings: Record<string, unknown>,
): JsonRecord {
  const id = modelId.toLowerCase();
  /** Wan 2.6 — те же поля input, что у соответствующих режимов 2.7 (доки Kie). */
  if (id === "wan/2-6-text-to-video") {
    return buildWan27TextToVideoPayload(prompt, modelId, settings);
  }
  if (id === "wan/2-6-image-to-video") {
    return buildWan27ImageToVideoPayload(prompt, modelId, settings);
  }
  if (id === "wan/2-6-video-to-video") {
    return buildWan27VideoEditPayload(prompt, modelId, settings);
  }
  if (id === "wan/2-7-text-to-video") {
    return buildWan27TextToVideoPayload(prompt, modelId, settings);
  }
  if (id === "wan/2-7-image-to-video") {
    return buildWan27ImageToVideoPayload(prompt, modelId, settings);
  }
  if (id === "wan/2-7-r2v") {
    return buildWan27R2VPayload(prompt, modelId, settings);
  }
  if (id === "wan/2-7-videoedit") {
    return buildWan27VideoEditPayload(prompt, modelId, settings);
  }
  throw new Error(`Unsupported Kie Wan model id: ${modelId}`);
}

function seedanceStringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((x): x is string => typeof x === "string" && x.trim() !== "")
    .map((s) => s.trim());
}

function stripKieSeedanceInput(input: JsonRecord): JsonRecord {
  const o: JsonRecord = {};
  for (const [k, v] of Object.entries(input)) {
    if (v === undefined || v === null) continue;
    if (typeof v === "string" && v.trim() === "") continue;
    if (Array.isArray(v)) {
      const arr = v.filter(
        (x) =>
          x !== null &&
          x !== undefined &&
          (typeof x !== "string" || x.trim() !== ""),
      ) as string[];
      if (arr.length === 0) continue;
      o[k] = arr;
      continue;
    }
    o[k] = v;
  }
  return o;
}

/**
 * Bytedance Seedance 2.0 / 2.0 Fast / 1.5 Pro: поля `input` по Kie Market (createTask).
 * @see https://docs.kie.ai/market/bytedance/seedance-2
 */
function buildSeedance2MarketCreateTaskPayload(
  prompt: string,
  modelId: string,
  settings: Record<string, unknown>,
): JsonRecord {
  const base = getAppUrlForKieCallback();
  const first = firstFrameUrlString(settings.firstFrameUrl);
  const last =
    typeof settings.lastFrameUrl === "string"
      ? settings.lastFrameUrl.trim()
      : firstFrameUrlString(settings.lastFrameUrl);
  /** Референсы: изображения до 9; в консоли Kie ref video часто 1 файл; audio до 3. */
  const refImg = seedanceStringList(settings.referenceImageUrls).slice(0, 9);
  const refVid = seedanceStringList(settings.referenceVideoUrls).slice(0, 3);
  const refAud = seedanceStringList(settings.referenceAudioUrls).slice(0, 3);
  const res =
    typeof settings.resolution === "string" && settings.resolution.trim() !== ""
      ? settings.resolution.trim()
      : "720p";
  const ar =
    typeof settings.aspectRatio === "string" && settings.aspectRatio.trim() !== ""
      ? settings.aspectRatio.trim()
      : "16:9";
  const durN = Number(settings.duration);
  const rawDuration = Number.isFinite(durN) && durN > 0 ? Math.floor(durN) : 5;
  const duration = Math.min(15, Math.max(4, rawDuration));

  const input: JsonRecord = {
    prompt: prompt.trim(),
    return_last_frame: settings.returnLastFrame === true,
    generate_audio: settings.generateAudio === true,
    resolution: res,
    aspect_ratio: ar,
    duration,
    web_search: settings.webSearch === true,
    nsfw_checker: settings.nsfwChecker === true,
  };
  if (first) {
    input.first_frame_url = first;
  }
  if (last) {
    input.last_frame_url = last;
  }
  if (refImg.length > 0) {
    input.reference_image_urls = refImg;
  }
  if (refVid.length > 0) {
    input.reference_video_urls = refVid;
  }
  if (refAud.length > 0) {
    input.reference_audio_urls = refAud;
  }

  const cleaned = stripKieSeedanceInput(input);
  return stripUndefinedDeep({
    model: modelId,
    callBackUrl: `${base}/api/webhooks/kie`,
    input: cleaned,
  }) as JsonRecord;
}

/**
 * Kling 3.0 Motion Control: без полей обычного Kling (sound, image_urls, …).
 */
function buildKlingMotionControlMarketCreateTaskPayload(
  prompt: string,
  modelId: string,
  settings: Record<string, unknown>,
): JsonRecord {
  const base = getAppUrlForKieCallback();
  const iu = Array.isArray(settings.inputUrls)
    ? settings.inputUrls
        .filter((x): x is string => typeof x === "string" && x.trim() !== "")
        .map((s) => s.trim())
        .slice(0, 1)
    : [];
  const vu = Array.isArray(settings.videoUrls)
    ? settings.videoUrls
        .filter((x): x is string => typeof x === "string" && x.trim() !== "")
        .map((s) => s.trim())
        .slice(0, 1)
    : [];
  const input: JsonRecord = {
    prompt: prompt.trim(),
    input_urls: iu,
    video_urls: vu,
    mode: String(settings.mode ?? "720p").trim() || "720p",
    character_orientation: String(
      settings.characterOrientation ?? "image",
    ).trim() || "image",
    background_source: String(
      settings.backgroundSource ?? "input_video",
    ).trim() || "input_video",
  };
  const cleaned = stripKieSeedanceInput(input);
  return stripUndefinedDeep({
    model: modelId,
    callBackUrl: `${base}/api/webhooks/kie`,
    input: cleaned,
  }) as JsonRecord;
}

/**
 * Kling 3.0: POST /api/v1/jobs/createTask.
 * `model` — строго из `aiModel.apiModelId` (уже assert + trim), без name/slug/id/settings.model.
 * Тело как в док. Kie: только `model` + `input` (webhook — отдельно, если появится в API).
 */
function buildKling30MarketCreateTaskPayload(
  prompt: string,
  modelId: string,
  settings: Record<string, unknown>,
): JsonRecord {
  const base = getAppUrlForKieCallback();
  const imageUrls = Array.isArray(settings.imageUrls)
    ? settings.imageUrls.filter(
        (x): x is string => typeof x === "string" && x.trim().length > 0,
      )
    : [];
  const ar =
    settings.aspectRatio != null && String(settings.aspectRatio).trim() !== ""
      ? String(settings.aspectRatio).trim()
      : "16:9";
  const input: JsonRecord = {
    prompt: prompt.trim(),
    sound: Boolean(settings.sound),
    duration: String(settings.duration ?? "5"),
    aspect_ratio: ar,
    mode: normalizeKieKlingMode(settings.mode),
    multi_shots: Boolean(settings.multiShots),
  };
  if (imageUrls.length > 0) {
    input.image_urls = imageUrls;
  }
  return stripUndefinedDeep({
    model: modelId,
    callBackUrl: `${base}/api/webhooks/kie`,
    input: stripUndefinedDeep(input) as JsonRecord,
  }) as JsonRecord;
}

function isGrokImagineFamilyModelId(modelId: string): boolean {
  return modelId.toLowerCase().startsWith("grok-imagine/");
}

function grokImagineStringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((x): x is string => typeof x === "string" && x.trim() !== "")
    .map((s) => s.trim());
}

/**
 * Grok Imagine (Kie Market createTask). Поля input — по аналогии с другими market-моделями;
 * сверьте с актуальной докой Kie при отличиях.
 */
function buildGrokImagineMarketCreateTaskPayload(
  prompt: string,
  modelId: string,
  settings: Record<string, unknown>,
): JsonRecord {
  const base = getAppUrlForKieCallback();
  const id = modelId.toLowerCase();
  const p = prompt.trim();

  if (id === "grok-imagine/text-to-image") {
    const ar =
      typeof settings.aspectRatio === "string" && settings.aspectRatio.trim() !== ""
        ? settings.aspectRatio.trim()
        : "1:1";
    const res =
      typeof settings.resolution === "string" && settings.resolution.trim() !== ""
        ? settings.resolution.trim()
        : "1K";
    const input = stripUndefinedDeep({
      prompt: p,
      aspect_ratio: ar,
      resolution: res,
    }) as JsonRecord;
    return stripUndefinedDeep({
      model: modelId,
      callBackUrl: `${base}/api/webhooks/kie`,
      input,
    }) as JsonRecord;
  }

  if (id === "grok-imagine/image-to-image") {
    const imgs = grokImagineStringList(settings.imageUrls).slice(0, 8);
    const ar =
      typeof settings.aspectRatio === "string" && settings.aspectRatio.trim() !== ""
        ? settings.aspectRatio.trim()
        : "1:1";
    const res =
      typeof settings.resolution === "string" && settings.resolution.trim() !== ""
        ? settings.resolution.trim()
        : "1K";
    const input: JsonRecord = {
      prompt: p,
      aspect_ratio: ar,
      resolution: res,
    };
    if (imgs.length > 0) input.image_urls = imgs;
    return stripUndefinedDeep({
      model: modelId,
      callBackUrl: `${base}/api/webhooks/kie`,
      input: stripUndefinedDeep(input) as JsonRecord,
    }) as JsonRecord;
  }

  if (id === "grok-imagine/text-to-video") {
    const d = Number(settings.duration);
    const duration = Number.isFinite(d) ? Math.max(1, Math.min(15, Math.floor(d))) : 5;
    const ar =
      typeof settings.aspectRatio === "string" && settings.aspectRatio.trim() !== ""
        ? settings.aspectRatio.trim()
        : "16:9";
    const resRaw =
      typeof settings.resolution === "string" && settings.resolution.trim() !== ""
        ? settings.resolution.trim().toLowerCase()
        : "720p";
    const resolution = resRaw === "1080p" ? "1080p" : "720p";
    const input = stripUndefinedDeep({
      prompt: p,
      duration,
      aspect_ratio: ar,
      resolution,
    }) as JsonRecord;
    return stripUndefinedDeep({
      model: modelId,
      callBackUrl: `${base}/api/webhooks/kie`,
      input,
    }) as JsonRecord;
  }

  if (id === "grok-imagine/image-to-video") {
    const imgs = grokImagineStringList(settings.imageUrls).slice(0, 4);
    const d = Number(settings.duration);
    const duration = Number.isFinite(d) ? Math.max(1, Math.min(15, Math.floor(d))) : 5;
    const ar =
      typeof settings.aspectRatio === "string" && settings.aspectRatio.trim() !== ""
        ? settings.aspectRatio.trim()
        : "16:9";
    const resRaw =
      typeof settings.resolution === "string" && settings.resolution.trim() !== ""
        ? settings.resolution.trim().toLowerCase()
        : "720p";
    const resolution = resRaw === "1080p" ? "1080p" : "720p";
    const input: JsonRecord = {
      prompt: p,
      duration,
      aspect_ratio: ar,
      resolution,
    };
    if (imgs.length > 0) input.image_urls = imgs;
    return stripUndefinedDeep({
      model: modelId,
      callBackUrl: `${base}/api/webhooks/kie`,
      input: stripUndefinedDeep(input) as JsonRecord,
    }) as JsonRecord;
  }

  throw new Error(`Unsupported Kie Grok Imagine model id: ${modelId}`);
}

function isHailuo23ImageToVideoModelId(modelId: string): boolean {
  const m = modelId.toLowerCase();
  return (
    m === "hailuo/2-3-image-to-video-standard" ||
    m === "hailuo/2-3-image-to-video-pro"
  );
}

function hailuo23StringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((x): x is string => typeof x === "string" && x.trim() !== "")
    .map((s) => s.trim());
}

/**
 * Hailuo 2.3 Standard/Pro Image→Video — см. docs.kie.ai market hailuo/2-3-image-to-video-*.
 */
function buildHailuo23ImageToVideoMarketCreateTaskPayload(
  prompt: string,
  modelId: string,
  settings: Record<string, unknown>,
): JsonRecord {
  const base = getAppUrlForKieCallback();
  const urls = hailuo23StringList(settings.imageUrls);
  const imageUrl = urls[0] ?? "";

  const durRaw = String(settings.duration ?? "6").trim();
  const duration: "6" | "10" = durRaw === "10" ? "10" : "6";

  const resRaw =
    typeof settings.resolution === "string" ? settings.resolution.trim() : "";
  const resUp = resRaw.toUpperCase();
  const resolution: "768P" | "1080P" = resUp === "1080P" ? "1080P" : "768P";

  const input: JsonRecord = {
    prompt: prompt.trim(),
    image_url: imageUrl,
    duration,
    resolution,
  };
  if (settings.nsfwChecker === true) {
    input.nsfw_checker = true;
  }

  return stripUndefinedDeep({
    model: modelId,
    callBackUrl: `${base}/api/webhooks/kie`,
    input: stripUndefinedDeep(input) as JsonRecord,
  }) as JsonRecord;
}

function isSora2ProStoryboardModelId(modelId: string): boolean {
  return modelId.trim() === "sora-2-pro-storyboard";
}

function isSeedreamV4EditModelId(modelId: string): boolean {
  return modelId.trim().toLowerCase() === "bytedance/seedream-v4-edit";
}

/** Kie Seedream 4.0 Edit: input.image_size + input.image_resolution (docs.kie.ai/market/seedream/seedream-v4-edit). */
function seedreamV4EditImageSizeFromSettings(settings: Record<string, unknown>): string {
  const ar = typeof settings.aspectRatio === "string" ? settings.aspectRatio.trim() : "";
  const width = Number(settings.outputWidth);
  const height = Number(settings.outputHeight);
  const ratio =
    Number.isFinite(width) && Number.isFinite(height) && width > 0 && height > 0
      ? width / height
      : ratioFromAspectLabel(ar);

  if (ratio == null) return "square_hd";
  if (Math.abs(ratio - 1) < 0.05 || ar === "1:1") return "square_hd";
  if (ar === "16:9" || ratio >= 1.65) return "landscape_16_9";
  if (ar === "9:16" || ratio <= 0.62) return "portrait_16_9";
  if (ar === "3:4" || (ratio < 1 && Math.abs(ratio - 0.75) < 0.08)) return "portrait_4_3";
  if (ar === "4:3" || (ratio >= 1 && Math.abs(ratio - 4 / 3) < 0.08)) return "landscape_4_3";
  return ratio >= 1 ? "landscape_4_3" : "portrait_4_3";
}

function ratioFromAspectLabel(aspectRatio: string): number | null {
  const [rawW, rawH] = aspectRatio.split(":");
  const w = Number(rawW);
  const h = Number(rawH);
  return Number.isFinite(w) && Number.isFinite(h) && w > 0 && h > 0 ? w / h : null;
}

function seedreamV4EditResolutionFromSettings(settings: Record<string, unknown>): "1K" | "2K" | "4K" {
  const raw = typeof settings.resolution === "string" ? settings.resolution.trim().toUpperCase() : "";
  if (raw === "2K" || raw === "4K") return raw;
  return "1K";
}

function collectSeedreamV4EditImageUrls(
  settings: Record<string, unknown>,
  inputFiles: string[],
): string[] {
  const fromSettings = [
    ...(Array.isArray(settings.imageUrls)
      ? settings.imageUrls.filter((x): x is string => typeof x === "string")
      : []),
    ...(Array.isArray(settings.inputUrls)
      ? settings.inputUrls.filter((x): x is string => typeof x === "string")
      : []),
  ];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const url of [...fromSettings, ...inputFiles]) {
    const t = url.trim();
    if (!t || seen.has(t)) continue;
    seen.add(t);
    out.push(t);
  }
  return out;
}

function buildSeedreamV4EditMarketCreateTaskPayload(
  prompt: string,
  modelId: string,
  settings: Record<string, unknown>,
  inputFiles: string[],
): JsonRecord {
  const base = getAppUrlForKieCallback();
  const image_urls = collectSeedreamV4EditImageUrls(settings, inputFiles);
  const input: JsonRecord = {
    prompt: prompt.trim(),
    image_urls,
    image_size: seedreamV4EditImageSizeFromSettings(settings),
    image_resolution: seedreamV4EditResolutionFromSettings(settings),
    max_images: 1,
  };
  return stripUndefinedDeep({
    model: modelId,
    callBackUrl: `${base}/api/webhooks/kie`,
    input: stripUndefinedDeep(input) as JsonRecord,
  }) as JsonRecord;
}

function parseSoraStoryboardShotsFromSettings(
  shots: unknown,
): { Scene: string; duration: number }[] {
  if (!Array.isArray(shots)) return [];
  const out: { Scene: string; duration: number }[] = [];
  for (const raw of shots) {
    if (typeof raw !== "object" || raw === null || Array.isArray(raw)) continue;
    const o = raw as Record<string, unknown>;
    const scene =
      typeof o.Scene === "string"
        ? o.Scene.trim()
        : typeof o.scene === "string"
          ? o.scene.trim()
          : "";
    const d = Number(o.duration);
    if (!scene || !Number.isFinite(d)) continue;
    let duration = d;
    if (duration < 0.1) duration = 0.1;
    if (duration > 15) duration = 15;
    out.push({ Scene: scene, duration });
  }
  return out.slice(0, 10);
}

/**
 * Sora 2 Pro Storyboard — docs.kie.ai market `sora-2-pro-storyboard`.
 * Поле `Scene` в shots с заглавной буквы (требование API).
 */
function buildSora2ProStoryboardMarketCreateTaskPayload(
  _prompt: string,
  modelId: string,
  settings: Record<string, unknown>,
): JsonRecord {
  const base = getAppUrlForKieCallback();
  const shots = parseSoraStoryboardShotsFromSettings(settings.shots);
  const nf = String(settings.n_frames ?? "15").trim();
  const n_frames = nf === "10" || nf === "15" || nf === "25" ? nf : "15";
  const arRaw = String(settings.aspect_ratio ?? "landscape")
    .trim()
    .toLowerCase();
  const aspect_ratio = arRaw === "portrait" ? "portrait" : "landscape";
  const umRaw = String(settings.upload_method ?? "s3").trim().toLowerCase();
  const upload_method = umRaw === "oss" ? "oss" : "s3";

  const input: JsonRecord = {
    shots,
    n_frames,
    aspect_ratio,
    upload_method,
  };
  const imgs = hailuo23StringList(settings.imageUrls).slice(0, 1);
  if (imgs.length > 0) {
    input.image_urls = imgs;
  }

  return stripUndefinedDeep({
    model: modelId,
    callBackUrl: `${base}/api/webhooks/kie`,
    input: stripUndefinedDeep(input) as JsonRecord,
  }) as JsonRecord;
}

/**
 * Тело POST для Kie Market /api/v1/jobs/createTask (без секретов в логах — отдельно redact).
 */
export function buildGeminiOmniVideoMarketCreateTaskPayload(
  prompt: string,
  model: { apiModelId: string; payloadMapping: unknown },
  settings: Record<string, unknown>,
  inputFiles: string[] = [],
): JsonRecord {
  if (!isStrictKiePayloadMapping(model.payloadMapping)) {
    throw new Error("gemini-omni-video: strict payloadMapping required");
  }
  const base = buildKieMarketPayloadFromMapping(model.payloadMapping, {
    model: { apiModelId: model.apiModelId },
    prompt: prompt.trim(),
    settings,
    inputFiles,
    callBackUrl: defaultKieCallBackUrl(),
  });
  const videoList = parseGeminiOmniVideoList(settings.videoList);
  if (videoList.length > 0) {
    (base.input as JsonRecord).video_list = videoList.map(
      ({ url, start, ends }) => ({ url, start, ends }),
    );
  }
  return base;
}

function geminiOmniStringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((x): x is string => typeof x === "string")
    .map((s) => s.trim())
    .filter(Boolean);
}

export function buildGeminiOmniAudioSyncBody(
  settings: Record<string, unknown>,
): JsonRecord {
  const body: JsonRecord = {
    audio_id: String(settings.audioId ?? "").trim(),
    name: String(settings.name ?? "").trim(),
  };
  const voiceDescription = String(settings.voiceDescription ?? "").trim();
  if (voiceDescription) body.voice_description = voiceDescription;
  const exampleDialogue = String(settings.exampleDialogue ?? "").trim();
  if (exampleDialogue) body.example_dialogue = exampleDialogue;
  return body;
}

export function buildGeminiOmniCharacterSyncBody(
  settings: Record<string, unknown>,
  inputFiles: string[] = [],
): JsonRecord {
  const fromSettings = geminiOmniStringList(settings.imageUrls);
  const imageUrls = publicHttpUrlsOnly(
    fromSettings.length > 0 ? fromSettings : inputFiles,
  );
  const body: JsonRecord = {
    descriptions: String(settings.descriptions ?? "").trim(),
    image_urls: imageUrls.slice(0, 1),
  };
  const audioIds = geminiOmniStringList(settings.audioIds);
  if (audioIds.length > 0) body.audio_ids = audioIds;
  const characterName = String(settings.characterName ?? "").trim();
  if (characterName) body.character_name = characterName;
  return body;
}

export function buildKieMarketCreateTaskPayload(
  prompt: string,
  model: { apiModelId: string; payloadMapping: unknown },
  settings: Record<string, unknown>,
  inputFiles: string[] = [],
): JsonRecord {
  const modelId = assertKieModelIdSet(model.apiModelId);
  if (isGeminiOmniVideoModelId(modelId)) {
    return buildGeminiOmniVideoMarketCreateTaskPayload(
      prompt,
      model,
      settings,
      inputFiles,
    );
  }
  if (isStrictKiePayloadMapping(model.payloadMapping)) {
    const normalized = normalizeGptImage2AspectIfOmittedForKie(
      modelId,
      settings,
    );
    return buildKieMarketPayloadFromMapping(model.payloadMapping, {
      model: { apiModelId: modelId },
      prompt: prompt.trim(),
      settings: normalized,
      inputFiles,
      callBackUrl: defaultKieCallBackUrl(),
    });
  }
  if (isWanMarketFamilyModelId(modelId)) {
    return buildWan27MarketCreateTaskPayload(prompt, modelId, settings);
  }
  if (isBytedanceSeedance2FamilyModelId(modelId)) {
    return buildSeedance2MarketCreateTaskPayload(prompt, modelId, settings);
  }
  if (modelId === KLING_30_MOTION_CONTROL_API_ID) {
    return buildKlingMotionControlMarketCreateTaskPayload(
      prompt,
      modelId,
      settings,
    );
  }
  /** Kie: Kling 3.0 / 3.0 video share a legacy special builder. Kling 2.6 is strict payloadMapping-driven. */
  {
    const m = modelId.toLowerCase();
    if (
      m === "kling-3.0" ||
      m === "kling-3.0/video"
    ) {
      return buildKling30MarketCreateTaskPayload(prompt, modelId, settings);
    }
  }
  if (isGrokImagineFamilyModelId(modelId)) {
    return buildGrokImagineMarketCreateTaskPayload(prompt, modelId, settings);
  }
  if (isHailuo23ImageToVideoModelId(modelId)) {
    return buildHailuo23ImageToVideoMarketCreateTaskPayload(
      prompt,
      modelId,
      settings,
    );
  }
  if (isSora2ProStoryboardModelId(modelId)) {
    return buildSora2ProStoryboardMarketCreateTaskPayload(
      prompt,
      modelId,
      settings,
    );
  }
  if (isSeedreamV4EditModelId(modelId)) {
    return buildSeedreamV4EditMarketCreateTaskPayload(
      prompt,
      modelId,
      settings,
      inputFiles,
    );
  }
  if (!isRecord(model.payloadMapping)) {
    throw new Error("payloadMapping is missing for market createTask");
  }
  const ctx: Record<string, unknown> = {
    prompt,
    mode: settings.mode,
    duration: String(settings.duration ?? "5"),
    sound: settings.sound === true,
    aspectRatio: settings.aspectRatio,
    resolution: settings.resolution,
    size: settings.size,
    style: settings.style,
    preset: settings.preset,
    numberOfImages: settings.numberOfImages,
    imageUrl: settings.imageUrl,
    firstFrameUrl: settings.firstFrameUrl,
    imageUrls: Array.isArray(settings.imageUrls)
      ? settings.imageUrls.filter((x): x is string => typeof x === "string")
      : [],
    inputUrls: Array.isArray(settings.inputUrls)
      ? settings.inputUrls.filter((x): x is string => typeof x === "string")
      : [],
    referenceImageUrls: Array.isArray(settings.referenceImageUrls)
      ? settings.referenceImageUrls.filter((x): x is string => typeof x === "string")
      : [],
    multiShots: settings.multiShots === true,
    seed: settings.seed,
    nsfwChecker: settings.nsfwChecker === true,
  };

  const nested: JsonRecord = {};
  for (const [srcKey, pathStr] of Object.entries(model.payloadMapping)) {
    if (typeof pathStr !== "string") continue;
    let val = ctx[srcKey];
    if (val === undefined) continue;
    if (srcKey === "imageUrls") {
      if (!Array.isArray(val) || val.length === 0) continue;
    }
    if (srcKey === "inputUrls") {
      if (!Array.isArray(val) || val.length === 0) continue;
    }
    if (srcKey === "referenceImageUrls") {
      if (!Array.isArray(val) || val.length === 0) continue;
    }
    if (srcKey === "duration") val = String(val);
    if (srcKey === "sound") val = val === true;
    if (srcKey === "multiShots") val = val === true;
    if (srcKey === "nsfwChecker") val = val === true;
    if (srcKey === "seed") {
      if (val === undefined || val === null || val === "") continue;
      const s = Number(val);
      if (!Number.isFinite(s)) continue;
      val = Math.floor(s);
    }
    if (srcKey === "numberOfImages") {
      const n = Number(val);
      if (!Number.isFinite(n)) continue;
      val = Math.min(6, Math.max(1, Math.floor(n)));
    }
    setDeep(nested, pathStr.split(".").filter(Boolean), val);
  }

  const merged = stripUndefinedDeep(nested) as JsonRecord;
  const inputObj = isRecord(merged.input)
    ? (stripUndefinedDeep(merged.input) as JsonRecord)
    : {};

  const base = getAppUrlForKieCallback();
  return {
    model: modelId,
    callBackUrl: `${base}/api/webhooks/kie`,
    input: inputObj,
  };
}

function buildVideoRequestBody(input: KieVideoGenerateInput): JsonRecord {
  const size = input.aspectRatio?.trim() || "16:9";
  const body: JsonRecord = {
    prompt: input.prompt ?? "",
    size,
  };
  if (process.env.KIE_SEND_MODEL_IN_BODY === "1" && input.apiModelId) {
    body.model = assertKieModelIdSet(input.apiModelId);
  }
  if (input.negativePrompt?.trim()) {
    body.negativePrompt = input.negativePrompt.trim();
  }
  if (input.resolution?.trim()) {
    body.resolution = input.resolution.trim();
  }
  if (input.seed !== undefined && input.seed !== null) {
    body.seed = input.seed;
  }
  if (input.durationSec != null) {
    body.duration = input.durationSec;
  }
  if (input.inputFileUrls && input.inputFileUrls.length > 0) {
    body.filesUrl = input.inputFileUrls;
  }
  return body;
}

export function buildKieVideoRequestBodyForLog(input: KieVideoGenerateInput): JsonRecord {
  if (input.veoGet1080pTaskId?.trim()) {
    return {
      method: "GET",
      taskId: input.veoGet1080pTaskId.trim(),
    } as JsonRecord;
  }
  if (input.omniSyncBody) {
    return input.omniSyncBody;
  }
  if (input.marketCreateBody) {
    return input.marketCreateBody;
  }
  return buildVideoRequestBody(input);
}

export function getKieVideoGenerateRequestUrl(input: KieVideoGenerateInput): string {
  const tid = input.veoGet1080pTaskId?.trim();
  if (tid) {
    const baseUrl = getKieJobsCreateTaskUrl(
      input.endpoint ?? "/api/v1/veo/get-1080p-video",
    );
    const sep = baseUrl.includes("?") ? "&" : "?";
    return `${baseUrl}${sep}taskId=${encodeURIComponent(tid)}`;
  }
  if (input.omniSyncBody) {
    return resolveKieRequestUrl(
      getKieBaseUrl(),
      input.endpoint,
      "/api/v1/omni/audio/create",
    );
  }
  if (input.marketCreateBody) {
    return getKieJobsCreateTaskUrl(input.endpoint);
  }
  return resolveKieRequestUrl(
    getKieBaseUrl(),
    input.endpoint,
    DEFAULT_VIDEO_GENERATE_PATH,
  );
}

export async function generateVideo(
  input: KieVideoGenerateInput,
): Promise<NormalizedKieImageResult> {
  const key = getKieApiKey();

  const get1080 = input.veoGet1080pTaskId?.trim();
  if (get1080) {
    const url = getKieVideoGenerateRequestUrl(input);
    kieRequestLog(url, { method: "GET", taskId: get1080 });
    let httpStatus = 0;
    let text = "";
    let res: Response;
    try {
      res = await fetchKie(url, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${key}`,
          Accept: "application/json",
        },
      });
      httpStatus = res.status;
      text = await res.text();
    } catch (e) {
      const aborted = e instanceof Error && e.name === "AbortError";
      return {
        success: false,
        httpStatus: 0,
        rawResponse: { networkError: true, aborted },
        errorMessage: aborted
          ? "Превышено время ожидания ответа провайдера"
          : e instanceof Error
            ? e.message
            : "Сеть / fetch",
      };
    }
    let json: unknown;
    try {
      json = text ? JSON.parse(text) : {};
    } catch {
      return {
        success: false,
        httpStatus,
        rawResponse: { parseError: true, textSnippet: text.slice(0, 500) },
        errorMessage: "Ответ провайдера не JSON",
      };
    }
    if (isDevKieLogEnabled()) {
      console.log("[KIE response]", { status: res.status, ok: res.ok, data: json });
    }
    return normalizeResponse(json, httpStatus);
  }

  if (input.omniSyncBody) {
    const url = getKieVideoGenerateRequestUrl(input);
    const body = stripUndefinedDeep(input.omniSyncBody) as JsonRecord;
    kieRequestLog(url, body);
    let httpStatus = 0;
    let text = "";
    let res: Response;
    try {
      res = await fetchKie(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${key}`,
        },
        body: JSON.stringify(body),
      });
      httpStatus = res.status;
      text = await res.text();
    } catch (e) {
      const aborted = e instanceof Error && e.name === "AbortError";
      return {
        success: false,
        httpStatus: 0,
        rawResponse: { networkError: true, aborted },
        errorMessage: aborted
          ? "Превышено время ожидания ответа провайдера"
          : e instanceof Error
            ? e.message
            : "Сеть / fetch",
      };
    }
    let json: unknown;
    try {
      json = text ? JSON.parse(text) : {};
    } catch {
      return {
        success: false,
        httpStatus,
        rawResponse: { parseError: true, textSnippet: text.slice(0, 500) },
        errorMessage: "Ответ провайдера не JSON",
      };
    }
    if (isDevKieLogEnabled()) {
      console.log("[KIE response]", { status: res.status, ok: res.ok, data: json });
    }
    return normalizeResponse(json, httpStatus);
  }

  const isMarket = Boolean(input.marketCreateBody);
  const url = isMarket
    ? getKieJobsCreateTaskUrl(input.endpoint)
    : resolveKieRequestUrl(
        getKieBaseUrl(),
        input.endpoint,
        DEFAULT_VIDEO_GENERATE_PATH,
      );
  const bodyRaw = (input.marketCreateBody ?? buildVideoRequestBody(input)) as JsonRecord;
  const body = stripUndefinedDeep(bodyRaw) as JsonRecord;
  const logPayload =
    body && typeof body === "object" && "input" in body
      ? { model: body.model, input: body.input }
      : { model: body.model, veoBody: body };
  kieRequestLog(url, logPayload);
  let httpStatus = 0;
  let text = "";
  let res: Response;
  try {
    res = await fetchKie(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify(body),
    });
    httpStatus = res.status;
    text = await res.text();
  } catch (e) {
    const aborted = e instanceof Error && e.name === "AbortError";
    return {
      success: false,
      httpStatus: 0,
      rawResponse: { networkError: true, aborted },
      errorMessage: aborted
        ? "Превышено время ожидания ответа провайдера"
        : e instanceof Error
          ? e.message
          : "Сеть / fetch",
    };
  }
  let json: unknown;
  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    if (isDevKieLogEnabled()) {
      console.log("[KIE response]", {
        status: res.status,
        ok: res.ok,
        data: { parseError: true, textSnippet: text.slice(0, 500) },
      });
    }
    return {
      success: false,
      httpStatus,
      rawResponse: { parseError: true, textSnippet: text.slice(0, 500) },
      errorMessage: "Ответ провайдера не JSON",
    };
  }
  if (isDevKieLogEnabled()) {
    console.log("[KIE response]", { status: res.status, ok: res.ok, data: json });
  }
  return normalizeResponse(json, httpStatus);
}

function lowerState(x: unknown): string | undefined {
  if (typeof x !== "string" || !x.trim()) return undefined;
  return x.trim().toLowerCase();
}

function pushUrl(bucket: string[], u: unknown) {
  if (typeof u === "string" && u.length > 0) bucket.push(u);
}

function collectUrlsFromUnknown(target: { imageUrls: string[]; videoUrls: string[] }, x: unknown) {
  if (typeof x === "string") {
    if (/\.(mp4|webm|mov)(\?|$)/i.test(x)) {
      pushUrl(target.videoUrls, x);
    } else if (/^https?:\/\//i.test(x)) {
      pushUrl(target.imageUrls, x);
    }
    return;
  }
  if (!isRecord(x)) return;
  pushUrl(target.videoUrls, x.videoUrl);
  pushUrl(target.videoUrls, x.video_url);
  pushUrl(target.imageUrls, x.imageUrl);
  pushUrl(target.imageUrls, x.image_url);
  pushUrl(target.videoUrls, x.outputUrl);
  pushUrl(target.videoUrls, x.output_url);
  pushUrl(target.videoUrls, x.resultUrl);
  pushUrl(target.videoUrls, x.result_url);
  const nested = x.result ?? x.output ?? x.data;
  if (nested) collectUrlsFromUnknown(target, nested);
  for (const arrKey of [
    "urls",
    "videoUrls",
    "videos",
    "images",
    "imageUrls",
    "files",
    /** KIE Market recordInfo: resultJson / webhook */
    "resultUrls",
    "result_urls",
  ]) {
    const arr = x[arrKey];
    if (Array.isArray(arr)) {
      for (const item of arr) {
        if (typeof item === "string") {
          collectUrlsFromUnknown(target, item);
        } else if (isRecord(item) && typeof item.url === "string") {
          collectUrlsFromUnknown(target, item.url);
        }
      }
    }
  }
}

function extractMediaFromRecordInfoData(data: JsonRecord): {
  imageUrls?: string[];
  videoUrls?: string[];
} {
  const acc = { imageUrls: [] as string[], videoUrls: [] as string[] };
  let resultJson: unknown = data.resultJson ?? data.result_json ?? data.result;
  if (typeof resultJson === "string") {
    try {
      resultJson = JSON.parse(resultJson);
    } catch {
      resultJson = null;
    }
  }
  collectUrlsFromUnknown(acc, data);
  if (resultJson) collectUrlsFromUnknown(acc, resultJson);
  return {
    imageUrls: acc.imageUrls.length > 0 ? acc.imageUrls : undefined,
    videoUrls: acc.videoUrls.length > 0 ? acc.videoUrls : undefined,
  };
}

/**
 * Ответ recordInfo / jobs: статусы задачи и извлечение URL из resultJson.
 */
export function normalizeKieRecordInfoResponse(
  response: unknown,
  httpStatus: number,
): NormalizedKieImageResult {
  const baseFail = (msg: string): NormalizedKieImageResult => ({
    success: false,
    httpStatus,
    rawResponse: response,
    errorMessage: msg,
  });

  if (httpStatus < 200 || httpStatus >= 300) {
    return baseFail("HTTP-ошибка от провайдера");
  }
  if (!isRecord(response)) {
    return baseFail("Неожиданный формат ответа (не объект)");
  }
  if ("code" in response && response.code !== undefined) {
    const c = response.code;
    if (c === 422) {
      const msg =
        typeof response.msg === "string"
          ? response.msg
          : "";
      if (
        /processing|not ready|check back|shortly|1080p is processing|4k is processing/i.test(
          msg,
        )
      ) {
        const d = isRecord(response.data) ? response.data : {};
        const taskId =
          typeof d.taskId === "string"
            ? d.taskId
            : typeof d.task_id === "string"
              ? d.task_id
              : undefined;
        return {
          success: true,
          httpStatus,
          rawResponse: response,
          taskId,
        };
      }
    }
    if (c !== 200 && c !== 0) {
      const msg =
        typeof response.msg === "string"
          ? response.msg
          : typeof (response as { message?: string }).message === "string"
            ? String((response as { message: string }).message)
            : "Ошибка в теле ответа провайдера";
      return baseFail(msg);
    }
  }

  const data: JsonRecord = isRecord(response.data) ? response.data : response;

  if (typeof data.successFlag === "number") {
    const sf = data.successFlag;
    const taskId =
      typeof data.taskId === "string"
        ? data.taskId
        : typeof data.task_id === "string"
          ? data.task_id
          : undefined;
    if (sf === 2 || sf === 3) {
      const msg =
        typeof response.msg === "string" && response.msg.trim() !== ""
          ? response.msg
          : "Генерация Veo завершилась с ошибкой";
      return baseFail(msg.slice(0, 2000));
    }
    if (sf === 0) {
      return {
        success: true,
        httpStatus,
        rawResponse: response,
        taskId,
      };
    }
    if (sf === 1) {
      const rawUrls = data.resultUrls;
      let videoUrls: string[] | undefined;
      let imageUrls: string[] | undefined;
      if (typeof rawUrls === "string" && rawUrls.trim()) {
        try {
          const p = JSON.parse(rawUrls) as unknown;
          if (Array.isArray(p) && p.every((u) => typeof u === "string")) {
            const imgs: string[] = [];
            const vids: string[] = [];
            for (const u of p) {
              if (/\.(mp4|webm|mov)(\?|$)/i.test(u)) vids.push(u);
              else imgs.push(u);
            }
            if (imgs.length > 0) imageUrls = imgs;
            if (vids.length > 0) videoUrls = vids;
          }
        } catch {
          // ignore
        }
      } else if (
        Array.isArray(rawUrls) &&
        rawUrls.length > 0 &&
        rawUrls.every((u) => typeof u === "string")
      ) {
        const imgs: string[] = [];
        const vids: string[] = [];
        for (const u of rawUrls) {
          if (/\.(mp4|webm|mov)(\?|$)/i.test(u)) vids.push(u);
          else imgs.push(u);
        }
        if (imgs.length > 0) imageUrls = imgs;
        if (vids.length > 0) videoUrls = vids;
      }
      if (
        (!videoUrls || videoUrls.length === 0) &&
        (!imageUrls || imageUrls.length === 0)
      ) {
        const ex = extractMediaFromRecordInfoData(data);
        videoUrls = ex.videoUrls;
        imageUrls = ex.imageUrls;
      }
      return {
        success: true,
        httpStatus,
        rawResponse: response,
        taskId,
        videoUrls,
        imageUrls,
      };
    }
  }

  const state =
    lowerState(data.state) ??
    lowerState(data.status) ??
    lowerState(data.taskStatus) ??
    lowerState((data as { task_status?: unknown }).task_status);

  const failTokens = ["failed", "fail", "error", "cancelled", "canceled"];
  if (state && failTokens.some((t) => state.includes(t))) {
    const msg =
      typeof data.errorMsg === "string"
        ? data.errorMsg
        : typeof data.message === "string"
          ? data.message
          : typeof data.error === "string"
            ? data.error
            : "Задача провайдера завершилась с ошибкой";
    return baseFail(msg.slice(0, 2000));
  }

  const doneTokens = ["success", "completed", "complete", "succeed", "done"];
  if (state && doneTokens.some((t) => state.includes(t))) {
    const { imageUrls, videoUrls } = extractMediaFromRecordInfoData(data);
    const taskId =
      typeof data.taskId === "string"
        ? data.taskId
        : typeof data.task_id === "string"
          ? data.task_id
          : undefined;
    const hasMedia =
      (imageUrls?.length ?? 0) > 0 || (videoUrls?.length ?? 0) > 0;
    if (hasMedia) {
      return {
        success: true,
        httpStatus,
        rawResponse: response,
        taskId,
        imageUrls,
        videoUrls,
      };
    }
    return {
      success: true,
      httpStatus,
      rawResponse: response,
      taskId,
    };
  }

  const progressTokens = [
    "processing",
    "generating",
    "running",
    "queued",
    "waiting",
    "pending",
    "created",
    "submitted",
    "working",
    "in_progress",
  ];
  if (!state || progressTokens.some((t) => state.includes(t))) {
    const taskId =
      typeof data.taskId === "string"
        ? data.taskId
        : typeof data.task_id === "string"
          ? data.task_id
          : undefined;
    return {
      success: true,
      httpStatus,
      rawResponse: response,
      taskId,
    };
  }

  return normalizeResponse(response, httpStatus);
}

/**
 * Polling-статус по taskId (эндпоинт record-info / аналог). Расширяйте normalize при новых схемах.
 * `defaultRecordInfoPath` — путь, если `endpointOverride` null (картинка / видео).
 */
export async function getTaskStatus(
  taskId: string,
  endpointOverride: string | null,
  defaultRecordInfoPath: string = DEFAULT_IMAGE_RECORD_INFO_PATH,
): Promise<NormalizedKieImageResult> {
  const base = getKieBaseUrl();
  const key = getKieApiKey();
  const baseWithSlash = base.endsWith("/") ? base : `${base}/`;
  let u: URL;
  if (endpointOverride && /^https?:\/\//i.test(endpointOverride)) {
    u = new URL(endpointOverride);
  } else {
    const path =
      endpointOverride && endpointOverride.length > 0
        ? endpointOverride.startsWith("/")
          ? endpointOverride
          : `/${endpointOverride}`
        : defaultRecordInfoPath;
    u = new URL(path, baseWithSlash);
  }
  u.searchParams.set("taskId", taskId);
  const finalUrl = u.toString();
  let httpStatus = 0;
  let text = "";
  try {
    const res = await fetchKie(finalUrl, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${key}`,
        Accept: "application/json",
      },
    });
    httpStatus = res.status;
    text = await res.text();
  } catch (e) {
    const aborted = e instanceof Error && e.name === "AbortError";
    return {
      success: false,
      httpStatus: 0,
      rawResponse: { networkError: true, aborted },
      errorMessage: aborted
        ? "Превышено время ожидания ответа провайдера"
        : e instanceof Error
          ? e.message
          : "Сеть / fetch",
    };
  }
  let json: unknown;
  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    return {
      success: false,
      httpStatus,
      rawResponse: { parseError: true, textSnippet: text.slice(0, 500) },
      errorMessage: "Ответ провайдера не JSON",
    };
  }
  return normalizeKieRecordInfoResponse(json, httpStatus);
}
