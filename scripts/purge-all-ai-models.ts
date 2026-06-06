/**
 * Удаляет все строки AiModel из БД и связанные Generation (и дочерние записи).
 *
 * ВНИМАНИЕ: необратимо удаляет историю генераций. Баланс пользователей не пересчитывается
 * автоматически — credit_transactions с generationId обнуляются (onDelete SetNull).
 *
 * Запуск:
 *   CONFIRM_PURGE_ALL_AI_MODELS=1 npm run purge:all-ai-models
 *
 * Production (дополнительно):
 *   CONFIRM_PURGE_ALL_AI_MODELS=1 ALLOW_PURGE_ON_PRODUCTION=1 npm run purge:all-ai-models
 */
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";

import { PrismaClient } from "../src/generated/prisma/client";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("В .env нужен DATABASE_URL");
}

if (process.env.CONFIRM_PURGE_ALL_AI_MODELS !== "1") {
  console.error(
    "[purge:all-ai-models] Отмена: задайте CONFIRM_PURGE_ALL_AI_MODELS=1 для подтверждения.",
  );
  process.exit(1);
}

if (
  process.env.NODE_ENV === "production" &&
  process.env.ALLOW_PURGE_ON_PRODUCTION !== "1"
) {
  console.error(
    "[purge:all-ai-models] Production: дополнительно задайте ALLOW_PURGE_ON_PRODUCTION=1",
  );
  process.exit(1);
}

const pool = new pg.Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  const models = await prisma.aiModel.findMany({
    select: { id: true, slug: true, scope: true },
    orderBy: { slug: "asc" },
  });

  if (models.length === 0) {
    console.log("[purge:all-ai-models] ai_models уже пуста — нечего удалять.");
    return;
  }

  const modelIds = models.map((m) => m.id);
  const generations = await prisma.generation.findMany({
    where: { modelId: { in: modelIds } },
    select: { id: true },
  });
  const generationIds = generations.map((g) => g.id);

  console.log(
    `[purge:all-ai-models] найдено моделей: ${models.length}, генераций: ${generationIds.length}`,
  );
  for (const m of models) {
    console.log(`  - ${m.slug} (${m.scope})`);
  }

  if (generationIds.length > 0) {
    const apiLogs = await prisma.apiLog.deleteMany({
      where: { generationId: { in: generationIds } },
    });
    const uploaded = await prisma.uploadedFile.deleteMany({
      where: { generationId: { in: generationIds } },
    });
    const moderation = await prisma.moderationLog.deleteMany({
      where: { generationId: { in: generationIds } },
    });
    const creditTx = await prisma.creditTransaction.deleteMany({
      where: { generationId: { in: generationIds } },
    });
    const gens = await prisma.generation.deleteMany({
      where: { id: { in: generationIds } },
    });
    console.log(
      `[purge:all-ai-models] удалено: api_logs=${apiLogs.count}, uploaded_files=${uploaded.count}, moderation_logs=${moderation.count}, credit_transactions=${creditTx.count}, generations=${gens.count}`,
    );
  }

  await prisma.moderationLog.updateMany({
    where: { modelId: { in: modelIds } },
    data: { modelId: null },
  });

  const deleted = await prisma.aiModel.deleteMany({});
  console.log(`[purge:all-ai-models] удалено ai_models: ${deleted.count}`);
  console.log("[purge:all-ai-models] OK — каталог моделей в БД очищен.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
