/**
 * Upsert стандартных пакетов токенов по slug.
 * Запуск: npm run seed:token-packages
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

const PACKAGES: Array<{
  name: string;
  slug: string;
  priceKzt: number;
  baseTokens: number;
  bonusTokens: number;
  description: string;
  sortOrder: number;
}> = [
  {
    name: "Start",
    slug: "start",
    priceKzt: 2000,
    baseTokens: 200,
    bonusTokens: 0,
    description: "Для быстрого старта и тестовых генераций.",
    sortOrder: 10,
  },
  {
    name: "Creator",
    slug: "creator",
    priceKzt: 5000,
    baseTokens: 500,
    bonusTokens: 75,
    description: "Для регулярной генерации изображений и коротких видео.",
    sortOrder: 20,
  },
  {
    name: "Pro",
    slug: "pro",
    priceKzt: 10000,
    baseTokens: 1000,
    bonusTokens: 200,
    description: "Для активной работы с видео, 720p/1080p и качественными моделями.",
    sortOrder: 30,
  },
  {
    name: "Studio",
    slug: "studio",
    priceKzt: 25000,
    baseTokens: 2500,
    bonusTokens: 750,
    description: "Для студий, контент-команд и регулярного производства AI-контента.",
    sortOrder: 40,
  },
  {
    name: "Business",
    slug: "business",
    priceKzt: 50000,
    baseTokens: 5000,
    bonusTokens: 2000,
    description: "Для агентств, бизнеса и больших объемов генерации.",
    sortOrder: 50,
  },
];

async function main() {
  for (const p of PACKAGES) {
    const totalTokens = p.baseTokens + p.bonusTokens;
    await prisma.tokenPackage.upsert({
      where: { slug: p.slug },
      create: {
        name: p.name,
        slug: p.slug,
        priceKzt: p.priceKzt,
        baseTokens: p.baseTokens,
        bonusTokens: p.bonusTokens,
        totalTokens,
        description: p.description,
        isActive: true,
        sortOrder: p.sortOrder,
      },
      update: {
        name: p.name,
        priceKzt: p.priceKzt,
        baseTokens: p.baseTokens,
        bonusTokens: p.bonusTokens,
        totalTokens,
        description: p.description,
        sortOrder: p.sortOrder,
      },
    });
    console.log(`OK: ${p.slug} (${totalTokens} токенов)`);
  }
  console.log("seed:token-packages — готово");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => {
    void prisma.$disconnect();
    void pool.end();
  });
