/**
 * Деактивирует старые GENERAL-модели вне whitelist (фаза 1).
 * Опционально: DELETE_LEGACY_MODELS=1 и NODE_ENV≠production — удалить строки без Generation.
 *
 * npm run archive:legacy-general-models
 */
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";

import { KIE_GENERAL_MODEL_SLUG_WHITELIST } from "./lib/kie-general-model-whitelist";
import { PrismaClient } from "../src/generated/prisma/client";
import type { Prisma } from "../src/generated/prisma/client";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("В .env нужен DATABASE_URL");
}

const pool = new pg.Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

function mergeLegacyArchiveMetadata(previous: unknown): Prisma.InputJsonValue {
  const base =
    typeof previous === "object" && previous !== null && !Array.isArray(previous)
      ? ({ ...(previous as Record<string, unknown>) } satisfies Record<
          string,
          unknown
        >)
      : {};

  const next: Record<string, unknown> = {
    ...base,
    legacyArchivedAt: new Date().toISOString(),
    legacyReason:
      "Rebuilt Kie general model catalog from official Kie docs",
  };
  return next as Prisma.InputJsonValue;
}

async function main() {
  const whitelist = new Set<string>([...KIE_GENERAL_MODEL_SLUG_WHITELIST]);

  const legacy = await prisma.aiModel.findMany({
    where: {
      scope: "GENERAL",
      slug: { notIn: [...whitelist] },
    },
    select: { id: true, slug: true },
  });

  for (const row of legacy) {
    const prev = await prisma.aiModel.findUnique({
      where: { id: row.id },
      select: { metadata: true },
    });

    await prisma.aiModel.update({
      where: { id: row.id },
      data: {
        isActive: false,
        metadata: mergeLegacyArchiveMetadata(prev?.metadata),
      },
    });
    console.log("[archive] deactivated GENERAL:", row.slug);
  }

  const allowDelete =
    process.env.DELETE_LEGACY_MODELS === "1" &&
    process.env.NODE_ENV !== "production";

  if (allowDelete) {
    const again = await prisma.aiModel.findMany({
      where: {
        scope: "GENERAL",
        slug: { notIn: [...whitelist] },
        isActive: false,
      },
      select: { id: true, slug: true },
    });
    for (const row of again) {
      const n = await prisma.generation.count({ where: { modelId: row.id } });
      if (n > 0) {
        console.log("[archive] skip delete (has generations):", row.slug, n);
        continue;
      }
      await prisma.aiModel.delete({ where: { id: row.id } });
      console.log("[archive] deleted (no generations):", row.slug);
    }
  } else if (process.env.DELETE_LEGACY_MODELS === "1") {
    console.warn(
      "[archive] DELETE_LEGACY_MODELS игнорируется в NODE_ENV=production",
    );
  }

  console.log("[archive:legacy-general-models] OK, rows scanned:", legacy.length);
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
