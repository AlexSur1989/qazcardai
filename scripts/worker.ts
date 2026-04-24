/**
 * Entrypoint воркера BullMQ (отдельный процесс).
 * Запуск: `npm run worker` или docker worker service.
 */
import "dotenv/config";

import { createGenerationWorker } from "../src/server/workers/generationWorker";

const { worker, connection } = createGenerationWorker();

function shutdown(signal: string) {
  // eslint-disable-next-line no-console -- worker
  console.log(`[worker] ${signal}, closing…`);
  void worker
    .close()
    .then(() => connection.quit())
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

// eslint-disable-next-line no-console -- worker
console.log("[worker] generation worker started (queue:", process.env.GENERATION_QUEUE_NAME ?? "ai-media-generation", ")");
