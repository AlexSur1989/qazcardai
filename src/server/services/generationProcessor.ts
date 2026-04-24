import "server-only";

import type { Job } from "bullmq";
import { Prisma } from "@/generated/prisma/client";
import type { AiModel, Generation } from "@/generated/prisma/client";
import { publicHttpUrlsOnly } from "@/lib/generation-input-limits";
import { prisma } from "@/lib/prisma";
import { createApiLog } from "@/server/services/api-log";
import { confirmCredits, refundCredits } from "@/server/services/credits";
import {
  buildKieRequestBodyForLog,
  buildKieVideoRequestBodyForLog,
  generateImage,
  generateVideo,
  getDefaultRecordInfoPath,
  getKieGenerateRequestUrl,
  getKieVideoGenerateRequestUrl,
  getTaskStatus,
  redactKieLogPayload,
  type KieImageGenerateInput,
  type KieVideoGenerateInput,
} from "@/server/services/provider/kie";
import {
  StorageError,
  deleteFile,
  isStorageConfigured,
  uploadFromUrl,
} from "@/server/services/storage";

const TERMINAL = new Set<string>([
  "COMPLETED",
  "FAILED",
  "REFUNDED",
  "CANCELLED",
  "BLOCKED",
]);

function getPollConfig() {
  const max = Number.parseInt(process.env.GENERATION_POLL_MAX_ATTEMPTS ?? "30", 10) || 30;
  const intervalMs =
    Number.parseInt(process.env.GENERATION_POLL_INTERVAL_MS ?? "2000", 10) || 2000;
  return { maxAttempts: max, intervalMs };
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function parseInputFilesList(raw: Prisma.JsonValue | null | undefined): string[] {
  if (raw == null) return [];
  if (!Array.isArray(raw)) return [];
  return raw.filter((x): x is string => typeof x === "string");
}

function asMeta(m: Prisma.JsonValue | null | undefined): Record<string, unknown> {
  if (m && typeof m === "object" && !Array.isArray(m)) {
    return m as Record<string, unknown>;
  }
  return {};
}

function hasResultFiles(output: Prisma.JsonValue | null | undefined): boolean {
  if (output == null) return false;
  if (Array.isArray(output)) {
    return output.length > 0;
  }
  return false;
}

function urlsToOutputJson(
  urls: string[],
  type: "IMAGE" | "VIDEO",
): Prisma.InputJsonValue {
  const kind = type === "IMAGE" ? "image" : "video";
  return urls.map((url) => ({
    url,
    kind,
    storageKey: null,
    providerUrl: url,
  })) as Prisma.InputJsonValue;
}

function guessExtFromUrl(sourceUrl: string, mediaKind: "image" | "video"): string {
  try {
    const path = new URL(sourceUrl).pathname;
    const m = path.match(/\.([a-z0-9]+)$/i);
    if (m) return m[1].toLowerCase();
  } catch {
    // ignore
  }
  return mediaKind === "video" ? "mp4" : "png";
}

function outputObjectKey(
  userId: string,
  generationId: string,
  index: number,
  sourceUrl: string,
  mediaKind: "image" | "video",
): string {
  const ext = guessExtFromUrl(sourceUrl, mediaKind);
  return `generations/${userId}/${generationId}/out-${index}.${ext}`;
}

function shouldRetryProviderKie(
  result: { httpStatus: number; errorMessage?: string },
): boolean {
  const s = result.httpStatus;
  if (s === 0) return true;
  if (s === 502 || s === 503 || s === 429) return true;
  return false;
}

function buildImageKieInput(
  gen: Generation,
  model: AiModel,
): KieImageGenerateInput {
  const meta = asMeta(gen.metadata);
  const httpUrls = publicHttpUrlsOnly(parseInputFilesList(gen.inputFiles));
  return {
    apiModelId: model.apiModelId,
    endpoint: model.endpoint,
    prompt: gen.prompt,
    negativePrompt: model.supportsNegativePrompt ? gen.negativePrompt : null,
    aspectRatio: typeof meta.aspectRatio === "string" ? meta.aspectRatio : null,
    resolution: typeof meta.resolution === "string" ? meta.resolution : null,
    seed:
      model.supportsSeed && typeof meta.seed === "number"
        ? Math.floor(meta.seed)
        : null,
    inputFileUrls: model.supportsImageInput && httpUrls.length > 0 ? httpUrls : undefined,
  };
}

function buildVideoKieInput(
  gen: Generation,
  model: AiModel,
): KieVideoGenerateInput {
  const meta = asMeta(gen.metadata);
  const httpUrls = publicHttpUrlsOnly(parseInputFilesList(gen.inputFiles));
  const wantsFiles =
    (model.supportsImageInput || model.supportsVideoInput) && httpUrls.length > 0;
  return {
    apiModelId: model.apiModelId,
    endpoint: model.endpoint,
    prompt: gen.prompt,
    negativePrompt: model.supportsNegativePrompt ? gen.negativePrompt : null,
    aspectRatio: typeof meta.aspectRatio === "string" ? meta.aspectRatio : null,
    resolution: typeof meta.resolution === "string" ? meta.resolution : null,
    seed:
      model.supportsSeed && typeof meta.seed === "number"
        ? Math.floor(meta.seed)
        : null,
    durationSec:
      typeof meta.durationSec === "number" ? Math.floor(meta.durationSec) : null,
    inputFileUrls: wantsFiles ? httpUrls : undefined,
  };
}

export async function markFailed(
  genId: string,
  errorMessage: string,
): Promise<void> {
  try {
    await refundCredits(genId, "Возврат: ошибка провайдера (worker)");
  } catch {
    // ignore
  }
  await prisma.generation.update({
    where: { id: genId },
    data: {
      status: "FAILED",
      errorMessage: errorMessage.slice(0, 8000),
      completedAt: new Date(),
    },
  });
}

/** После исчерпания ретраев Bull — если генерация ещё не в финальном состоянии. */
export async function markGenerationExhausted(
  generationId: string,
  lastError: string,
): Promise<void> {
  const g = await prisma.generation.findUnique({ where: { id: generationId } });
  if (!g) return;
  if (TERMINAL.has(g.status)) return;
  await markFailed(
    generationId,
    `Job Bull исчерпан: ${lastError.slice(0, 4000)}`,
  );
}

/**
 * Один job = одна попытка цепочки. Ретраи — уровень Bull. Не дублируйте CAPTURE/REFUND.
 */
export async function processGenerationJob(
  generationId: string,
  job: Job<{
    generationId: string;
  }>,
): Promise<void> {
  const row = await prisma.generation.findUnique({
    where: { id: generationId },
    include: { model: true },
  });
  if (!row) {
    return;
  }
  if (TERMINAL.has(row.status)) {
    return;
  }

  const { model, ...gen } = row;

  const pollCfg = getPollConfig();
  const statusPath = getDefaultRecordInfoPath(model.type);

  if (gen.status === "PROCESSING" && gen.providerTaskId && !hasResultFiles(gen.outputFiles)) {
    await runPollToCompletion(
      gen,
      model,
      statusPath,
      pollCfg.maxAttempts,
      pollCfg.intervalMs,
    );
    return;
  }

  if (gen.status !== "QUEUED" && gen.status !== "CREATED") {
    return;
  }

  if (!process.env.KIE_BASE_URL?.trim() || !process.env.KIE_API_KEY?.trim()) {
    throw new Error("KIE not configured (retry when env ready)");
  }

  await prisma.generation.update({
    where: { id: gen.id },
    data: { status: "PROCESSING" },
  });

  if (model.type === "IMAGE") {
    const kieIn = buildImageKieInput(gen, model);
    const url = getKieGenerateRequestUrl(kieIn);
    const reqLog = { requestUrl: url, body: redactKieLogPayload(buildKieRequestBodyForLog(kieIn)) };
    const result = await generateImage(kieIn);
    await createApiLog({
      generationId: gen.id,
      provider: "KIE_AI",
      endpoint: url.slice(0, 2048),
      requestPayload: reqLog,
      responsePayload: redactKieLogPayload(result.rawResponse),
      statusCode: result.httpStatus,
      errorMessage: result.success ? null : result.errorMessage ?? "Ошибка провайдера",
    });
    if (!result.success) {
      if (shouldRetryProviderKie(result)) {
        throw new Error(result.errorMessage ?? "Kie error, retry");
      }
      await markFailed(
        gen.id,
        result.errorMessage ?? "Ошибка Kie (image)",
      );
      return;
    }
    const imageUrls = result.imageUrls ?? [];
    if (imageUrls.length > 0) {
      await completeWithOutput(gen, "IMAGE", imageUrls);
      return;
    }
    if (result.taskId) {
      await prisma.generation.update({
        where: { id: gen.id },
        data: { providerTaskId: result.taskId },
      });
      const updated = await prisma.generation.findUnique({ where: { id: gen.id } });
      if (updated) {
        await runPollToCompletion(
          updated,
          model,
          statusPath,
          pollCfg.maxAttempts,
          pollCfg.intervalMs,
        );
      }
    } else {
      await markFailed(gen.id, "Kie: нет taskId и URL");
    }
    return;
  }

  if (model.type === "VIDEO") {
    const kieIn = buildVideoKieInput(gen, model);
    const url = getKieVideoGenerateRequestUrl(kieIn);
    const reqLog = {
      requestUrl: url,
      body: redactKieLogPayload(buildKieVideoRequestBodyForLog(kieIn)),
    };
    const result = await generateVideo(kieIn);
    await createApiLog({
      generationId: gen.id,
      provider: "KIE_AI",
      endpoint: url.slice(0, 2048),
      requestPayload: reqLog,
      responsePayload: redactKieLogPayload(result.rawResponse),
      statusCode: result.httpStatus,
      errorMessage: result.success ? null : result.errorMessage ?? "Ошибка провайдера",
    });
    if (!result.success) {
      if (shouldRetryProviderKie(result)) {
        throw new Error(result.errorMessage ?? "Kie error, retry");
      }
      await markFailed(
        gen.id,
        result.errorMessage ?? "Ошибка Kie (video)",
      );
      return;
    }
    const videoUrls = result.videoUrls?.length
      ? result.videoUrls
      : result.imageUrls && /\.(mp4|webm|mov)/i.test(result.imageUrls[0] ?? "")
        ? result.imageUrls
        : [];
    if (videoUrls.length > 0) {
      await completeWithOutput(gen, "VIDEO", videoUrls);
      return;
    }
    if (result.imageUrls?.length) {
      await completeWithOutput(gen, "VIDEO", result.imageUrls);
      return;
    }
    if (result.taskId) {
      await prisma.generation.update({
        where: { id: gen.id },
        data: { providerTaskId: result.taskId },
      });
      const updated = await prisma.generation.findUnique({ where: { id: gen.id } });
      if (updated) {
        await runPollToCompletion(
          updated,
          model,
          statusPath,
          pollCfg.maxAttempts,
          pollCfg.intervalMs,
        );
      }
    } else {
      await markFailed(gen.id, "Kie: нет taskId и URL видео");
    }
  }
}

async function completeWithOutput(
  gen: Generation,
  type: "IMAGE" | "VIDEO",
  providerUrls: string[],
): Promise<void> {
  const mediaKind = type === "IMAGE" ? "image" : "video";
  try {
    if (!isStorageConfigured()) {
      await prisma.generation.update({
        where: { id: gen.id },
        data: {
          status: "COMPLETED",
          outputFiles: urlsToOutputJson(providerUrls, type),
          completedAt: new Date(),
        },
      });
    } else {
      const keysRolled: string[] = [];
      type FileRow = {
        fileName: string;
        fileType: string;
        mimeType: string;
        size: number;
        storageKey: string;
        url: string;
        metadata: Prisma.InputJsonValue;
      };
      const outputItems: Record<string, unknown>[] = [];
      const fileRows: FileRow[] = [];
      try {
        for (let i = 0; i < providerUrls.length; i++) {
          const src = providerUrls[i];
          const key = outputObjectKey(gen.userId, gen.id, i, src, mediaKind);
          const up = await uploadFromUrl(src, key);
          keysRolled.push(up.key);
          outputItems.push({
            url: up.url,
            storageKey: up.key,
            kind: mediaKind,
            providerUrl: src,
            size: up.size,
            contentType: up.contentType,
          });
          const ext = guessExtFromUrl(src, mediaKind);
          fileRows.push({
            fileName: `out-${i}.${ext}`.slice(0, 512),
            fileType: mediaKind.slice(0, 64),
            mimeType: up.contentType.slice(0, 128),
            size: up.size,
            storageKey: up.key.slice(0, 1024),
            url: up.url.slice(0, 2048),
            metadata: {
              providerUrl: src,
              source: "generation_output",
            } as Prisma.InputJsonValue,
          });
        }

        await prisma.$transaction(async (tx) => {
          for (const f of fileRows) {
            await tx.uploadedFile.create({
              data: {
                userId: gen.userId,
                generationId: gen.id,
                fileName: f.fileName,
                fileType: f.fileType,
                mimeType: f.mimeType,
                size: f.size,
                storageKey: f.storageKey,
                url: f.url,
                metadata: f.metadata,
              },
            });
          }
          await tx.generation.update({
            where: { id: gen.id },
            data: {
              status: "COMPLETED",
              outputFiles: outputItems as unknown as Prisma.InputJsonValue,
              completedAt: new Date(),
            },
          });
        });
      } catch (e) {
        for (const k of keysRolled) {
          await deleteFile(k).catch(() => {});
        }
        throw e;
      }
    }

    try {
      await confirmCredits(gen.id);
    } catch {
      // идемпотентность
    }
  } catch (e) {
    const msg =
      e instanceof StorageError
        ? `Хранилище: ${e.message}`
        : e instanceof Error
          ? e.message
          : "Ошибка сохранения результата";
    await markFailed(gen.id, msg.slice(0, 8000));
  }
}

async function runPollToCompletion(
  gen: Generation,
  model: AiModel,
  defaultRecordInfoPath: string,
  maxAttempts: number,
  intervalMs: number,
): Promise<void> {
  const taskId = gen.providerTaskId;
  if (!taskId) {
    await markFailed(gen.id, "Нет taskId для polling");
    return;
  }
  let lastRaw: unknown;
  let lastHttp = 0;
  let lastErr: string | null = null;
  for (let i = 0; i < maxAttempts; i++) {
    if (i > 0) {
      await sleep(intervalMs);
    }
    const poll = await getTaskStatus(taskId, model.endpoint, defaultRecordInfoPath);
    lastRaw = poll.rawResponse;
    lastHttp = poll.httpStatus;
    lastErr = poll.errorMessage ?? null;
    if (!poll.success) {
      continue;
    }
    const img = poll.imageUrls ?? [];
    const vid = poll.videoUrls ?? [];
    if (model.type === "IMAGE" && img.length > 0) {
      await createApiLog({
        generationId: gen.id,
        provider: "KIE_AI",
        endpoint: "poll/complete",
        requestPayload: { taskId, attempt: i + 1 },
        responsePayload: redactKieLogPayload(poll.rawResponse),
        statusCode: poll.httpStatus,
        errorMessage: null,
      });
      await completeWithOutput(gen, "IMAGE", img);
      return;
    }
    if (model.type === "VIDEO" && (vid.length > 0 || img.length > 0)) {
      const urls = vid.length > 0 ? vid : img;
      await createApiLog({
        generationId: gen.id,
        provider: "KIE_AI",
        endpoint: "poll/complete",
        requestPayload: { taskId, attempt: i + 1 },
        responsePayload: redactKieLogPayload(poll.rawResponse),
        statusCode: poll.httpStatus,
        errorMessage: null,
      });
      await completeWithOutput(gen, "VIDEO", urls);
      return;
    }
  }
  await createApiLog({
    generationId: gen.id,
    provider: "KIE_AI",
    endpoint: "poll/timeout",
    requestPayload: { taskId, maxAttempts },
    responsePayload: redactKieLogPayload(lastRaw),
    statusCode: lastHttp,
    errorMessage: lastErr ?? "Polling: результат не готов",
  });
  await markFailed(
    gen.id,
    "Тайм-аут ожидания готового файла (polling)",
  );
}
