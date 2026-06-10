import { getKieApiKey, redactKieLogPayload } from "@/server/services/provider/kie";

const DEFAULT_KIE_FILE_UPLOAD_BASE_URL = "https://kieai.redpandaai.co";

const KIE_FILE_STREAM_UPLOAD_PATH = "/api/file-stream-upload";
const KIE_FILE_URL_UPLOAD_PATH = "/api/file-url-upload";

const UPLOAD_TIMEOUT_MS = Math.min(
  Number.parseInt(process.env.KIE_FILE_UPLOAD_TIMEOUT_MS ?? "60000", 10) || 60_000,
  180_000,
);

export type KieFileUploadResult = {
  ok: true;
  fileName: string;
  filePath: string;
  downloadUrl: string;
  fileSize: number;
  mimeType: string;
  method: "kie_stream" | "kie_url";
  rawResponse: unknown;
};

export type KieFileUploadError = {
  ok: false;
  method: "kie_stream" | "kie_url";
  httpStatus: number;
  message: string;
  rawResponse: unknown;
};

function kieUploadBaseUrl(): string {
  const raw = process.env.KIE_FILE_UPLOAD_BASE_URL?.trim();
  const base = raw && raw.length > 0 ? raw : DEFAULT_KIE_FILE_UPLOAD_BASE_URL;
  return base.replace(/\/$/, "");
}

function parseUploadSuccess(
  raw: unknown,
  httpStatus: number,
  method: KieFileUploadResult["method"],
): KieFileUploadResult | KieFileUploadError {
  const o = raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as Record<string, unknown>) : null;
  const success = o?.success === true || o?.code === 200;
  const data =
    o?.data && typeof o.data === "object" && !Array.isArray(o.data)
      ? (o.data as Record<string, unknown>)
      : null;
  const downloadUrl =
    (typeof data?.downloadUrl === "string" ? data.downloadUrl.trim() : "") ||
    (typeof data?.fileUrl === "string" ? data.fileUrl.trim() : "");
  if (!success || !data || !downloadUrl) {
    const msg =
      (typeof o?.msg === "string" && o.msg.trim()) ||
      (typeof o?.message === "string" && o.message.trim()) ||
      "Kie file upload failed";
    return {
      ok: false,
      method,
      httpStatus,
      message: msg,
      rawResponse: redactKieLogPayload(raw),
    };
  }
  return {
    ok: true,
    fileName: String(data.fileName ?? ""),
    filePath: String(data.filePath ?? ""),
    downloadUrl,
    fileSize: typeof data.fileSize === "number" ? data.fileSize : 0,
    mimeType: String(data.mimeType ?? "application/octet-stream"),
    method,
    rawResponse: redactKieLogPayload(raw),
  };
}

/** Не логировать Authorization / ключ. */
export async function uploadImageBufferToKie(args: {
  buffer: Buffer;
  contentType: string;
  fileName?: string;
  uploadPath?: string;
}): Promise<KieFileUploadResult | KieFileUploadError> {
  const key = getKieApiKey();
  const url = `${kieUploadBaseUrl()}${KIE_FILE_STREAM_UPLOAD_PATH}`;
  const uploadPath = args.uploadPath?.trim() || "qazcard/product-card";
  const fileName =
    args.fileName?.trim() ||
    `input-${Date.now()}.${args.contentType.includes("png") ? "png" : args.contentType.includes("webp") ? "webp" : "jpg"}`;

  const form = new FormData();
  form.append(
    "file",
    new Blob([new Uint8Array(args.buffer)], { type: args.contentType }),
    fileName,
  );
  form.append("uploadPath", uploadPath);
  form.append("fileName", fileName);

  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}` },
      body: form,
      signal: AbortSignal.timeout(UPLOAD_TIMEOUT_MS),
    });
  } catch (e) {
    return {
      ok: false,
      method: "kie_stream",
      httpStatus: 0,
      message: e instanceof Error ? e.message : "Kie stream upload network error",
      rawResponse: null,
    };
  }

  let raw: unknown;
  try {
    raw = await res.json();
  } catch {
    raw = { parseError: true, status: res.status };
  }
  const parsed = parseUploadSuccess(raw, res.status, "kie_stream");
  return parsed;
}

export async function uploadImageUrlToKie(args: {
  fileUrl: string;
  fileName?: string;
  uploadPath?: string;
}): Promise<KieFileUploadResult | KieFileUploadError> {
  const key = getKieApiKey();
  const url = `${kieUploadBaseUrl()}${KIE_FILE_URL_UPLOAD_PATH}`;
  const uploadPath = args.uploadPath?.trim() || "qazcard/product-card";

  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        fileUrl: args.fileUrl.trim(),
        uploadPath,
        ...(args.fileName?.trim() ? { fileName: args.fileName.trim() } : {}),
      }),
      signal: AbortSignal.timeout(UPLOAD_TIMEOUT_MS),
    });
  } catch (e) {
    return {
      ok: false,
      method: "kie_url",
      httpStatus: 0,
      message: e instanceof Error ? e.message : "Kie URL upload network error",
      rawResponse: null,
    };
  }

  let raw: unknown;
  try {
    raw = await res.json();
  } catch {
    raw = { parseError: true, status: res.status };
  }
  return parseUploadSuccess(raw, res.status, "kie_url");
}
