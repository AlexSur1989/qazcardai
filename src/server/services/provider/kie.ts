import "server-only";

const DEFAULT_IMAGE_GENERATE_PATH = "/api/v1/gpt4o-image/generate";
const DEFAULT_IMAGE_RECORD_INFO_PATH = "/api/v1/gpt4o-image/record-info";
const DEFAULT_VIDEO_GENERATE_PATH =
  process.env.KIE_VIDEO_GENERATE_PATH?.trim() || "/api/v1/video/generate";
const DEFAULT_VIDEO_RECORD_INFO_PATH =
  process.env.KIE_VIDEO_RECORD_INFO_PATH?.trim() || "/api/v1/video/record-info";

function getKieBaseUrl(): string {
  const raw = process.env.KIE_BASE_URL?.trim();
  if (!raw) {
    throw new Error("KIE_BASE_URL is not set");
  }
  return raw.replace(/\/$/, "");
}

function getKieApiKey(): string {
  const key = process.env.KIE_API_KEY?.trim();
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
  if (endpoint && /^https?:\/\//i.test(endpoint)) {
    return endpoint;
  }
  const base = baseUrl.replace(/\/$/, "");
  if (endpoint && endpoint.length > 0) {
    return endpoint.startsWith("/") ? `${base}${endpoint}` : `${base}/${endpoint}`;
  }
  const path = defaultPath.startsWith("/") ? defaultPath : `/${defaultPath}`;
  return `${base}${path}`;
}

export type KieImageGenerateInput = {
  /** ID модели в API провайдера (из AiModel.apiModelId) */
  apiModelId: string;
  /** Переопределение URL из карточки модели (относительный путь к KIE_BASE_URL или absolute URL) */
  endpoint: string | null;
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
  return buildRequestBody(input);
}

export function getKieGenerateRequestUrl(input: KieImageGenerateInput): string {
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
    body.model = input.apiModelId;
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
  const base = getKieBaseUrl();
  const key = getKieApiKey();
  const url = resolveKieRequestUrl(
    base,
    input.endpoint,
    DEFAULT_IMAGE_GENERATE_PATH,
  );
  const body = buildRequestBody(input);
  let httpStatus = 0;
  let text = "";
  try {
    const res = await fetch(url, {
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
    const err = e instanceof Error ? e.message : "Сеть / fetch";
    return {
      success: false,
      httpStatus: 0,
      rawResponse: { networkError: true },
      errorMessage: err,
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
  return normalizeResponse(json, httpStatus);
}

// --- Видео: тот же нормализатор (taskId / videoUrls) ---

export type KieVideoGenerateInput = {
  apiModelId: string;
  endpoint: string | null;
  prompt: string;
  negativePrompt?: string | null;
  aspectRatio?: string | null;
  resolution?: string | null;
  seed?: number | null;
  durationSec?: number | null;
  inputFileUrls?: string[];
};

function buildVideoRequestBody(input: KieVideoGenerateInput): JsonRecord {
  const size = input.aspectRatio?.trim() || "16:9";
  const body: JsonRecord = {
    prompt: input.prompt,
    size,
  };
  if (process.env.KIE_SEND_MODEL_IN_BODY === "1" && input.apiModelId) {
    body.model = input.apiModelId;
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
  return buildVideoRequestBody(input);
}

export function getKieVideoGenerateRequestUrl(input: KieVideoGenerateInput): string {
  return resolveKieRequestUrl(
    getKieBaseUrl(),
    input.endpoint,
    DEFAULT_VIDEO_GENERATE_PATH,
  );
}

export async function generateVideo(
  input: KieVideoGenerateInput,
): Promise<NormalizedKieImageResult> {
  const base = getKieBaseUrl();
  const key = getKieApiKey();
  const url = resolveKieRequestUrl(
    base,
    input.endpoint,
    DEFAULT_VIDEO_GENERATE_PATH,
  );
  const body = buildVideoRequestBody(input);
  let httpStatus = 0;
  let text = "";
  try {
    const res = await fetch(url, {
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
    const err = e instanceof Error ? e.message : "Сеть / fetch";
    return {
      success: false,
      httpStatus: 0,
      rawResponse: { networkError: true },
      errorMessage: err,
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
  return normalizeResponse(json, httpStatus);
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
    const res = await fetch(finalUrl, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${key}`,
        Accept: "application/json",
      },
    });
    httpStatus = res.status;
    text = await res.text();
  } catch (e) {
    const err = e instanceof Error ? e.message : "Сеть / fetch";
    return {
      success: false,
      httpStatus: 0,
      rawResponse: { networkError: true },
      errorMessage: err,
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
  return normalizeResponse(json, httpStatus);
}
