/**
 * Удаляет все записи AiModel, кроме Wan 2.7 (slug: wan-2-7-text-to-video).
 * Сначала удаляются Generation, ссылающиеся на другие модели.
 * Запуск: npx tsx scripts/delete-models-except-wan.ts
 */
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";

import { PrismaClient } from "../src/generated/prisma/client";

const KEEP_SLUG = "wan-2-7-text-to-video";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("В .env нужен DATABASE_URL");
}

const pool = new pg.Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  const keep = await prisma.aiModel.findUnique({
    where: { slug: KEEP_SLUG },
    select: { id: true, name: true },
  });
  if (!keep) {
    throw new Error(
      `Модель со slug «${KEEP_SLUG}» не найдена. Сначала: npm run seed:wan`,
    );
  }

  const deletedGens = await prisma.generation.deleteMany({
    where: { modelId: { not: keep.id } },
  });
  const deletedModels = await prisma.aiModel.deleteMany({
    where: { id: { not: keep.id } },
  });

  console.log(
    `[prune models] оставлена: ${keep.name} (${keep.id})`,
  );
  console.log(
    `[prune models] удалено generations: ${deletedGens.count}, ai_models: ${deletedModels.count}`,
  );
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
