import { Worker } from "bullmq";
import IORedis from "ioredis";

import { GENERATION_QUEUE_NAME } from "@/server/queues/generationQueue";
import {
  markGenerationExhausted,
  processGenerationJob,
} from "@/server/services/generationProcessor";

function getConnection() {
  const url = process.env.REDIS_URL?.trim();
  if (!url) {
    throw new Error("REDIS_URL is not set");
  }
  return new IORedis(url, { maxRetriesPerRequest: null });
}

/**
 * Отдельный процесс (не Next.js). Не импортировать из RSC/API, кроме как фабрики в entrypoint.
 */
export function createGenerationWorker() {
  const connection = getConnection();
  const worker = new Worker(
    GENERATION_QUEUE_NAME,
    async (job) => {
      const data = job.data as { generationId: string };
      if (!data?.generationId) {
        return;
      }
      await processGenerationJob(data.generationId, job);
    },
    {
      connection,
      concurrency:
        Number.parseInt(process.env.GENERATION_WORKER_CONCURRENCY ?? "2", 10) || 2,
      lockDuration:
        Number.parseInt(process.env.GENERATION_LOCK_MS ?? "300000", 10) || 300_000,
      stalledInterval:
        Number.parseInt(process.env.GENERATION_STALLED_MS ?? "60000", 10) || 60_000,
    },
  );

  worker.on("failed", (job, err) => {
    // eslint-disable-next-line no-console -- worker
    console.error(
      `[generation-worker] job ${job?.id} failed`,
      err?.message ?? err,
    );
    if (!job) return;
    const max = job.opts?.attempts ?? 3;
    if (job.attemptsMade < max) {
      return;
    }
    const data = job.data as { generationId?: string } | undefined;
    const id = data?.generationId;
    if (id) {
      const msg = err instanceof Error ? err.message : String(err);
      void markGenerationExhausted(id, msg);
    }
  });

  return { worker, connection };
}
