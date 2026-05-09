/**
 * Удаляет все записи AiModel, кроме семейства Wan 2.7 / 2.6 (slug wan-2-7-* / wan-2-6-*).
 * Сначала удаляются Generation, ссылающиеся на другие модели.
 * Запуск: npm run db:models:wan-only
 */
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";

import { PrismaClient } from "../src/generated/prisma/client";

const KEEP_SLUG_PREFIXES = ["wan-2-7-", "wan-2-6-"] as const;

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("В .env нужен DATABASE_URL");
}

const pool = new pg.Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  const keepRows = await prisma.aiModel.findMany({
    where: {
      OR: KEEP_SLUG_PREFIXES.map((p) => ({ slug: { startsWith: p } })),
    },
    select: { id: true, slug: true },
  });
  if (keepRows.length === 0) {
    throw new Error(
      `Нет моделей со slug «${KEEP_SLUG_PREFIXES.join("» или «")}*». Сначала: npm run seed:wan`,
    );
  }

  const keepIds = keepRows.map((r) => r.id);

  const deletedGens = await prisma.generation.deleteMany({
    where: { modelId: { notIn: keepIds } },
  });
  const deletedModels = await prisma.aiModel.deleteMany({
    where: { id: { notIn: keepIds } },
  });

  console.log("[prune models] оставлены:", keepRows.map((r) => r.slug).join(", "));
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
