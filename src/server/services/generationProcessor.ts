
import type { Job } from "bullmq";
import { Prisma } from "@/generated/prisma/client";
import type { AiModel, Generation } from "@/generated/prisma/client";
import {
  createMockProviderTaskId,
  getMockOutputUrls,
  isMockKie,
  isMockProviderTaskId,
} from "@/lib/kie-mock";
import { explainKieErrorForUser } from "@/lib/kie-error-hints";
import {
  kieReachableImageUrlsFromInputFiles,
  KIE_REQUIRES_PUBLIC_IMAGE_URLS_RU,
  publicHttpUrlsOnly,
} from "@/lib/generation-input-limits";
import { prisma } from "@/lib/prisma";
import { createApiLog } from "@/server/services/api-log";
import { confirmCredits, refundCredits } from "@/server/services/credits";
import {
  trySendGenerationCompletedEmail,
  trySendGenerationFailedEmail,
} from "@/server/services/notificationsIntegration";
import {
  buildKieMarketCreateTaskPayload,
  buildKieRequestBodyForLog,
  buildKieVideoRequestBodyForLog,
  assertKieModelIdSet,
  generateImage,
  generateVideo,
  getDefaultRecordInfoPath,
  getKieGenerateRequestUrl,
  getKieVideoGenerateRequestUrl,
  getTaskStatus,
  redactKieLogPayload,
  trimKieModelEndpoint,
  type KieImageGenerateInput,
  type KieVideoGenerateInput,
} from "@/server/services/provider/kie";
import {
  StorageError,
  deleteFile,
  isStorageConfigured,
  uploadFromUrl,
} from "@/server/services/storage";

const INLINE_WALL_ERROR = "GENERATION_INLINE_WALL";

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
  const maxWallMs = Number.parseInt(
    process.env.GENERATION_POLL_MAX_WALL_MS ?? "0",
    10,
  );
  return {
    maxAttempts: max,
    intervalMs,
    maxWallMs: maxWallMs > 0 ? maxWallMs : 0,
  };
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

function isSettingsRecord(x: unknown): x is Record<string, unknown> {
  return typeof x === "object" && x !== null && !Array.isArray(x);
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

/** Для админ-теста и других сценариев с тем же телом, что у очереди. */
export function buildImageKieInput(
  gen: Generation,
  model: AiModel,
): KieImageGenerateInput {
  const modelId = assertKieModelIdSet(model.apiModelId);
  const ep = trimKieModelEndpoint(model.endpoint);
  const meta = asMeta(gen.metadata);
  const httpUrls = publicHttpUrlsOnly(parseInputFilesList(gen.inputFiles));
  const hasPayloadMapping =
    model.payloadMapping != null &&
    typeof model.payloadMapping === "object" &&
    !Array.isArray(model.payloadMapping);
  if (hasPayloadMapping) {
    const settings = isSettingsRecord(meta.settings) ? meta.settings : {};
    const marketCreateBody = buildKieMarketCreateTaskPayload(
      gen.prompt,
      model,
      settings,
    );
    return {
      apiModelId: modelId,
      endpoint: ep,
      marketCreateBody,
      prompt: gen.prompt,
    };
  }
  return {
    apiModelId: modelId,
    endpoint: ep,
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

export function buildVideoKieInput(
  gen: Generation,
  model: AiModel,
): KieVideoGenerateInput {
  const modelId = assertKieModelIdSet(model.apiModelId);
  const ep = trimKieModelEndpoint(model.endpoint);
  const meta = asMeta(gen.metadata);
  const httpUrls = publicHttpUrlsOnly(parseInputFilesList(gen.inputFiles));
  const wantsFiles =
    (model.supportsImageInput || model.supportsVideoInput) && httpUrls.length > 0;

  const hasPayloadMapping =
    model.payloadMapping != null &&
    typeof model.payloadMapping === "object" &&
    !Array.isArray(model.payloadMapping);
  /** Kling 3.0 Рё Wan 2.7 — через POST .../jobs/createTask; иначе без payloadMapping ушли Р±С‹ РЅР° legacy /video/generate. */
  const useMarketCreateTask =
    modelId === "kling-3.0/motion-control" ||
    modelId.toLowerCase() === "kling-3.0" ||
    modelId.toLowerCase() === "wan/2-7-text-to-video" ||
    modelId.toLowerCase() === "bytedance/seedance-2" ||
    modelId.toLowerCase() === "bytedance/seedance-2-fast" ||
    hasPayloadMapping;

  if (useMarketCreateTask) {
    const settings = isSettingsRecord(meta.settings) ? meta.settings : {};
    const marketCreateBody = buildKieMarketCreateTaskPayload(
      gen.prompt,
      model,
      settings,
    );
    return {
      apiModelId: modelId,
      endpoint: ep,
      marketCreateBody,
    };
  }

  return {
    apiModelId: modelId,
    endpoint: ep,
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
  const existing = await prisma.generation.findUnique({
    where: { id: genId },
    select: { status: true },
  });
  if (!existing || TERMINAL.has(existing.status)) {
    return;
  }
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
  void trySendGenerationFailedEmail(genId);
}

/** После исчерпания ретраев Bull — если генерация ещё РЅРµ РІ финальном состоянии. */
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

function getInlineMaxWallMs(): number {
  const raw = process.env.GENERATION_INLINE_MAX_MS?.trim();
  if (!raw) return 0;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

/**
 * Один проход обработки без очереди (QUEUE_MODE=inline). Та же бизнес-логика, что у воркера (`processGenerationJob`).
 * Публичное РёРјСЏ для API; реализация — `processVideoGenerationInline`.
 */
export async function processGeneration(generationId: string): Promise<void> {
  return processVideoGenerationInline(generationId);
}

/**
 * Локальная разработка (QUEUE_MODE=inline): полный цикл без Bull/Redis.
 * HTTP-таймауты Рє Kie — KIE_FETCH_TIMEOUT_MS; верхняя граница wall-clock — GENERATION_INLINE_MAX_MS (если > 0).
 */
export async function processVideoGenerationInline(generationId: string): Promise<void> {
  const maxMs = getInlineMaxWallMs();
  const run = () => processGenerationJob(generationId, null);
  try {
    if (maxMs > 0) {
      await Promise.race([
        run(),
        new Promise<never>((_, rej) => {
          setTimeout(
            () =>
              rej(
                new Error(INLINE_WALL_ERROR),
              ),
            maxMs,
          );
        }),
      ]);
    } else {
      await run();
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg === INLINE_WALL_ERROR) {
      await markFailed(
        generationId,
        "Превышено время ожидания (GENERATION_INLINE_MAX_MS, inline-режим).",
      );
      return;
    }
    const g = await prisma.generation.findUnique({ where: { id: generationId } });
    if (g && !TERMINAL.has(g.status)) {
      await markFailed(
        generationId,
        msg.slice(0, 4_000) || "Ошибка обработки (inline)",
      );
    }
  }
}

/**
 * РћРґРёРЅ job = РѕРґРЅР° попытка цепочки. Ретраи — уровень Bull. РќРµ дублируйте CAPTURE/REFUND.
 * `job` не используется; опционален для inline-режима без Bull.
 */
export async function processGenerationJob(
  generationId: string,
  _job?: Job<{
    generationId: string;
  }> | null,
): Promise<void> {
  void _job;
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
    if (isMockKie() && isMockProviderTaskId(gen.providerTaskId)) {
      await completeWithOutput(
        gen,
        model.type,
        getMockOutputUrls(model.type),
      );
      return;
    }
    await runPollToCompletion(
      gen,
      model,
      statusPath,
      pollCfg.maxAttempts,
      pollCfg.intervalMs,
      pollCfg.maxWallMs,
    );
    return;
  }

  if (gen.status !== "QUEUED" && gen.status !== "CREATED") {
    return;
  }

  if (!isMockKie()) {
    if (!process.env.KIE_BASE_URL?.trim() || !process.env.KIE_API_KEY?.trim()) {
      throw new Error("KIE not configured (retry when env ready)");
    }
  }

  if (isMockKie()) {
    const taskId = createMockProviderTaskId();
    await prisma.generation.update({
      where: { id: gen.id },
      data: { status: "PROCESSING", providerTaskId: taskId },
    });
    const mockNote = "MOCK_KIE: запрос к Kie.ai не отправлялся";
    if (model.type === "IMAGE") {
      const kieIn = buildImageKieInput(gen, model);
      const url = getKieGenerateRequestUrl(kieIn);
      await createApiLog({
        generationId: gen.id,
        provider: "KIE_AI",
        endpoint: url.slice(0, 2048),
        requestPayload: {
          mock: true,
          note: mockNote,
          requestUrl: url,
          body: redactKieLogPayload(buildKieRequestBodyForLog(kieIn)),
        },
        responsePayload: {
          mock: true,
          mockResponse: true,
          providerTaskId: taskId,
          message: "MOCK_KIE: эмуляция успешного создания задачи",
        },
        statusCode: 200,
        errorMessage: null,
      });
      await completeWithOutput(gen, "IMAGE", getMockOutputUrls("IMAGE"));
      return;
    }
    const kieIn = buildVideoKieInput(gen, model);
    const url = getKieVideoGenerateRequestUrl(kieIn);
    await createApiLog({
      generationId: gen.id,
      provider: "KIE_AI",
      endpoint: url.slice(0, 2048),
      requestPayload: {
        mock: true,
        note: mockNote,
        requestUrl: url,
        body: redactKieLogPayload(buildKieVideoRequestBodyForLog(kieIn)),
      },
      responsePayload: {
        mock: true,
        mockResponse: true,
        providerTaskId: taskId,
        message: "MOCK_KIE: эмуляция успешного создания задачи",
      },
      statusCode: 200,
      errorMessage: null,
    });
    await completeWithOutput(gen, "VIDEO", getMockOutputUrls("VIDEO"));
    return;
  }

  await prisma.generation.update({
    where: { id: gen.id },
    data: { status: "PROCESSING" },
  });

  if (model.type === "IMAGE") {
    if (!isMockKie() && model.provider === "KIE_AI" && model.supportsImageInput) {
      const srcUrls = parseInputFilesList(gen.inputFiles);
      if (srcUrls.length > 0 && kieReachableImageUrlsFromInputFiles(srcUrls).length === 0) {
        await markFailed(gen.id, KIE_REQUIRES_PUBLIC_IMAGE_URLS_RU);
        return;
      }
    }
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
        explainKieErrorForUser(
          result.errorMessage,
          "Ошибка Kie (image)",
        ),
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
          pollCfg.maxWallMs,
        );
      }
    } else {
      await markFailed(gen.id, "Kie: нет taskId и URL");
    }
    return;
  }

  if (model.type === "VIDEO") {
    if (!isMockKie() && model.provider === "KIE_AI") {
      const srcUrls = parseInputFilesList(gen.inputFiles);
      if (srcUrls.length > 0 && kieReachableImageUrlsFromInputFiles(srcUrls).length === 0) {
        await markFailed(gen.id, KIE_REQUIRES_PUBLIC_IMAGE_URLS_RU);
        return;
      }
    }
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
        explainKieErrorForUser(
          result.errorMessage,
          "Ошибка Kie (video)",
        ),
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
          pollCfg.maxWallMs,
        );
      }
    } else {
      await markFailed(gen.id, "Kie: нет taskId и URL видео");
    }
  }
}

/**
 * Сохранение результата (S3 при наличии), COMPLETED, confirmCredits. Используется worker и webhook Kie.
 */
export async function completeWithOutput(
  gen: Generation,
  type: "IMAGE" | "VIDEO",
  providerUrls: string[],
): Promise<void> {
  const latest = await prisma.generation.findUnique({
    where: { id: gen.id },
    select: { status: true },
  });
  if (!latest || TERMINAL.has(latest.status)) {
    return;
  }
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
    void trySendGenerationCompletedEmail(gen.id);
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

function isTerminalPollFailure(poll: {
  success: boolean;
  httpStatus: number;
  errorMessage?: string;
}): boolean {
  if (poll.success) return false;
  if (poll.httpStatus === 0) return false;
  if (poll.httpStatus >= 400 && poll.httpStatus < 500) return true;
  if (poll.errorMessage) {
    if (poll.httpStatus >= 200 && poll.httpStatus < 300) {
      return true;
    }
  }
  return false;
}

async function runPollToCompletion(
  gen: Generation,
  model: AiModel,
  defaultRecordInfoPath: string,
  maxAttempts: number,
  intervalMs: number,
  maxWallMs: number,
): Promise<void> {
  const taskId = gen.providerTaskId;
  if (!taskId) {
    await markFailed(gen.id, "Нет taskId для polling");
    return;
  }
  const startWall = maxWallMs > 0 ? Date.now() : 0;
  let lastRaw: unknown;
  let lastHttp = 0;
  let lastErr: string | null = null;
  for (let i = 0; i < maxAttempts; i++) {
    if (maxWallMs > 0 && Date.now() - startWall > maxWallMs) {
      await createApiLog({
        generationId: gen.id,
        provider: "KIE_AI",
        endpoint: "poll/wall_timeout",
        requestPayload: { taskId, maxWallMs, attempts: i },
        responsePayload: { stopped: true },
        statusCode: null,
        errorMessage: "Превышен лимит времени polling (GENERATION_POLL_MAX_WALL_MS)",
      });
      await markFailed(
        gen.id,
        "Тайм-аут ожидания (макс. длительность polling)",
      );
      return;
    }
    if (i > 0) {
      await sleep(intervalMs);
    }
    const poll = await getTaskStatus(
      taskId,
      model.statusEndpoint ?? null,
      defaultRecordInfoPath,
    );
    lastRaw = poll.rawResponse;
    lastHttp = poll.httpStatus;
    lastErr = poll.errorMessage ?? null;
    if (!poll.success) {
      if (isTerminalPollFailure(poll)) {
        await createApiLog({
          generationId: gen.id,
          provider: "KIE_AI",
          endpoint: "poll/terminal_error",
          requestPayload: { taskId, attempt: i + 1 },
          responsePayload: redactKieLogPayload(poll.rawResponse),
          statusCode: poll.httpStatus,
          errorMessage: poll.errorMessage ?? "Ошибка провайдера (poll)",
        });
        await markFailed(
          gen.id,
          explainKieErrorForUser(
            poll.errorMessage,
            "Ошибка провайдера (poll)",
          ),
        );
        return;
      }
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
