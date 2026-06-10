import "server-only";

import { publicHttpUrlsOnly } from "@/lib/generation-input-limits";
import { PRODUCT_CARD_IMAGE_PROCESSING_FAILED_RU } from "@/lib/product-card-provider-image-copy";
import {
  downloadImageUrlBytes,
  isDirectUrlTrustedForKieExternalFetch,
  preflightImageUrl,
  type ImageUrlPreflightResult,
} from "@/lib/image-url-preflight";
import { isMockKie } from "@/lib/kie-mock";
import {
  uploadImageBufferToKie,
  uploadImageUrlToKie,
  type KieFileUploadError,
  type KieFileUploadResult,
} from "@/server/services/provider/kieFileUpload";

export type ProviderInputImageRole = "product" | "reference";

export type PreparedProviderInputImage = {
  role: ProviderInputImageRole;
  originalUrl: string;
  providerUrl: string;
  uploadMethod: "direct" | "kie_stream" | "kie_url";
  preflight: ImageUrlPreflightResult;
  kieUpload?: Pick<KieFileUploadResult, "fileName" | "filePath" | "fileSize" | "mimeType">;
};

export type ProviderInputImagesMetadata = {
  originalProductUrl?: string;
  originalReferenceUrl?: string;
  providerProductUrl?: string;
  providerReferenceUrl?: string;
  providerUploadMethod: "direct" | "kie_stream" | "kie_url" | "mixed";
  preflight: ImageUrlPreflightResult[];
  preparedAt: string;
};

export type PrepareProviderInputImagesArgs = {
  inputUrls: string[];
  /** Первый URL — product, второй (если есть) — reference. */
  roles?: ProviderInputImageRole[];
};

export type PrepareProviderInputImagesResult =
  | {
      ok: true;
      providerUrls: string[];
      images: PreparedProviderInputImage[];
      metadata: ProviderInputImagesMetadata;
    }
  | {
      ok: false;
      error: string;
      preflight?: ImageUrlPreflightResult[];
    };

function inferRoles(count: number, roles?: ProviderInputImageRole[]): ProviderInputImageRole[] {
  if (roles?.length === count) return roles;
  const out: ProviderInputImageRole[] = [];
  for (let i = 0; i < count; i++) {
    out.push(i === 0 ? "product" : "reference");
  }
  return out;
}

function summarizeUploadMethod(
  images: PreparedProviderInputImage[],
): ProviderInputImagesMetadata["providerUploadMethod"] {
  const methods = new Set(images.map((i) => i.uploadMethod));
  if (methods.size === 1) {
    const m = [...methods][0];
    if (m === "direct" || m === "kie_stream" || m === "kie_url") return m;
  }
  return "mixed";
}

function fileNameFromUrl(url: string, role: ProviderInputImageRole): string {
  try {
    const path = new URL(url).pathname;
    const base = path.split("/").pop()?.trim();
    if (base && base.includes(".")) return base;
  } catch {
    // ignore
  }
  return role === "product" ? "product-card.jpg" : "reference.jpg";
}

async function resolveProviderUrl(
  originalUrl: string,
  role: ProviderInputImageRole,
  preflight: ImageUrlPreflightResult,
): Promise<
  | { ok: true; providerUrl: string; uploadMethod: PreparedProviderInputImage["uploadMethod"]; kieUpload?: PreparedProviderInputImage["kieUpload"] }
  | { ok: false; error: string; kieError?: KieFileUploadError }
> {
  if (isDirectUrlTrustedForKieExternalFetch(originalUrl, preflight)) {
    return { ok: true, providerUrl: originalUrl, uploadMethod: "direct" };
  }

  const urlUpload = await uploadImageUrlToKie({
    fileUrl: originalUrl,
    fileName: fileNameFromUrl(originalUrl, role),
  });
  if (urlUpload.ok) {
    return {
      ok: true,
      providerUrl: urlUpload.downloadUrl,
      uploadMethod: "kie_url",
      kieUpload: {
        fileName: urlUpload.fileName,
        filePath: urlUpload.filePath,
        fileSize: urlUpload.fileSize,
        mimeType: urlUpload.mimeType,
      },
    };
  }

  let buffer: Buffer;
  let contentType: string;
  try {
    const dl = await downloadImageUrlBytes(originalUrl);
    buffer = dl.buffer;
    contentType = dl.contentType;
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Не удалось скачать изображение",
      kieError: urlUpload.ok ? undefined : urlUpload,
    };
  }

  const streamUpload = await uploadImageBufferToKie({
    buffer,
    contentType,
    fileName: fileNameFromUrl(originalUrl, role),
  });
  if (!streamUpload.ok) {
    return {
      ok: false,
      error: streamUpload.message,
      kieError: streamUpload,
    };
  }

  return {
    ok: true,
    providerUrl: streamUpload.downloadUrl,
    uploadMethod: "kie_stream",
    kieUpload: {
      fileName: streamUpload.fileName,
      filePath: streamUpload.filePath,
      fileSize: streamUpload.fileSize,
      mimeType: streamUpload.mimeType,
    },
  };
}

/**
 * Preflight + (при необходимости) загрузка входных изображений в Kie File Upload API.
 * Вызывать до RESERVE / createTask.
 */
export async function prepareProviderInputImages(
  args: PrepareProviderInputImagesArgs,
): Promise<PrepareProviderInputImagesResult> {
  const urls = publicHttpUrlsOnly(args.inputUrls);
  if (urls.length === 0) {
    return { ok: false, error: PRODUCT_CARD_IMAGE_PROCESSING_FAILED_RU };
  }

  if (isMockKie()) {
    const roles = inferRoles(urls.length, args.roles);
    const images: PreparedProviderInputImage[] = urls.map((originalUrl, i) => ({
      role: roles[i] ?? "product",
      originalUrl,
      providerUrl: originalUrl,
      uploadMethod: "direct",
      preflight: {
        url: originalUrl,
        ok: true,
        method: "HEAD",
        statusCode: 200,
        contentType: "image/jpeg",
        contentLength: null,
        redirectChain: [],
        readableBytes: null,
        imageMagicOk: true,
      },
    }));
    const metadata: ProviderInputImagesMetadata = {
      originalProductUrl: images.find((x) => x.role === "product")?.originalUrl,
      originalReferenceUrl: images.find((x) => x.role === "reference")?.originalUrl,
      providerProductUrl: images.find((x) => x.role === "product")?.providerUrl,
      providerReferenceUrl: images.find((x) => x.role === "reference")?.providerUrl,
      providerUploadMethod: "direct",
      preflight: images.map((x) => x.preflight),
      preparedAt: new Date().toISOString(),
    };
    return { ok: true, providerUrls: urls, images, metadata };
  }

  const roles = inferRoles(urls.length, args.roles);
  const preflightResults: ImageUrlPreflightResult[] = [];
  const images: PreparedProviderInputImage[] = [];

  for (let i = 0; i < urls.length; i++) {
    const originalUrl = urls[i]!;
    const role = roles[i] ?? "product";
    const preflight = await preflightImageUrl(originalUrl);
    preflightResults.push(preflight);

    if (!preflight.ok) {
      return {
        ok: false,
        error: PRODUCT_CARD_IMAGE_PROCESSING_FAILED_RU,
        preflight: preflightResults,
      };
    }

    const resolved = await resolveProviderUrl(originalUrl, role, preflight);
    if (!resolved.ok) {
      return {
        ok: false,
        error: PRODUCT_CARD_IMAGE_PROCESSING_FAILED_RU,
        preflight: preflightResults,
      };
    }

    images.push({
      role,
      originalUrl,
      providerUrl: resolved.providerUrl,
      uploadMethod: resolved.uploadMethod,
      preflight,
      kieUpload: resolved.kieUpload,
    });
  }

  const metadata: ProviderInputImagesMetadata = {
    originalProductUrl: images.find((x) => x.role === "product")?.originalUrl,
    originalReferenceUrl: images.find((x) => x.role === "reference")?.originalUrl,
    providerProductUrl: images.find((x) => x.role === "product")?.providerUrl,
    providerReferenceUrl: images.find((x) => x.role === "reference")?.providerUrl,
    providerUploadMethod: summarizeUploadMethod(images),
    preflight: preflightResults,
    preparedAt: new Date().toISOString(),
  };

  return {
    ok: true,
    providerUrls: images.map((x) => x.providerUrl),
    images,
    metadata,
  };
}
