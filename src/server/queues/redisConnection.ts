import IORedis from "ioredis";

let client: IORedis | null = null;

/**
 * Однократный PING по REDIS_URL (короткое отдельное соединение).
 * Без lazyConnect + connect() при enableOfflineQueue: false первый ping часто падает
 * до готовности сокета (в т.ч. в Next.js API routes).
 */
export async function pingRedisUrl(url: string): Promise<boolean> {
  const c = new IORedis(url, {
    lazyConnect: true,
    connectTimeout: 5_000,
    maxRetriesPerRequest: 1,
    retryStrategy: () => null,
    enableOfflineQueue: false,
  });
  try {
    await c.connect();
    const pong = await c.ping();
    return pong === "PONG";
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[redis] ping failed:", msg);
    return false;
  } finally {
    c.disconnect();
  }
}

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
  return pingRedisUrl(url);
}
