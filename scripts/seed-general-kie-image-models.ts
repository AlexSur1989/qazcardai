/**
 * Раньше содержал GPT Image 2 + Seedream. Актуальный сид для GPT/Kling 2.6 GENERAL:
 * `npm run seed:kie-general-models`.
 *
 * Этот скрипт сохранён для обратной совместимости: деактивирует legacy Seedream GENERAL
 * и устаревший slug T2I `gpt-image-2-text-to-image-general`, если строка ещё есть в БД.
 */
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";

import { PrismaClient } from "../src/generated/prisma/client";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("В .env нужен DATABASE_URL");
}

const pool = new pg.Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const LEGACY_GPT_T2I_SLUG = "gpt-image-2-text-to-image-general";

async function main() {
  console.warn(
    "[seed:general-kie-image-models] Для GPT Image 2 / Kling 2.6 запустите: npm run seed:kie-general-models",
  );

  const legacyGpt = await prisma.aiModel.updateMany({
    where: { slug: LEGACY_GPT_T2I_SLUG, scope: "GENERAL" },
    data: {
      isActive: false,
    },
  });

  const seedreamSlug = "seedream-v4-text-to-image-general";
  const existing = await prisma.aiModel.findUnique({
    where: { slug: seedreamSlug },
    select: { id: true },
  });

  if (existing) {
    await prisma.aiModel.update({
      where: { slug: seedreamSlug },
      data: {
        isActive: false,
      },
    });
  }

  console.log("[seed:general-kie-image-models] OK");
  console.log("  legacy GPT slug deactivated rows:", legacyGpt.count);
  console.log("  Seedream row:", existing ? "deactivated" : "absent");
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
