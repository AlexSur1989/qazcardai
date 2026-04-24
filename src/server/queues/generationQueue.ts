import { Queue } from "bullmq";

import { getBullConnection } from "@/server/queues/redisConnection";

const QUEUE_NAME = process.env.GENERATION_QUEUE_NAME?.trim() || "ai-media-generation";

let generationQueue: Queue | null = null;

export const GENERATION_QUEUE_NAME = QUEUE_NAME;

export function getGenerationQueue(): Queue {
  if (generationQueue) {
    return generationQueue;
  }
  generationQueue = new Queue(QUEUE_NAME, {
    connection: getBullConnection(),
    defaultJobOptions: {
      attempts: Number.parseInt(process.env.GENERATION_JOB_ATTEMPTS ?? "3", 10) || 3,
      backoff: {
        type: "exponential",
        delay:
          Number.parseInt(process.env.GENERATION_BACKOFF_MS ?? "2000", 10) || 2000,
      },
      removeOnComplete: 1000,
      removeOnFail: false,
    },
  });
  return generationQueue;
}

export type GenerationJobData = { generationId: string };

/**
 * Idempotent по `jobId` — повтор при той же генерации даст duplicate job error; обрабатывайте снаружи.
 */
export async function enqueueGenerationJob(generationId: string): Promise<void> {
  const q = getGenerationQueue();
  await q.add(
    "process",
    { generationId } satisfies GenerationJobData,
    {
      jobId: `gen-${generationId}`,
    },
  );
}
