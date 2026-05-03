
export type QueueMode = "redis" | "inline";

/** QUEUE_MODE=inline — без Bull/Redis (только локальная разработка). Иначе redis (по умолчанию). */
export function getQueueMode(): QueueMode {
  const m = process.env.QUEUE_MODE?.trim().toLowerCase();
  if (m === "inline") return "inline";
  return "redis";
}
