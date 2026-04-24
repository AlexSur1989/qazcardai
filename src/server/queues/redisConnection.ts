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
