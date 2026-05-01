import IORedis from "ioredis";

let client: IORedis | null = null;

/** Одно соединение на процесс (Next API или worker). */
export function getBullConnection(): IORedis {
  if (client) {
    return client;
  }
  const url = process.env.REDIS_URL?.trim();
  if (!url) {
    throw new Error("REDIS_URL is not set");
  }
  client = new IORedis(url, {
    maxRetriesPerRequest: null,
  });
  return client;
}

/**
 * Краткая проверка для API (отдельное соединение, не путать с пулом Bull).
 * Используется перед постановкой в очередь; при сбое — 503, не зависая.
 */
export async function isRedisReachableForQueue(): Promise<boolean> {
  const url = process.env.REDIS_URL?.trim();
  if (!url) return false;
  const c = new IORedis(url, {
    connectTimeout: 2_000,
    maxRetriesPerRequest: 1,
    enableOfflineQueue: false,
  });
  try {
    return (await c.ping()) === "PONG";
  } catch {
    return false;
  } finally {
    c.disconnect();
  }
}
