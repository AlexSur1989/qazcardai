
/** Таймаут HTTP к Kie.ai (генерация и polling). Переопределение: KIE_FETCH_TIMEOUT_MS. */
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
  log: { model?: unknown; input?: unknown },
): void {
  if (!isDevKieLogEnabled()) {
    return;
  }
  console.log("[KIE request]", {
    url: requestUrl,
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

  if (isRecord(data)) {
    if (typeof data.taskId === "string" && data.taskId) taskId = data.taskId;
    if (typeof data.task_id === "string" && data.task_id) taskId = data.task_id;
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
  const success = Boolean((taskId && taskId.length > 0) || hasMedia);
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

const WAN_27_TEXT_TO_VIDEO_API_ID = "wan/2-7-text-to-video";
const BYTEDANCE_SEEDANCE_2_API_ID = "bytedance/seedance-2";
const BYTEDANCE_SEEDANCE_2_FAST_API_ID = "bytedance/seedance-2-fast";
const KLING_30_MOTION_CONTROL_API_ID = "kling-3.0/motion-control";

function isBytedanceSeedance2FamilyModelId(modelId: string): boolean {
  const t = modelId.toLowerCase();
  return t === BYTEDANCE_SEEDANCE_2_API_ID || t === BYTEDANCE_SEEDANCE_2_FAST_API_ID;
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
 * Wan 2.7 Text-to-Video: без полей Kling (sound, aspect_ratio, mode, multi_shots, image_urls).
 */
function buildWan27MarketCreateTaskPayload(
  prompt: string,
  modelId: string,
  settings: Record<string, unknown>,
): JsonRecord {
  const base = getAppUrlForKieCallback();
  const neg =
    typeof settings.negativePrompt === "string" ? settings.negativePrompt.trim() : "";
  const audio = typeof settings.audioUrl === "string" ? settings.audioUrl.trim() : "";
  const resolution =
    typeof settings.resolution === "string" && settings.resolution.trim() !== ""
      ? settings.resolution.trim()
      : "1080p";
  const ratio =
    typeof settings.ratio === "string" && settings.ratio.trim() !== ""
      ? settings.ratio.trim()
      : "16:9";
  const durationNum = Number(settings.duration);
  const duration = Number.isFinite(durationNum) && durationNum > 0 ? Math.floor(durationNum) : 5;
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
  if (neg) {
    input.negative_prompt = neg;
  }
  if (audio) {
    input.audio_url = audio;
  }
  if (settings.seed != null && String(settings.seed).trim() !== "") {
    const s = Number(settings.seed);
    if (Number.isFinite(s)) {
      input.seed = Math.floor(s);
    }
  }

  const cleaned = stripKieWan27InputFields(input);
  return stripUndefinedDeep({
    model: modelId,
    callBackUrl: `${base}/api/webhooks/kie`,
    input: cleaned,
  }) as JsonRecord;
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
 * Bytedance Seedance 2.0 / 2.0 Fast: поля `input` по Kie Market (createTask).
 * @see https://docs.kie.ai/market/bytedance/seedance-2
 */
function buildSeedance2MarketCreateTaskPayload(
  prompt: string,
  modelId: string,
  settings: Record<string, unknown>,
): JsonRecord {
  const base = getAppUrlForKieCallback();
  const first = typeof settings.firstFrameUrl === "string" ? settings.firstFrameUrl.trim() : "";
  const last = typeof settings.lastFrameUrl === "string" ? settings.lastFrameUrl.trim() : "";
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

/**
 * Тело POST для Kie Market /api/v1/jobs/createTask (без секретов в логах — отдельно redact).
 */
export function buildKieMarketCreateTaskPayload(
  prompt: string,
  model: { apiModelId: string; payloadMapping: unknown },
  settings: Record<string, unknown>,
): JsonRecord {
  const modelId = assertKieModelIdSet(model.apiModelId);
  if (modelId.toLowerCase() === WAN_27_TEXT_TO_VIDEO_API_ID) {
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
  /** Kie ожидает ровно `kling-3.0` (док.); иной регистр в админке ломал бы createTask. */
  if (modelId.toLowerCase() === "kling-3.0") {
    return buildKling30MarketCreateTaskPayload(prompt, "kling-3.0", settings);
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
  if (input.marketCreateBody) {
    return input.marketCreateBody;
  }
  return buildVideoRequestBody(input);
}

export function getKieVideoGenerateRequestUrl(input: KieVideoGenerateInput): string {
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
  kieRequestLog(url, { model: body.model, input: body.input });
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
